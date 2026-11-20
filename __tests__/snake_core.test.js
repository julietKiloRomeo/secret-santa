import {
  createSnake,
  step,
  turn,
  swipeDir,
  nextSkin,
  GIFTS,
  tickMsFor,
  SPEED_START_MS,
  SPEED_MIN_MS,
} from '../static/snake_core';

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

test('moving into the cell the tail is leaving is allowed, not a self-collision', () => {
  // A 2x2 loop: head at (5,5) moving down into (5,6), with the tail at (5,6) moving away this tick.
  const s = createSnake(20, 20, Math.random);
  s.body = [
    { x: 5, y: 5 },
    { x: 4, y: 5 },
    { x: 4, y: 6 },
    { x: 5, y: 6 },
  ];
  s.dir = 'down';
  s.pending = 'down';
  s.gift = { x: 0, y: 0, skin: '🍪' };
  expect(step(s, Math.random)).toBe('moved');
  expect(s.alive).toBe(true);
});

test('two quick turns cannot reverse the snake into its own neck', () => {
  // Moving right; queue up, then left before the next tick. Left is the reverse of right, so it must be ignored.
  const s = createSnake(20, 20, Math.random);
  turn(s, 'up');
  turn(s, 'left');
  step(s, Math.random);
  expect(s.alive).toBe(true);
  expect(s.dir).not.toBe('left');
});

test('two quick turns in one tick are both applied, one per tick', () => {
  // Moving right: up then left arrive before the next tick. The old single slot dropped "up".
  const s = createSnake(20, 20, Math.random);
  turn(s, 'up');
  turn(s, 'left');
  step(s, Math.random);
  expect(s.dir).toBe('up');
  step(s, Math.random);
  expect(s.dir).toBe('left');
  expect(s.alive).toBe(true);
});

test('the turn queue holds at most two inputs; extra presses are dropped', () => {
  const s = createSnake(20, 20, Math.random);
  turn(s, 'up');
  turn(s, 'left');
  turn(s, 'down');
  step(s, Math.random); // up
  step(s, Math.random); // left
  expect(s.dir).toBe('left');
  expect(s.queue).toEqual([]);
});

test('a reverse is judged against the last applied direction, not the queued one', () => {
  // Moving right. Up is applied first; down is the reverse of up, so it is refused even though it was queued.
  const s = createSnake(20, 20, Math.random);
  turn(s, 'up');
  turn(s, 'down');
  step(s, Math.random);
  step(s, Math.random);
  expect(s.dir).toBe('up');
  expect(s.alive).toBe(true);
});

test('tick time gets faster with score, never below the floor', () => {
  expect(tickMsFor(0)).toBe(SPEED_START_MS);
  expect(tickMsFor(5)).toBeLessThan(tickMsFor(0));
  expect(tickMsFor(5)).toBeGreaterThan(tickMsFor(6));
  expect(tickMsFor(10_000)).toBe(SPEED_MIN_MS);
});

test('feedback tiers keep pickup below death in strength and freeze length', async () => {
  // game-feel tiers: pickup = medium, death = large. Hit-stop stays under 0.15 s.
  const { FEEL } = await import('../static/snake_feel.js');
  expect(FEEL.pickup.stopMs).toBeGreaterThanOrEqual(40);
  expect(FEEL.pickup.stopMs).toBeLessThanOrEqual(60);
  expect(FEEL.death.trauma).toBeGreaterThan(FEEL.pickup.trauma ?? 0);
  expect(FEEL.death.trauma).toBeGreaterThanOrEqual(0.7);
  expect(FEEL.death.stopMs).toBeLessThanOrEqual(150);
  expect(FEEL.pickup.burstCount).toBeGreaterThanOrEqual(8);
});
