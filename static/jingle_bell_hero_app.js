import ReactRuntime from './react_runtime.js';
import ReactDOMClientRuntime from './react_dom_client_runtime.js';
import * as _jingle_bell_hero_chart from './jingle_bell_hero_chart.js';
import * as _jingle_bell_hero_core from './jingle_bell_hero_core.js';

const _react_runtime = { default: ReactRuntime };
const _react_dom_client_runtime = { default: ReactDOMClientRuntime };

const {
  useState,
  useEffect,
  useRef
} = _react_runtime.default;
const {
  createRoot
} = _react_dom_client_runtime.default;
const isBrowser = typeof window !== 'undefined';
const VIEW_WIDTH = 800;
const VIEW_HEIGHT = 700;
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
  const [debugStats, setDebugStats] = useState({ visibleNotes: 0, sampleY: [], loadedSongs: [] });
  const startTimeRef = useRef(null);
  const audioPlayerRef = useRef(isBrowser ? new _jingle_bell_hero_core.AudioPlayer() : null);
  const sustainedNotesRef = useRef([]);
  const playedNotesRef = useRef(new Set());
  const heldNotesRef = useRef(new Set());
  const completedNotesRef = useRef(new Set());
  const animationRef = useRef(null);
  const rootRef = useRef(null);
  const getLaneX = lane => lane * (VIEW_WIDTH / 5);
  const getLanePercent = lane => lane * 20;
  const bellNodes = [1, 2, 3, 4].map(lane => _react_runtime.default.createElement("g", {
    key: `bell-${lane}`,
    role: "button",
    "aria-label": "🔔",
    tabIndex: 0,
    transform: `translate(${getLaneX(lane)}, ${_jingle_bell_hero_core.HIT_ZONE_Y + 70})`,
    onClick: () => handleBellClick(lane),
    onTouchStart: e => {
      e.preventDefault();
      handleBellClick(lane);
    },
    onKeyDown: e => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleBellClick(lane);
      }
    },
    style: {
      cursor: 'pointer',
      pointerEvents: 'auto'
    }
  }, _react_runtime.default.createElement("text", {
    x: "0",
    y: "0",
    textAnchor: "middle",
    fontSize: "64"
  }, "\uD83D\uDD14"), _react_runtime.default.createElement("text", {
    x: "0",
    y: "28",
    textAnchor: "middle",
    fontSize: "14",
    fill: "#fff",
    fontWeight: "bold"
  }, ['D', 'F', 'J', 'K'][lane - 1]), hitFeedback.filter(f => f.lane === lane).map((f, i) => _react_runtime.default.createElement("text", {
    key: `${f.lane}-${i}-${f.time}`,
    x: "0",
    y: "-60",
    textAnchor: "middle",
    fontSize: "20",
    fill: f.text === 'PERFECT!' || f.text === 'RELEASE!' ? '#22c55e' : '#f87171'
  }, f.text))));

  const setupLevel = levelIndex => {
    const currentLevel = _jingle_bell_hero_chart.PROGRESSION[levelIndex];
    const {
      difficulty,
      speedIndex,
      songId
    } = currentLevel;
    const config = _jingle_bell_hero_chart.DIFFICULTIES[difficulty];
    const speed = config.speeds[speedIndex];
    const chartEvents = songs[songId] || [];
    const songWithFreq = (0, _jingle_bell_hero_core.addFrequencies)(chartEvents);
    const scaledSong = songWithFreq.map(event => ({
      ...event,
      time: event.time / speed.speedMultiplier
    }));
    const originalNotes = (0, _jingle_bell_hero_core.processTiedNotes)(scaledSong);
    sustainedNotesRef.current = originalNotes.map(note => ({
      ...note,
      startTime: note.startTime + _jingle_bell_hero_core.READY_TIME,
      endTime: note.endTime + _jingle_bell_hero_core.READY_TIME
    }));
    playedNotesRef.current = new Set();
    heldNotesRef.current = new Set();
    completedNotesRef.current = new Set();
    startTimeRef.current = Date.now();
  };
  const songsReady = !loadingSongs && !songError && Object.keys(songs).length === _jingle_bell_hero_chart.SONG_MANIFEST.length;

  useEffect(() => {
    let active = true;
    setLoadingSongs(true);
    _jingle_bell_hero_chart.loadSongCharts().then(data => {
      if (!active) return;
      setSongError('');
      setSongs(data);
      setDebugStats(prev => ({ ...prev, loadedSongs: Object.keys(data) }));
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

  useEffect(() => {
    if (gameState !== 'playing' || !songsReady) return undefined;
    setupLevel(progressionIndex);
    const loop = () => {
      if (!startTimeRef.current) return;
      const now = (Date.now() - startTimeRef.current) / 1000;
      setCurrentTime(now);
      const lastNote = sustainedNotesRef.current[sustainedNotesRef.current.length - 1];
      if (lastNote && now > lastNote.endTime + 2) {
        if (progressionIndex < _jingle_bell_hero_chart.PROGRESSION.length - 1) {
          setProgressionIndex(prev => prev + 1);
        } else {
          setGameState('ended');
        }
        return;
      }
      animationRef.current = requestAnimationFrame(loop);
    };
    animationRef.current = requestAnimationFrame(loop);
    setCurrentTime(0);
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [gameState, progressionIndex, songsReady, songs]);
  useEffect(() => {
    if (!isBrowser) return undefined;
    const loop = () => {
      setDebugStats(prev => ({
        ...prev,
        visibleNotes: sustainedNotesRef.current.filter((_, idx) => !completedNotesRef.current.has(idx)).length,
        sampleY: sustainedNotesRef.current.slice(0, 5).map(n => ({
          lane: n.lane,
          start: _jingle_bell_hero_core.HIT_ZONE_Y - (n.startTime - currentTime) * _jingle_bell_hero_core.SCROLL_SPEED,
          end: _jingle_bell_hero_core.HIT_ZONE_Y - (n.endTime - currentTime) * _jingle_bell_hero_core.SCROLL_SPEED
        }))
      }));
      requestAnimationFrame(loop);
    };
    const id = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(id);
  }, [currentTime]);
  useEffect(() => {
    if (!isBrowser) return undefined;
    const handler = event => {
      if (gameState === 'ended') {
        resetGame();
        return;
      }
      if (gameState !== 'playing') return;
      const keyMap = {
        d: 1,
        f: 2,
        j: 3,
        k: 4
      };
      const lane = keyMap[event.key ? event.key.toLowerCase() : ''];
      if (lane) {
        handleBellClick(lane);
      }
    };
    window.addEventListener('keydown', handler);
    return () => {
      window.removeEventListener('keydown', handler);
    };
  }, [gameState]);
  const startGame = () => {
    if (!songsReady) {
      setSongError('Sangene er ikke klar endnu. Prøv igen om et øjeblik.');
      return;
    }
    setupLevel(0);
    setProgressionIndex(0);
    setGameState('playing');
    setScore(0);
    setCombo(0);
    setLives(_jingle_bell_hero_core.MAX_LIVES);
    setMissStreak(0);
    setCurrentTime(0);
    setHitFeedback([]);
  };
  const resetGame = () => {
    setGameState('menu');
    setProgressionIndex(0);
    setLives(_jingle_bell_hero_core.MAX_LIVES);
    setScore(0);
    setCombo(0);
    setMissStreak(0);
    setHitFeedback([]);
  };
  const handleBellClick = lane => {
    if (gameState === 'ended') {
      resetGame();
      return;
    }
    if (gameState === 'menu') {
      startGame();
      return;
    }
    if (gameState !== 'playing') return;
    const notesInZone = sustainedNotesRef.current.filter((note, idx) => {
      if (playedNotesRef.current.has(idx)) return false;
      if (note.lane !== lane) return false;
      const noteY = _jingle_bell_hero_core.HIT_ZONE_Y - (note.startTime - currentTime) * _jingle_bell_hero_core.SCROLL_SPEED;
      return Math.abs(noteY - _jingle_bell_hero_core.HIT_ZONE_Y) < _jingle_bell_hero_core.HIT_TOLERANCE;
    });
    if (notesInZone.length > 0) {
      const note = notesInZone[0];
      const idx = sustainedNotesRef.current.indexOf(note);
      playedNotesRef.current.add(idx);
      if (note.isSustained) {
        heldNotesRef.current.add(idx);
      } else {
        completedNotesRef.current.add(idx);
      }
      const duration = note.isSustained ? note.endTime - note.startTime + 0.2 : 0.3;
      audioPlayerRef.current?.playNote(note.freq, duration);
      setScore(s => s + 100);
      setCombo(c => c + 1);
      setMissStreak(0);
      setHitFeedback(prev => [...prev, {
        lane,
        time: Date.now(),
        text: 'PERFECT!'
      }]);
      setTimeout(() => {
        setHitFeedback(prev => prev.filter(f => Date.now() - f.time <= 500));
      }, 500);
      return;
    }
    const heldNotesInLane = sustainedNotesRef.current.filter((note, idx) => {
      if (!heldNotesRef.current.has(idx)) return false;
      if (note.lane !== lane) return false;
      const noteEndY = _jingle_bell_hero_core.HIT_ZONE_Y - (note.endTime - currentTime) * _jingle_bell_hero_core.SCROLL_SPEED;
      return Math.abs(noteEndY - _jingle_bell_hero_core.HIT_ZONE_Y) < _jingle_bell_hero_core.HIT_TOLERANCE;
    });
    if (heldNotesInLane.length > 0) {
      const note = heldNotesInLane[0];
      const idx = sustainedNotesRef.current.indexOf(note);
      heldNotesRef.current.delete(idx);
      completedNotesRef.current.add(idx);
      setScore(s => s + 100);
      setCombo(c => c + 1);
      setMissStreak(0);
      setHitFeedback(prev => [...prev, {
        lane,
        time: Date.now(),
        text: 'RELEASE!'
      }]);
      setTimeout(() => {
        setHitFeedback(prev => prev.filter(f => Date.now() - f.time <= 500));
      }, 500);
      return;
    }
    setCombo(0);
    setMissStreak(m => {
      const newStreak = m + 1;
      if (newStreak >= 4) {
        setLives(l => {
          const updated = l - 1;
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
    setHitFeedback(prev => [...prev, {
      lane,
      time: Date.now(),
      text: 'MISS'
    }]);
    setTimeout(() => {
      setHitFeedback(prev => prev.filter(f => Date.now() - f.time <= 500));
    }, 500);
  };
  useEffect(() => {
    const isTestEnv = typeof process !== 'undefined' && process.env && process.env.NODE_ENV !== 'production';
    if (isTestEnv && typeof window !== 'undefined') {
      window.__JingleBellHeroTestHooks__ = {
        setSustainedNotes: notes => {
          sustainedNotesRef.current = notes;
        },
        setCurrentTime,
        triggerBell: handleBellClick,
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
  }, [handleBellClick, score, combo, lives, missStreak]);

  /* istanbul ignore next */
  if (gameState === 'menu') {
    return _react_runtime.default.createElement("div", {
      ref: rootRef,
      className: "flex flex-col items-center justify-center min-h-[640px] sm:min-h-[720px] bg-gradient-to-b from-blue-950 via-purple-900 to-indigo-900 w-full rounded-3xl shadow-2xl p-4 sm:p-6 text-center gap-3"
    }, _react_runtime.default.createElement("div", {
      className: "flex w-full items-center justify-between text-sm text-white/70"
    }, _react_runtime.default.createElement("div", null, "Tredje Advent"), _react_runtime.default.createElement("div", null, "Player: ", isBrowser && window.__defaultPlayerName__ ? window.__defaultPlayerName__ : 'Nisse')), songError && _react_runtime.default.createElement("p", {
      className: "text-red-200 text-sm"
    }, songError), loadingSongs && _react_runtime.default.createElement("p", {
      className: "text-white/70 text-sm"
    }, "Loading songs\u2026"), _react_runtime.default.createElement("button", {
      onClick: startGame,
      disabled: !songsReady,
      className: `px-10 py-4 bg-yellow-500 text-red-900 font-bold text-xl rounded-lg shadow-lg transform transition ${songsReady ? 'hover:bg-yellow-400 hover:scale-105' : 'opacity-60 cursor-not-allowed'}`
    }, "START"));
  }

  /* istanbul ignore next */
  if (gameState === 'ended') {
    const isVictory = progressionIndex >= _jingle_bell_hero_chart.PROGRESSION.length - 1 && lives > 0;
    return _react_runtime.default.createElement("div", {
      className: "flex flex-col items-center justify-center min-h-[640px] bg-gradient-to-b from-red-900 via-green-900 to-red-900 rounded-3xl shadow-2xl p-8 text-center space-y-4"
    }, _react_runtime.default.createElement("h1", {
      className: "text-4xl font-bold text-yellow-300"
    }, isVictory ? '🎉 Victory! 🎉' : 'Game Over!'), _react_runtime.default.createElement("p", {
      className: "text-2xl text-white"
    }, "Final Score: ", score), _react_runtime.default.createElement("p", {
      className: "text-lg text-gray-200"
    }, "Reached Level ", Math.min(progressionIndex + 1, _jingle_bell_hero_chart.PROGRESSION.length), " of ", _jingle_bell_hero_chart.PROGRESSION.length), _react_runtime.default.createElement("button", {
      onClick: resetGame,
      className: "px-8 py-3 bg-yellow-500 hover:bg-yellow-400 text-red-900 font-bold text-xl rounded-lg shadow-lg"
    }, "BACK TO MENU"));
  }

  const noteElements = sustainedNotesRef.current.map((note, idx) => {
    if (completedNotesRef.current.has(idx)) return null;
    const laneX = getLaneX(note.lane);
    const startY = _jingle_bell_hero_core.HIT_ZONE_Y - (note.startTime - currentTime) * _jingle_bell_hero_core.SCROLL_SPEED;
    const endY = _jingle_bell_hero_core.HIT_ZONE_Y - (note.endTime - currentTime) * _jingle_bell_hero_core.SCROLL_SPEED;
    if (startY < -200 || startY > VIEW_HEIGHT + 400) return null;
    const isStartHit = playedNotesRef.current.has(idx);
    const isHeld = heldNotesRef.current.has(idx);
    if (note.isSustained) {
      const actualStartY = isStartHit ? _jingle_bell_hero_core.HIT_ZONE_Y : startY;
      const clampedEndY = Math.max(0, Math.min(endY, _jingle_bell_hero_core.HIT_ZONE_Y));
      return _react_runtime.default.createElement("g", {
        key: `note-${idx}`,
        className: "pointer-events-none"
      }, _react_runtime.default.createElement("line", {
        x1: laneX,
        y1: clampedEndY,
        x2: laneX,
        y2: actualStartY,
        stroke: isHeld ? '#22c55e' : '#fbbf24',
        strokeWidth: "8",
        opacity: isHeld ? 0.8 : 1
      }), endY <= _jingle_bell_hero_core.HIT_ZONE_Y && _react_runtime.default.createElement("circle", {
        cx: laneX,
        cy: clampedEndY,
        r: "14",
        fill: isHeld ? '#22c55e' : '#fbbf24',
        stroke: "#000",
        strokeWidth: "2"
      }), !isStartHit && _react_runtime.default.createElement("circle", {
        cx: laneX,
        cy: startY,
        r: "14",
        fill: "#fbbf24",
        stroke: "#000",
        strokeWidth: "2"
      }));
    }
    return _react_runtime.default.createElement("circle", {
      key: `note-${idx}`,
      cx: laneX,
      cy: startY,
      r: "18",
      fill: "#fbbf24",
      stroke: "#000",
      strokeWidth: "3",
      className: "pointer-events-none"
    });
  }).filter(Boolean);
  const hitLine = _react_runtime.default.createElement("line", {
    key: "hit-line",
    x1: "0",
    y1: _jingle_bell_hero_core.HIT_ZONE_Y,
    x2: VIEW_WIDTH,
    y2: _jingle_bell_hero_core.HIT_ZONE_Y,
    stroke: "#fff",
    strokeWidth: "6",
    opacity: "0.8"
  });
  const svgChildren = [...noteElements, hitLine, ...bellNodes];
  /* istanbul ignore next */
  return _react_runtime.default.createElement("div", {
    ref: rootRef,
    className: "relative w-full min-h-[640px] sm:min-h-[720px] bg-gradient-to-b from-blue-900 via-purple-900 to-indigo-900 overflow-hidden rounded-3xl shadow-2xl"
  }, _react_runtime.default.createElement("div", {
    className: "absolute top-4 left-4 text-white z-10 space-y-1"
  }, _react_runtime.default.createElement("div", {
    className: "text-3xl font-bold"
  }, "Score: ", score), _react_runtime.default.createElement("div", {
    className: "text-2xl"
  }, "Combo: ", combo, "x"), _react_runtime.default.createElement("div", {
    className: "text-2xl"
  }, "Lives: ", '❤️'.repeat(lives) || '💔'), missStreak > 0 && _react_runtime.default.createElement("div", {
    className: "text-xl text-red-400"
  }, "Miss Streak: ", missStreak, "/4"), _react_runtime.default.createElement("div", {
    className: "text-xl text-yellow-300 mt-2"
  }, "Level ", progressionIndex + 1, "/", _jingle_bell_hero_chart.PROGRESSION.length), _react_runtime.default.createElement("div", {
    className: "text-md text-gray-300"
  }, _jingle_bell_hero_chart.DIFFICULTIES[_jingle_bell_hero_chart.PROGRESSION[progressionIndex].difficulty].speeds[_jingle_bell_hero_chart.PROGRESSION[progressionIndex].speedIndex].name)), _react_runtime.default.createElement("div", {
    className: "absolute top-4 right-4 text-white z-10 text-[10px] bg-black/30 px-2 py-1 rounded"
  }, "Notes: ", debugStats.visibleNotes, debugStats.sampleY.length ? ` y=${debugStats.sampleY[0].start.toFixed(1)}` : '', _react_runtime.default.createElement("div", null, "Songs: ", debugStats.loadedSongs.join(',') || '—'), songError && _react_runtime.default.createElement("div", {
    className: "text-red-200"
  }, songError)), _react_runtime.default.createElement("div", {
    className: "relative w-full h-full"
  }, _react_runtime.default.createElement("svg", {
    className: "absolute inset-0 w-full h-full",
    viewBox: `0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`,
    preserveAspectRatio: "xMidYMid meet"
  }, svgChildren)));
}
if (typeof document !== 'undefined') {
  const mount = () => {
    const el = document.getElementById('jingle-bell-hero-root');
    if (el && !el.__jingleBellHeroRoot__) {
      const root = createRoot(el);
      el.__jingleBellHeroRoot__ = root;
      root.render(_react_runtime.default.createElement(JingleBellHero, null));
    }
  };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount);
  } else {
    mount();
  }
}
