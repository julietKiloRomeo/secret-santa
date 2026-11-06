// Jingle Bell Hero rules: scoring, timing and lives. No rendering, no audio, so Jest can test it.
// Times are seconds on the song clock. Notes: { id, lane, start, end, sustained, freq }.
import { DIFFICULTIES, PROGRESSION } from './jingle_bell_hero_chart.js';
import {
  addFrequencies,
  processTiedNotes,
  READY_TIME,
  HIT_TOLERANCE,
  SCROLL_SPEED,
  MAX_LIVES,
} from './jingle_bell_hero_core.js';

// Which song each level plays. Levels past the list repeat the last song at a faster speed.
const LEVEL_SONGS = [
  'partridge-1',
  'partridge-1',
  'partridge-2',
  'partridge-2',
  'partridge-3',
  'partridge-3',
];
const ENDLESS_BOOST = 0.08; // extra speed per level past the progression
// 70px at 220px/s scroll speed: about 0.318s either side of the beat.
export const HIT_WINDOW = HIT_TOLERANCE / SCROLL_SPEED;
export const RELEASE_WINDOW = HIT_WINDOW * 1.2;
export const MISS_LIMIT = 4; // this many misses in a row costs one life
export { MAX_LIVES };

export const judge = (delta) => {
  const d = Math.abs(delta);
  if (d <= HIT_WINDOW * 0.35) return { label: 'PERFECT!', points: 150 };
  if (d <= HIT_WINDOW * 0.8) return { label: 'GOOD', points: 110 };
  return { label: 'OK', points: 80 };
};

export function createGame(notes, { level = 0 } = {}) {
  return {
    notes,
    level,
    state: 'playing', // playing -> levelDone | over
    time: 0,
    score: 0,
    combo: 0,
    lives: MAX_LIVES,
    missStreak: 0,
    played: new Set(), // notes that are judged (hit, held or missed)
    holding: new Set(), // sustained notes currently pressed
    lastEvent: null, // { lane, text } for feedback
  };
}

function miss(g, lane, heavy = false) {
  g.combo = 0;
  g.lastEvent = { lane, text: 'MISS' };
  g.missStreak += heavy ? 2 : 1;
  if (g.missStreak >= MISS_LIMIT) {
    g.lives -= 1;
    g.missStreak = 0;
    if (g.lives <= 0) g.state = 'over';
  }
}

function hit(g, note, delta) {
  const { label, points } = judge(delta);
  g.score += points;
  g.combo += 1;
  g.missStreak = 0;
  g.lastEvent = { lane: note.lane, text: label };
}

// Advance the song clock. Notes that passed their window count as misses.
export function update(g, time) {
  if (g.state !== 'playing') return g;
  g.time = time;
  for (const note of g.notes) {
    if (g.played.has(note.id) || g.holding.has(note.id)) continue;
    if (time > note.start + HIT_WINDOW) {
      g.played.add(note.id);
      miss(g, note.lane);
    }
  }
  for (const id of g.holding) {
    const note = g.notes.find((n) => n.id === id);
    if (time > note.end + RELEASE_WINDOW) {
      g.holding.delete(id);
      g.played.add(id);
      miss(g, note.lane);
    }
  }
  if (g.notes.every((n) => g.played.has(n.id)) && g.state === 'playing') {
    g.state = 'levelDone';
  }
  return g;
}

// Press a lane. Picks the nearest unjudged note in that lane within the window.
export function press(g, lane) {
  if (g.state !== 'playing') return g;
  const candidates = g.notes
    .filter((n) => n.lane === lane && !g.played.has(n.id))
    .map((n) => ({ n, delta: g.time - n.start }))
    .filter(({ delta }) => Math.abs(delta) <= HIT_WINDOW)
    .sort((a, b) => Math.abs(a.delta) - Math.abs(b.delta));
  if (candidates.length === 0) {
    miss(g, lane);
    return g;
  }
  const { n, delta } = candidates[0];
  if (n.sustained) {
    g.holding.add(n.id);
    g.lastEvent = { lane, text: 'HOLD!' };
    return g;
  }
  g.played.add(n.id);
  hit(g, n, delta);
  return g;
}

export function release(g, lane) {
  if (g.state !== 'playing') return g;
  const id = [...g.holding].find((k) => g.notes.find((n) => n.id === k).lane === lane);
  if (!id) return g;
  const note = g.notes.find((n) => n.id === id);
  g.holding.delete(id);
  g.played.add(id);
  const delta = g.time - note.end;
  if (Math.abs(delta) <= RELEASE_WINDOW) {
    hit(g, note, delta);
    g.lastEvent = { lane, text: 'RELEASE!' };
  } else {
    miss(g, lane);
  }
  return g;
}

// Turn a loaded song chart into rule notes for one level.
export function prepareLevel(songs, levelIndex) {
  const last = PROGRESSION.length - 1;
  const { difficulty, speedIndex } = PROGRESSION[Math.min(levelIndex, last)];
  const speed = DIFFICULTIES[difficulty].speeds[speedIndex];
  const songId = LEVEL_SONGS[levelIndex] || LEVEL_SONGS[LEVEL_SONGS.length - 1];
  const chart = songs[songId] || [];
  // Early levels only use the first note of each event so they're easier to read.
  const trimmed =
    levelIndex < 2
      ? chart.map((e) => ({ ...e, notes: e.notes.slice(0, 1) })).filter((e) => e.notes.length)
      : chart;
  const boost = Math.max(0, levelIndex - last);
  const multiplier = speed.speedMultiplier * (1 + boost * ENDLESS_BOOST);
  const scaled = addFrequencies(trimmed).map((e) => ({ ...e, time: e.time / multiplier }));
  const notes = processTiedNotes(scaled).map((n, idx) => ({
    id: `${songId}-${idx}`,
    lane: n.lane,
    freq: n.freq,
    sustained: Boolean(n.isSustained),
    start: n.startTime + READY_TIME,
    end: n.endTime + READY_TIME,
  }));
  const label = `${speed.name}${boost ? ` x${multiplier.toFixed(2)}` : ''}`;
  return { notes, label };
}
