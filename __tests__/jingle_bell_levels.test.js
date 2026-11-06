import { prepareLevel } from '../static/jingle_bell_rules';
import { READY_TIME } from '../static/jingle_bell_hero_core';

const songs = {
  'partridge-1': [
    {
      time: 0,
      notes: [
        { pitch: 'c4', lane: 1, tied: false },
        { pitch: 'e4', lane: 3, tied: false },
      ],
    },
    { time: 1, notes: [{ pitch: 'd4', lane: 2, tied: true }] },
    { time: 2, notes: [{ pitch: 'd4', lane: 2, tied: false }] },
  ],
  'partridge-2': [
    {
      time: 0,
      notes: [
        { pitch: 'g4', lane: 4, tied: false },
        { pitch: 'a4', lane: 1, tied: false },
      ],
    },
    { time: 1, notes: [{ pitch: 'b4', lane: 2, tied: false }] },
  ],
  'partridge-3': [
    { time: 0, notes: [{ pitch: 'a4', lane: 1, tied: false }] },
    { time: 1, notes: [{ pitch: 'b4', lane: 2, tied: false }] },
  ],
};

describe('prepareLevel', () => {
  test('the first two levels only play the first note of each event', () => {
    const { notes } = prepareLevel(songs, 0);
    expect(notes.map((n) => n.lane)).toEqual([1, 2]); // lane 3 dropped
  });

  test('later levels keep every note of a multi-note event', () => {
    const { notes } = prepareLevel(songs, 2);
    expect(notes.map((n) => n.lane)).toEqual([4, 1, 2]); // both notes at time 0 are kept
  });

  test('notes are shifted by the ready time and sustained notes span start to end', () => {
    const { notes } = prepareLevel(songs, 0);
    expect(notes[0].start).toBeCloseTo(READY_TIME);
    const hold = notes.find((n) => n.sustained);
    expect(hold.end).toBeGreaterThan(hold.start);
  });

  test('note ids are unique and each note carries a frequency', () => {
    const { notes } = prepareLevel(songs, 0);
    expect(new Set(notes.map((n) => n.id)).size).toBe(notes.length);
    expect(notes.every((n) => n.freq > 0)).toBe(true);
  });

  test('endless levels after the progression speed up', () => {
    const last = prepareLevel(songs, 5);
    const beyond = prepareLevel(songs, 6);
    expect(beyond.label).toMatch(/x\d\.\d\d/);
    expect(last.label).not.toMatch(/x/);
    // Faster means notes arrive sooner after the ready time.
    expect(beyond.notes[1].start).toBeLessThan(last.notes[1].start);
  });
});
