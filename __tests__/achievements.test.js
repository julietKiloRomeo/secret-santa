import { ACHIEVEMENTS, newlyUnlocked, loadUnlocked, saveUnlocked } from '../static/achievements';

const stats = (over = {}) => ({ gifts: 0, saves: 0, powerups: 0, score: 0, saveStreak: 0, ...over });

test('there are several achievements, each with a name, a snarky line and an unlock rule', () => {
  expect(ACHIEVEMENTS.length).toBeGreaterThanOrEqual(5);
  for (const a of ACHIEVEMENTS) {
    expect(a.id).toMatch(/^[a-z-]+$/);
    expect(a.name.length).toBeGreaterThan(0);
    expect(a.snark.length).toBeGreaterThan(10);
    expect(typeof a.check).toBe('function');
  }
});

test('an achievement unlocks when its rule is met, and only once', () => {
  const have = new Set();
  const first = newlyUnlocked(stats({ gifts: 1 }), have);
  expect(first.map((a) => a.id)).toContain('first-present');
  for (const a of first) have.add(a.id);
  expect(newlyUnlocked(stats({ gifts: 1 }), have).map((a) => a.id)).not.toContain('first-present');
});

test('the streak achievement needs five saves in a row', () => {
  const have = new Set();
  expect(newlyUnlocked(stats({ saveStreak: 4 }), have).map((a) => a.id)).not.toContain('five-lives');
  expect(newlyUnlocked(stats({ saveStreak: 5 }), have).map((a) => a.id)).toContain('five-lives');
});

test('unlocked achievements are kept per player, and survive a reload', () => {
  const store = new Map();
  const storage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) };
  saveUnlocked(storage, 'Jimmy', new Set(['first-present']));
  expect([...loadUnlocked(storage, 'Jimmy')]).toEqual(['first-present']);
  expect([...loadUnlocked(storage, 'Ditte')]).toEqual([]);
});

test('a broken stored value does not crash the game', () => {
  const storage = { getItem: () => '{not json', setItem: () => {} };
  expect([...loadUnlocked(storage, 'Jimmy')]).toEqual([]);
});
