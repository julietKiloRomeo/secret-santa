import ReactRuntime from './react_runtime.js';
import ReactDOMClientRuntime from './react_dom_client_runtime.js';
import * as _jingle_bell_hero_chart from './jingle_bell_hero_chart.js';
import * as _jingle_bell_hero_core from './jingle_bell_hero_core.js';

const React = ReactRuntime;
const {
  useState,
  useEffect,
  useRef
} = React;
const {
  createRoot
} = ReactDOMClientRuntime;

const isBrowser = typeof window !== 'undefined';
const VIEW_WIDTH = 800;
const VIEW_HEIGHT = 820;
const LANES = [1, 2, 3, 4];
const LANE_WIDTH = VIEW_WIDTH / (LANES.length + 1);
const HIT_WINDOW_SEC = _jingle_bell_hero_core.HIT_TOLERANCE / _jingle_bell_hero_core.SCROLL_SPEED;
const LEVEL_SONGS = ['partridge-1', 'partridge-1', 'partridge-2', 'partridge-2', 'partridge-3', 'partridge-3'];

const laneX = lane => lane * LANE_WIDTH;
const clamp = (val, min, max) => Math.max(min, Math.min(max, val));
const timingScore = delta => {
  const ad = Math.abs(delta);
  if (ad <= HIT_WINDOW_SEC * 0.35) {
    return {
      label: 'PERFECT!',
      points: 150
    };
  }
  if (ad <= HIT_WINDOW_SEC * 0.8) {
    return {
      label: 'GOOD',
      points: 110
    };
  }
  return {
    label: 'OK',
    points: 80
  };
};

export default function JingleBellHero() {
  const [gameState, setGameState] = useState('menu');
  const [progressionIndex, setProgressionIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [lives, setLives] = useState(_jingle_bell_hero_core.MAX_LIVES);
  const [missStreak, setMissStreak] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [hitFeedback, setHitFeedback] = useState([]);
  const [songs, setSongs] = useState({});
  const [loadingSongs, setLoadingSongs] = useState(true);
  const [songError, setSongError] = useState('');
  const [laneEffects, setLaneEffects] = useState([]);
  const [speedLabel, setSpeedLabel] = useState('');
  const startTimeRef = useRef(null);
  const audioPlayerRef = useRef(isBrowser ? new _jingle_bell_hero_core.AudioPlayer() : null);
  const notesRef = useRef([]);
  const playedNotesRef = useRef(new Set());
  const heldNotesRef = useRef(new Set());
  const completedNotesRef = useRef(new Set());
  const holdHandlesRef = useRef(new Map());
  const activeKeysRef = useRef(new Set());
  const animationRef = useRef(null);
  const rootRef = useRef(null);
  const endlessBoostRef = useRef(0);
  const submittedScoreRef = useRef(false);
  const songsReady = !loadingSongs && !songError && Object.keys(songs).length === _jingle_bell_hero_chart.SONG_MANIFEST.length;
  const nowSeconds = () => {
    if (!startTimeRef.current) return 0;
    return (performance.now() - startTimeRef.current) / 1000;
  };

  const addLaneEffect = (lane, type, duration = 450) => {
    const expiry = Date.now() + duration;
    setLaneEffects(prev => [...prev, {
      lane,
      type,
      expiry,
      id: `${lane}-${type}-${expiry}-${Math.random().toString(36).slice(2, 6)}`
    }]);
  };

  useEffect(() => {
    if (!laneEffects.length) return undefined;
    const id = setInterval(() => {
      const now = Date.now();
      setLaneEffects(prev => prev.filter(e => e.expiry > now));
    }, 120);
    return () => clearInterval(id);
  }, [laneEffects.length]);

  useEffect(() => {
    let active = true;
    setLoadingSongs(true);
    _jingle_bell_hero_chart.loadSongCharts().then(data => {
      if (!active) return;
      setSongs(data);
      setSongError('');
    }).catch(err => {
      console.error(err);
      if (active) {
        setSongError('Kunne ikke hente sangene til nisse-bjælderne.');
      }
    }).finally(() => {
      if (active) {
        setLoadingSongs(false);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  const setupLevel = levelIndex => {
    const baseIndex = Math.min(levelIndex, _jingle_bell_hero_chart.PROGRESSION.length - 1);
    const currentLevel = _jingle_bell_hero_chart.PROGRESSION[baseIndex];
    const {
      difficulty,
      speedIndex
    } = currentLevel;
    const config = _jingle_bell_hero_chart.DIFFICULTIES[difficulty];
    const speed = config.speeds[speedIndex];
    const songId = LEVEL_SONGS[levelIndex] || LEVEL_SONGS[LEVEL_SONGS.length - 1] || currentLevel.songId;
    const chartEvents = songs[songId] || [];
    const easedChart = levelIndex < 2 ? chartEvents.map(event => ({
      ...event,
      notes: event.notes && event.notes.length ? [event.notes[0]] : []
    })).filter(e => e.notes.length) : chartEvents;
    const songWithFreq = (0, _jingle_bell_hero_core.addFrequencies)(easedChart);
    const speedBoost = Math.max(0, levelIndex - (_jingle_bell_hero_chart.PROGRESSION.length - 1));
    const speedMultiplier = speed.speedMultiplier * (1 + speedBoost * 0.08);
    const scaledSong = songWithFreq.map(event => ({
      ...event,
      time: event.time / speedMultiplier
    }));
    const prepared = (0, _jingle_bell_hero_core.processTiedNotes)(scaledSong).map((note, idx) => ({
      ...note,
      id: `${songId}-${idx}`,
      startTime: note.startTime + _jingle_bell_hero_core.READY_TIME,
      endTime: note.endTime + _jingle_bell_hero_core.READY_TIME
    }));
    notesRef.current = prepared;
    playedNotesRef.current = new Set();
    heldNotesRef.current = new Set();
    completedNotesRef.current = new Set();
    setSpeedLabel(`${config.speeds[speedIndex].name}${speedBoost ? ` x${speedMultiplier.toFixed(2)}` : ''}`);
    startTimeRef.current = performance.now();
    setCurrentTime(0);
  };

  useEffect(() => {
    if (gameState !== 'playing' || !songsReady) return undefined;
    setupLevel(progressionIndex);
    const loop = () => {
      if (!startTimeRef.current) return;
      const now = (performance.now() - startTimeRef.current) / 1000;
      setCurrentTime(now);
      notesRef.current.forEach((note, idx) => {
        if (playedNotesRef.current.has(idx) || completedNotesRef.current.has(idx)) return;
        const laneHeld = activeKeysRef.current.has(note.lane) || Array.from(heldNotesRef.current).some(hIdx => notesRef.current[hIdx]?.lane === note.lane);
        const windowEnd = note.startTime + HIT_WINDOW_SEC;
        if (laneHeld && now >= note.startTime) {
          registerMiss(note.lane, idx);
        } else if (now > windowEnd && !heldNotesRef.current.has(idx)) {
          registerMiss(note.lane, idx);
        }
      });
      const lastNote = notesRef.current[notesRef.current.length - 1];
      if (lastNote && now > lastNote.endTime + 2) {
        setProgressionIndex(prev => prev + 1);
        return;
      }
      heldNotesRef.current.forEach(idx => {
        const note = notesRef.current[idx];
        const endWindow = HIT_WINDOW_SEC;
        if (now > note.endTime + endWindow) {
          const handle = holdHandlesRef.current.get(idx);
          if (handle) {
            audioPlayerRef.current?.stopHold(handle);
            holdHandlesRef.current.delete(idx);
          }
          heldNotesRef.current.delete(idx);
          completedNotesRef.current.add(idx);
          setCombo(0);
          setMissStreak(m => Math.min(4, m + 1));
        }
      });
      animationRef.current = requestAnimationFrame(loop);
    };
    animationRef.current = requestAnimationFrame(loop);
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [gameState, progressionIndex, songsReady, songs]);

  useEffect(() => {
    if (!isBrowser) return undefined;
    const handler = event => {
      if (gameState !== 'playing') return;
      const keyMap = {
        d: 1,
        f: 2,
        j: 3,
        k: 4
      };
      const lane = keyMap[event.key ? event.key.toLowerCase() : ''];
      if (lane) {
        event.preventDefault();
        if (!activeKeysRef.current.has(lane)) {
          activeKeysRef.current.add(lane);
          handleInputStart(lane);
        }
      }
    };
    const upHandler = event => {
      if (gameState !== 'playing') return;
      const keyMap = {
        d: 1,
        f: 2,
        j: 3,
        k: 4
      };
      const lane = keyMap[event.key ? event.key.toLowerCase() : ''];
      if (lane) {
        event.preventDefault();
        activeKeysRef.current.delete(lane);
        handleInputEnd(lane);
      }
    };
    window.addEventListener('keydown', handler);
    window.addEventListener('keyup', upHandler);
    return () => {
      window.removeEventListener('keydown', handler);
      window.removeEventListener('keyup', upHandler);
    };
  }, [gameState]);

  const startGame = () => {
    if (!songsReady) {
      setSongError('Sangene er ikke klar endnu. Prøv igen om et øjeblik.');
      return;
    }
    setProgressionIndex(0);
    endlessBoostRef.current = 0;
    submittedScoreRef.current = false;
    setScore(0);
    setCombo(0);
    setLives(_jingle_bell_hero_core.MAX_LIVES);
    setMissStreak(0);
    setHitFeedback([]);
    setGameState('playing');
  };

  const resetGame = () => {
    setGameState('menu');
    setProgressionIndex(0);
    endlessBoostRef.current = 0;
    submittedScoreRef.current = false;
    setLives(_jingle_bell_hero_core.MAX_LIVES);
    setScore(0);
    setCombo(0);
    setMissStreak(0);
    setHitFeedback([]);
  };

  const handleInputStart = lane => {
    if (gameState === 'ended') {
      resetGame();
      return;
    }
    if (gameState === 'menu') {
      startGame();
      return;
    }
    if (gameState !== 'playing') return;
    const now = nowSeconds();
    const notesInZone = notesRef.current.filter((note, idx) => {
      if (playedNotesRef.current.has(idx)) return false;
      if (note.lane !== lane) return false;
      return Math.abs(note.startTime - now) <= HIT_WINDOW_SEC;
    });
    const otherNotesInWindow = notesRef.current.filter((note, idx) => {
      if (playedNotesRef.current.has(idx)) return false;
      if (note.lane === lane) return false;
      return Math.abs(note.startTime - now) <= HIT_WINDOW_SEC;
    });
    if (notesInZone.length > 0) {
      const note = notesInZone[0];
      const idx = notesRef.current.indexOf(note);
      const { label, points } = timingScore(note.startTime - now);
      playedNotesRef.current.add(idx);
      if (note.isSustained) {
        heldNotesRef.current.add(idx);
        const handle = audioPlayerRef.current?.startHold(note.freq);
        if (handle) {
          holdHandlesRef.current.set(idx, handle);
        }
        addLaneEffect(lane, 'hold', 1200);
      } else {
        completedNotesRef.current.add(idx);
        audioPlayerRef.current?.playNote(note.freq, 0.25);
        addLaneEffect(lane, 'hit', 350);
      }
      setScore(s => s + points);
      setCombo(c => c + 1);
      setMissStreak(0);
      setHitFeedback(prev => [...prev, {
        lane,
        time: Date.now(),
        text: note.isSustained ? 'HOLD!' : label
      }]);
      setTimeout(() => {
        setHitFeedback(prev => prev.filter(f => Date.now() - f.time <= 450));
      }, 450);
      return;
    }
    if (otherNotesInWindow.length > 0) {
      registerMiss(lane, undefined, {
        heavy: true,
        playError: true
      });
    } else {
      registerMiss(lane);
    }
  };

  const handleInputEnd = lane => {
    if (gameState !== 'playing') return;
    const now = nowSeconds();
    const heldNotesInLane = notesRef.current.filter((note, idx) => heldNotesRef.current.has(idx) && note.lane === lane);
    if (!heldNotesInLane.length) return;
    const note = heldNotesInLane[0];
    const idx = notesRef.current.indexOf(note);
    const delta = note.endTime - now;
    const within = Math.abs(delta) <= HIT_WINDOW_SEC * 1.2;
    const handle = holdHandlesRef.current.get(idx);
    if (handle) {
      audioPlayerRef.current?.stopHold(handle);
      holdHandlesRef.current.delete(idx);
    }
    heldNotesRef.current.delete(idx);
    completedNotesRef.current.add(idx);
    if (within) {
      const { label, points } = timingScore(delta);
      setScore(s => s + points);
      setCombo(c => c + 1);
      setMissStreak(0);
      addLaneEffect(lane, 'release', 300);
      setHitFeedback(prev => [...prev, {
        lane,
        time: Date.now(),
        text: 'RELEASE!'
      }]);
      setTimeout(() => {
        setHitFeedback(prev => prev.filter(f => Date.now() - f.time <= 450));
      }, 450);
    } else {
      registerMiss(lane);
    }
  };

  const registerMiss = (lane, idx, options = {}) => {
    const heavy = options.heavy || false;
    const playError = options.playError || false;
    if (typeof idx === 'number') {
      completedNotesRef.current.add(idx);
    }
    addLaneEffect(lane, 'miss', 500);
    setCombo(0);
    setMissStreak(m => {
      const newStreak = m + (heavy ? 2 : 1);
      if (newStreak >= 4) {
        setLives(l => {
          const updated = l - (heavy ? 2 : 1);
          if (updated <= 0) {
            setGameState('ended');
            return 0;
          }
          return updated;
        });
        return 0;
      }
      return newStreak;
    });
    if (playError) {
      audioPlayerRef.current?.playError(0.2);
    }
    setHitFeedback(prev => [...prev, {
      lane,
      time: Date.now(),
      text: 'MISS'
    }]);
    setTimeout(() => {
      setHitFeedback(prev => prev.filter(f => Date.now() - f.time <= 450));
    }, 450);
  };

  useEffect(() => {
    const isTestEnv = typeof process !== 'undefined' && process.env && process.env.NODE_ENV !== 'production';
    if (isTestEnv && typeof window !== 'undefined') {
      window.__JingleBellHeroTestHooks__ = {
        setSustainedNotes: notes => {
          notesRef.current = notes;
        },
        setCurrentTime,
        triggerBell: handleInputStart,
        resetRefs: () => {
          playedNotesRef.current = new Set();
          heldNotesRef.current = new Set();
          completedNotesRef.current = new Set();
        },
        stopLoop: () => {
          if (animationRef.current) {
            cancelAnimationFrame(animationRef.current);
            animationRef.current = null;
          }
          startTimeRef.current = null;
        },
        getState: () => ({
          score,
          combo,
          lives,
          missStreak
        })
      };
      return () => {
        delete window.__JingleBellHeroTestHooks__;
      };
    }
    return undefined;
  }, [handleInputStart, score, combo, lives, missStreak]);

  useEffect(() => {
    if (gameState !== 'ended' || submittedScoreRef.current) return undefined;
    submittedScoreRef.current = true;
    let cancelled = false;
    const run = async () => {
      if (typeof window === 'undefined') return;
      const overlay = window.arcadeOverlay;
      if (overlay && overlay.handleHighScoreFlow) {
        try {
          await overlay.handleHighScoreFlow({
            gameId: 'tredje-advent',
            score,
            allowSkip: true,
            title: 'Jingle Bell Hero'
          });
        } catch (e) {
          if (!cancelled) console.error('High score flow failed', e);
        }
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [gameState, score]);

  const laneBackgrounds = LANES.map(lane => React.createElement("rect", {
    key: `lane-${lane}`,
    x: laneX(lane) - LANE_WIDTH * 0.45,
    y: 40,
    width: LANE_WIDTH * 0.9,
    height: VIEW_HEIGHT - 120,
    rx: "18",
    fill: lane % 2 === 0 ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.03)",
    stroke: "rgba(255,255,255,0.08)",
    strokeWidth: "2"
  }));

  const bellNodes = LANES.map(lane => React.createElement("g", {
    key: `bell-${lane}`,
    "data-testid": `bell-${lane}`,
    role: "button",
    "aria-label": "🔔",
    tabIndex: 0,
    transform: `translate(${laneX(lane)}, ${_jingle_bell_hero_core.HIT_ZONE_Y + 70})`,
    onClick: () => {
      handleInputStart(lane);
      handleInputEnd(lane);
    },
    onPointerDown: e => {
      e.preventDefault();
      handleInputStart(lane);
    },
    onPointerUp: e => {
      e.preventDefault();
      handleInputEnd(lane);
    },
    onKeyDown: e => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleInputStart(lane);
      }
    },
    onKeyUp: e => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleInputEnd(lane);
      }
    },
    style: {
      cursor: 'pointer',
      pointerEvents: 'auto'
    }
  }, React.createElement("circle", {
    cx: "0",
    cy: "-10",
    r: "30",
    fill: "url(#bell-glow)",
    opacity: "0.45"
  }), laneEffects.filter(e => e.lane === lane && e.type === 'hit').map(e => React.createElement("circle", {
    key: e.id,
    cx: "0",
    cy: "-10",
    r: "36",
    fill: "#34d399",
    opacity: "0.35"
  })), laneEffects.filter(e => e.lane === lane && e.type === 'hold').map(e => React.createElement("rect", {
    key: e.id,
    x: -24,
    y: -86,
    width: "48",
    height: "140",
    rx: "18",
    fill: "#22c55e",
    opacity: "0.18"
  })), laneEffects.filter(e => e.lane === lane && e.type === 'miss').map(e => React.createElement("circle", {
    key: e.id,
    cx: "0",
    cy: "-10",
    r: "40",
    fill: "#ef4444",
    opacity: "0.25"
  })), React.createElement("text", {
    x: "0",
    y: "10",
    textAnchor: "middle",
    fontSize: "52"
  }, "\uD83D\uDD14"), React.createElement("text", {
    x: "0",
    y: "32",
    textAnchor: "middle",
    fontSize: "14",
    fill: "#fff",
    fontWeight: "bold"
  }, ['D', 'F', 'J', 'K'][lane - 1]), hitFeedback.filter(f => f.lane === lane).map((f, i) => React.createElement("text", {
    key: `${f.lane}-${i}-${f.time}`,
    x: "0",
    y: "-70",
    textAnchor: "middle",
    fontSize: "20",
    fill: f.text === 'PERFECT!' || f.text === 'RELEASE!' || f.text === 'HOLD!' ? '#22c55e' : '#f87171'
  }, f.text))));

  const noteElements = notesRef.current.map((note, idx) => {
    if (completedNotesRef.current.has(idx)) return null;
    const centerX = laneX(note.lane);
    const startY = _jingle_bell_hero_core.HIT_ZONE_Y - (note.startTime - currentTime) * _jingle_bell_hero_core.SCROLL_SPEED;
    const endY = _jingle_bell_hero_core.HIT_ZONE_Y - (note.endTime - currentTime) * _jingle_bell_hero_core.SCROLL_SPEED;
    if (startY < -220 || startY > VIEW_HEIGHT + 320) return null;
    const isStartHit = playedNotesRef.current.has(idx);
    const isHeld = heldNotesRef.current.has(idx);
    if (note.isSustained) {
      const actualStartY = isStartHit ? _jingle_bell_hero_core.HIT_ZONE_Y : startY;
      const clampedEndY = clamp(endY, 60, _jingle_bell_hero_core.HIT_ZONE_Y);
      return React.createElement("g", {
        key: `note-${note.id}`,
        "data-testid": "note",
        className: "pointer-events-none"
      }, React.createElement("line", {
        x1: centerX,
        y1: clampedEndY,
        x2: centerX,
        y2: actualStartY,
        stroke: isHeld ? '#22c55e' : '#fbbf24',
        strokeWidth: "10",
        opacity: isHeld ? 0.85 : 1
      }), endY <= _jingle_bell_hero_core.HIT_ZONE_Y && React.createElement("circle", {
        cx: centerX,
        cy: clampedEndY,
        r: "15",
        fill: isHeld ? '#22c55e' : '#fbbf24',
        stroke: "#000",
        strokeWidth: "2"
      }), !isStartHit && React.createElement("circle", {
        cx: centerX,
        cy: startY,
        r: "18",
        fill: "#fbbf24",
        stroke: "#000",
        strokeWidth: "3"
      }), isHeld && React.createElement("circle", {
        cx: centerX,
        cy: _jingle_bell_hero_core.HIT_ZONE_Y,
        r: "22",
        fill: "none",
        stroke: "#22c55e",
        strokeWidth: "4",
        opacity: "0.6"
      }));
    }
    return React.createElement("g", {
      key: `note-${note.id}`,
      "data-testid": "note",
      className: "pointer-events-none"
    }, React.createElement("circle", {
      cx: centerX,
      cy: startY,
      r: "18",
      fill: "#fbbf24",
      stroke: "#000",
      strokeWidth: "3"
    }), isStartHit && React.createElement("circle", {
      cx: centerX,
      cy: _jingle_bell_hero_core.HIT_ZONE_Y,
      r: "22",
      fill: "none",
      stroke: "#22c55e",
      strokeWidth: "4",
      opacity: "0.6"
    }), playedNotesRef.current.has(idx) && !isHeld && React.createElement("circle", {
      cx: centerX,
      cy: _jingle_bell_hero_core.HIT_ZONE_Y,
      r: "30",
      fill: "#22c55e",
      opacity: "0.15"
    }));
  }).filter(Boolean);

  const hitLine = React.createElement("line", {
    key: "hit-line",
    "data-testid": "hit-line",
    x1: "0",
    y1: _jingle_bell_hero_core.HIT_ZONE_Y,
    x2: VIEW_WIDTH,
    y2: _jingle_bell_hero_core.HIT_ZONE_Y,
    stroke: "#fff",
    strokeWidth: "8",
    opacity: "0.9"
  });

  const svgChildren = [...laneBackgrounds, hitLine, ...noteElements, ...bellNodes];

  if (gameState === 'menu') {
    return React.createElement("div", {
      ref: rootRef,
      className: "flex flex-col items-center justify-center min-h-[640px] sm:min-h-[720px] bg-gradient-to-b from-slate-900 via-indigo-900 to-purple-900 w-full rounded-3xl shadow-2xl p-6 text-center gap-4"
    }, React.createElement("div", {
      className: "text-3xl font-bold text-white"
    }, "Jingle Bell Hero"), React.createElement("p", {
      className: "text-white/80"
    }, "Tr\u00e6f nisse-bj\u00e6lderne med D / F / J / K eller tryk direkte p\u00e5 bj\u00e6lderne."), songError && React.createElement("p", {
      className: "text-red-200 text-sm"
    }, songError), loadingSongs && React.createElement("p", {
      className: "text-white/70 text-sm"
    }, "Loading songs\u2026"), React.createElement("button", {
      onClick: startGame,
      disabled: !songsReady,
      className: `px-10 py-4 bg-yellow-500 text-red-900 font-bold text-xl rounded-lg shadow-lg transform transition ${songsReady ? 'hover:bg-yellow-400 hover:scale-105' : 'opacity-60 cursor-not-allowed'}`
    }, "START"));
  }

  if (gameState === 'ended') {
    const isVictory = progressionIndex >= _jingle_bell_hero_chart.PROGRESSION.length - 1 && lives > 0;
    return React.createElement("div", {
      className: "flex flex-col items-center justify-center min-h-[640px] bg-gradient-to-b from-red-900 via-green-900 to-red-900 rounded-3xl shadow-2xl p-8 text-center space-y-4"
    }, React.createElement("h1", {
      className: "text-4xl font-bold text-yellow-300"
    }, isVictory ? '🎉 Victory! 🎉' : 'Game Over!'), React.createElement("p", {
      className: "text-2xl text-white"
    }, "Final Score: ", score), React.createElement("p", {
      className: "text-lg text-gray-200"
    }, "Reached Level ", Math.min(progressionIndex + 1, _jingle_bell_hero_chart.PROGRESSION.length), " of ", _jingle_bell_hero_chart.PROGRESSION.length), React.createElement("button", {
      onClick: resetGame,
      className: "px-8 py-3 bg-yellow-500 hover:bg-yellow-400 text-red-900 font-bold text-xl rounded-lg"
    }, "BACK TO MENU"));
  }

  return React.createElement("div", {
    ref: rootRef,
    className: "relative w-full max-w-5xl mx-auto aspect-[4/5] sm:aspect-[16/10] bg-gradient-to-b from-slate-950 via-indigo-950 to-purple-900 overflow-hidden rounded-3xl shadow-2xl"
  }, React.createElement("svg", {
    className: "absolute inset-0 w-full h-full",
    viewBox: `0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`,
    preserveAspectRatio: "xMidYMax meet",
    "data-testid": "playfield"
  }, React.createElement("defs", null, React.createElement("linearGradient", {
    id: "bell-glow",
    x1: "0%",
    y1: "0%",
    x2: "0%",
    y2: "100%"
  }, React.createElement("stop", {
    offset: "0%",
    stopColor: "#fbbf24",
    stopOpacity: "0.9"
  }), React.createElement("stop", {
    offset: "100%",
    stopColor: "#f59e0b",
    stopOpacity: "0.2"
  }))), svgChildren), React.createElement("div", {
    className: "absolute top-4 left-4 text-white z-10 space-y-1 bg-black/25 rounded-lg px-3 py-2"
  }, React.createElement("div", {
    className: "text-2xl font-bold"
  }, "Score: ", score), React.createElement("div", {
    className: "text-lg"
  }, "Combo: ", combo, "x"), React.createElement("div", {
    className: "text-lg"
  }, "Lives: ", '❤️'.repeat(lives) || '💔'), missStreak > 0 && React.createElement("div", {
    className: "text-sm text-red-200"
  }, "Miss Streak: ", missStreak, "/4"), React.createElement("div", {
    className: "text-sm text-yellow-200"
  }, "Level ", progressionIndex + 1, "/", _jingle_bell_hero_chart.PROGRESSION.length), React.createElement("div", {
    className: "text-xs text-white/80"
  }, speedLabel || _jingle_bell_hero_chart.DIFFICULTIES[_jingle_bell_hero_chart.PROGRESSION[Math.min(progressionIndex, _jingle_bell_hero_chart.PROGRESSION.length - 1)].difficulty].speeds[_jingle_bell_hero_chart.PROGRESSION[Math.min(progressionIndex, _jingle_bell_hero_chart.PROGRESSION.length - 1)].speedIndex].name)), React.createElement("div", {
    className: "absolute top-4 right-4 text-white z-10 text-[10px] bg-black/30 px-2 py-1 rounded"
  }, songError && React.createElement("div", {
    className: "text-red-200"
  }, songError)));
}
if (typeof document !== 'undefined') {
  const mount = () => {
    const el = document.getElementById('jingle-bell-hero-root');
    if (el && !el.__jingleBellHeroRoot__) {
      const root = createRoot(el);
      el.__jingleBellHeroRoot__ = root;
      root.render(React.createElement(JingleBellHero, null));
    }
  };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount);
  } else {
    mount();
  }
}
