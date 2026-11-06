import {
  createGame,
  press,
  release,
  update,
  judge,
  HIT_WINDOW,
  RELEASE_WINDOW,
  MAX_LIVES,
  MISS_LIMIT,
} from '../static/jingle_bell_rules';

// A tap note on lane 1 at t=1s, a sustained note on lane 2 from t=2s to t=3s.
const notes = () => [
  { id: 'a', lane: 1, start: 1, end: 1, sustained: false },
  { id: 'b', lane: 2, start: 2, end: 3, sustained: true },
];

describe('judge', () => {
  test('timing bands: perfect near the beat, good, then ok inside the window', () => {
    expect(judge(0)).toEqual({ label: 'PERFECT!', points: 150 });
    expect(judge(HIT_WINDOW * 0.5)).toEqual({ label: 'GOOD', points: 110 });
    expect(judge(HIT_WINDOW * 0.9)).toEqual({ label: 'OK', points: 80 });
  });
});

describe('tap notes', () => {
  test('hitting a tap note inside the window scores and advances the combo', () => {
    const g = createGame(notes());
    update(g, 1.0);
    press(g, 1);
    expect(g.score).toBe(150);
    expect(g.combo).toBe(1);
    expect(g.lives).toBe(MAX_LIVES);
  });

  test('a press on an empty lane is a miss and costs a life only after the miss limit', () => {
    const g = createGame(notes());
    update(g, 0.1);
    for (let i = 0; i < MISS_LIMIT; i += 1) press(g, 3);
    expect(g.lives).toBe(MAX_LIVES - 1);
    expect(g.combo).toBe(0);
  });

  test('a note that passes unhit counts as a miss', () => {
    const g = createGame(notes());
    update(g, 1 + HIT_WINDOW + 0.01);
    expect(g.missStreak).toBe(1);
    expect(g.played.has('a')).toBe(true);
  });

  test('losing all lives ends the game', () => {
    const g = createGame([]);
    for (let i = 0; i < MAX_LIVES * MISS_LIMIT; i += 1) press(g, 4);
    expect(g.state).toBe('over');
    expect(g.lives).toBe(0);
  });
});

describe('sustained notes', () => {
  test('pressing starts a hold and releasing near the end scores a release', () => {
    const g = createGame(notes());
    update(g, 2.0);
    press(g, 2);
    expect(g.holding.has('b')).toBe(true);
    update(g, 3.0);
    release(g, 2);
    expect(g.holding.has('b')).toBe(false);
    expect(g.score).toBeGreaterThan(0);
  });

  test('releasing far from the end is a miss', () => {
    const g = createGame(notes());
    update(g, 2.0);
    press(g, 2);
    update(g, 2.5);
    release(g, 2);
    expect(g.missStreak).toBeGreaterThan(0);
  });
});

describe('progression', () => {
  test('the game advances to the next level after the last note of a song', () => {
    const g = createGame(notes(), { level: 0 });
    update(g, 10);
    expect(g.state).toBe('levelDone');
  });
});

describe('edge cases', () => {
  test('a sustained note that is never pressed is one miss, not two', () => {
    const g = createGame([{ id: 'b', lane: 2, start: 2, end: 3, sustained: true }]);
    update(g, 2 + HIT_WINDOW + 0.01);
    expect(g.missStreak).toBe(1);
    update(g, 3 + RELEASE_WINDOW + 0.01);
    expect(g.missStreak).toBe(1); // still one miss: the held note was already judged
  });

  test('the level is not done while a hold is still in progress', () => {
    const g = createGame([{ id: 'b', lane: 2, start: 2, end: 3, sustained: true }]);
    update(g, 2);
    press(g, 2);
    update(g, 3);
    expect(g.state).toBe('playing');
  });
});
