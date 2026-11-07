import { LEVELS, WORLD } from '../static/bauble_levels';

test('each level has one bauble at the end of its rope and a stocking below it', () => {
  for (const l of LEVELS) {
    expect(l.ropes.length).toBeGreaterThan(0);
    for (const r of l.ropes) {
      const end = { x: r.peg.x, y: r.peg.y + r.length };
      expect(l.baubles.some((b) => Math.hypot(b.x - end.x, b.y - end.y) < 1)).toBe(true);
    }
    expect(l.stocking.y).toBeGreaterThan(l.baubles[0].y);
    expect(l.stocking.x).toBeGreaterThan(0);
    expect(l.stocking.x).toBeLessThan(WORLD.width);
  }
});

test('every level has a cut solution whose swipes start and end inside the world', () => {
  for (const l of LEVELS) {
    expect(l.solution.length).toBeGreaterThan(0);
    for (const s of l.solution) {
      for (const p of [s.from, s.to]) {
        expect(p.x).toBeGreaterThanOrEqual(0);
        expect(p.x).toBeLessThanOrEqual(WORLD.width);
        expect(p.y).toBeGreaterThanOrEqual(0);
        expect(p.y).toBeLessThanOrEqual(WORLD.height);
      }
    }
  }
});

test('level names are unique', () => {
  expect(new Set(LEVELS.map((l) => l.name)).size).toBe(LEVELS.length);
});
