import { LEVELS, WORLD } from '../static/bauble_levels';

test('there are six levels, each with a unique name', () => {
  expect(LEVELS).toHaveLength(6);
  expect(new Set(LEVELS.map((l) => l.name)).size).toBe(6);
});

test('every level has a bauble, a star and pieces inside the world', () => {
  for (const l of LEVELS) {
    expect(l.bauble.x).toBeGreaterThan(0);
    expect(l.bauble.x).toBeLessThan(WORLD.width);
    expect(l.bauble.y).toBeGreaterThan(0);
    expect(l.bauble.y).toBeLessThan(WORLD.height);
    expect(l.star.x).toBeGreaterThan(0);
    expect(l.star.x).toBeLessThan(WORLD.width);
    expect(l.star.y).toBeGreaterThan(l.bauble.y);
    expect(l.pieces.length).toBeGreaterThan(0);
    for (const p of l.pieces) {
      expect(['ramp', 'block', 'rope']).toContain(p.kind);
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.x).toBeLessThanOrEqual(WORLD.width);
      expect(p.y).toBeGreaterThanOrEqual(0);
      expect(p.y).toBeLessThanOrEqual(WORLD.height);
    }
  }
});

test('every piece says whether the player can move it, remove it or rotate it', () => {
  for (const l of LEVELS) {
    for (const p of l.pieces) {
      expect(typeof p.movable).toBe('boolean');
      expect(typeof p.removable).toBe('boolean');
    }
  }
});

test('the first level has no fixed pieces in the way: the player can solve it by removing one piece', () => {
  const removable = LEVELS[0].pieces.filter((p) => p.removable);
  expect(removable.length).toBeGreaterThanOrEqual(1);
});
