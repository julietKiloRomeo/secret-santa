export const MAX_LIVES = 3;
export const HIT_ZONE_Y = 500;
export const SCROLL_SPEED = 200;
export const HIT_TOLERANCE = 50;
export const READY_TIME = 2.0;

const PITCH_MAP = {
  c: 0,
  'c#': 1,
  db: 1,
  d: 2,
  'd#': 3,
  eb: 3,
  e: 4,
  f: 5,
  'f#': 6,
  gb: 6,
  g: 7,
  'g#': 8,
  ab: 8,
  a: 9,
  'a#': 10,
  bb: 10,
  b: 11,
};

export function pitchToFreq(note) {
  const match = note.match(/([a-gA-G][#b]?)(\d+)/);
  if (!match) {
    return 440;
  }
  const [, pitch, octaveStr] = match;
  const base = PITCH_MAP[pitch.toLowerCase()];
  const octave = parseInt(octaveStr, 10);
  const midi = 12 * (octave + 1) + base;
  return 440 * 2 ** ((midi - 69) / 12);
}

export function addFrequencies(events) {
  return events.map((event) => ({
    ...event,
    notes: event.notes.map((note) => ({
      ...note,
      freq: pitchToFreq(note.pitch),
    })),
  }));
}

export function processTiedNotes(events) {
  const sustained = [];
  const active = {};

  for (const event of events) {
    const currentTime = event.time;
    for (const note of event.notes) {
      const key = `${note.pitch}-${note.lane}`;
      if (note.tied) {
        if (!active[key]) {
          active[key] = { ...note, startTime: currentTime };
        }
      } else if (active[key]) {
        sustained.push({
          startTime: active[key].startTime,
          endTime: currentTime,
          ...note,
          isSustained: true,
        });
        delete active[key];
      } else {
        sustained.push({
          startTime: currentTime,
          endTime: currentTime,
          ...note,
          isSustained: false,
        });
      }
    }
  }
  return sustained;
}

export class AudioPlayer {
  constructor() {
    this.ctx = null;
  }

  ensureCtx() {
    if (!this.ctx && typeof window !== 'undefined') {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (Ctx) {
        this.ctx = new Ctx();
      }
    }
    return this.ctx;
  }

  playNote(freq, duration = 0.3) {
    const ctx = this.ensureCtx();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    osc.connect(gain);
    gain.connect(ctx.destination);
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
    osc.start();
    osc.stop(ctx.currentTime + duration);
  }
}
