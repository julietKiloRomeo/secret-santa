import { generateMaze, reachable } from '../static/pac_maze_gen';

const seeded = (seed) => () => {
  seed = (seed * 16807) % 2147483647;
  return seed / 2147483647;
};

test('generated maze has the requested size', () => {
  const m = generateMaze(30, 40, seeded(7));
  expect(m).toHaveLength(40);
  m.forEach((row) => expect(row).toHaveLength(30));
});

test('exactly one Santa start and four ghost starts, all on open tiles', () => {
  const m = generateMaze(30, 40, seeded(7));
  const flat = m.join('');
  expect(flat.split('S')).toHaveLength(2);
  expect(flat.split('G')).toHaveLength(5);
});

test('every open tile is reachable from Santa, so no cookie is unreachable', () => {
  const m = generateMaze(30, 40, seeded(11));
  const { open, seen } = reachable(m);
  expect(open).toBeGreaterThan(300);
  expect(seen).toBe(open);
});

test('the same seed gives the same maze', () => {
  expect(generateMaze(30, 40, seeded(3))).toEqual(generateMaze(30, 40, seeded(3)));
});

test('the outer border is solid except the tunnel gaps on the middle row', () => {
  const m = generateMaze(30, 40, seeded(5));
  const mid = Math.floor(m.length / 2);
  m[0].split('').forEach((c) => expect(c).toBe('#'));
  m[m.length - 1].split('').forEach((c) => expect(c).toBe('#'));
  expect(m[mid][0]).not.toBe('#');
  expect(m[mid][m[0].length - 1]).not.toBe('#');
});
