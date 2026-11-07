import { LEVELS, WORLD } from '../static/bauble_levels';

test('level 1 is one rope hanging a bauble above a stocking, with no other pieces', () => {
  const l = LEVELS[0];
  expect(l.ropes).toHaveLength(1);
  expect(l.ropes[0].peg.x).toBeCloseTo(l.baubles[0].x);
  expect(l.stocking.y).toBeGreaterThan(l.baubles[0].y);
  expect(l.walls).toEqual([]);
});

test('every level has a bauble inside the world and a stocking below it', () => {
  for (const l of LEVELS) {
    for (const b of l.baubles) {
      expect(b.x).toBeGreaterThan(0);
      expect(b.x).toBeLessThan(WORLD.width);
      expect(b.y).toBeGreaterThan(0);
      expect(b.y).toBeLessThan(WORLD.height);
    }
    expect(l.stocking.x).toBeGreaterThan(0);
    expect(l.stocking.x).toBeLessThan(WORLD.width);
    expect(l.stocking.y).toBeLessThan(WORLD.height);
  }
});

test('level names are unique', () => {
  expect(new Set(LEVELS.map((l) => l.name)).size).toBe(LEVELS.length);
});
