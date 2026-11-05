import { createSnake, step, turn, swipeDir, nextSkin, GIFTS } from '../static/snake_core';

const seq =
  (...vals) =>
  () =>
    vals.shift() ?? 0;

test('starts with 5 segments centred, heading right, gift off the snake', () => {
  const s = createSnake(20, 20, Math.random);
  expect(s.body).toHaveLength(5);
  expect(s.body[0]).toEqual({ x: 10, y: 10 });
  expect(s.dir).toBe('right');
  expect(s.body.some((p) => p.x === s.gift.x && p.y === s.gift.y)).toBe(false);
});

test('eating grows, scores and stores the gift as a body skin in order', () => {
  const s = createSnake(20, 20, Math.random);
  s.gift = { x: 11, y: 10, skin: '🍪' };
  expect(step(s, Math.random)).toBe('ate');
  expect(s.score).toBe(1);
  expect(s.body).toHaveLength(6);
  expect(s.skins).toEqual(['🍪']);
  s.gift = { x: 12, y: 10, skin: '🧦' };
  step(s, Math.random);
  expect(s.skins).toEqual(['🍪', '🧦']);
});

test('walls and self kill; reversing is ignored', () => {
  const s = createSnake(20, 20, Math.random);
  turn(s, 'left');
  step(s, Math.random);
  expect(s.dir).toBe('right');
  s.body[0].x = 19;
  expect(step(s, Math.random)).toBe('dead');
  expect(s.alive).toBe(false);
});

test('gift skins cycle through a shuffle bag before repeating', () => {
  const s = createSnake(20, 20, seq());
  const seen = [s.gift.skin];
  for (let i = 1; i < GIFTS.length; i += 1) seen.push(nextSkin(s, Math.random));
  expect(new Set(seen).size).toBe(GIFTS.length);
});

test('swipe needs 24px and picks the dominant axis', () => {
  expect(swipeDir(10, 5)).toBe(null);
  expect(swipeDir(30, 5)).toBe('right');
  expect(swipeDir(-5, -40)).toBe('up');
});
