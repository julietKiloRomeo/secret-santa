import {
  createSnake,
  step,
  turn,
  swipeDir,
  nextSkin,
  placeGift,
  GIFT_MIN_Y,
  GIFTS,
  tickMsFor,
  shouldStepNow,
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
  const start = s.skins.length; // the starting presents come first
  s.gift = { x: 11, y: 10, skin: '🍪' };
  expect(step(s, Math.random)).toBe('ate');
  expect(s.score).toBe(1);
  expect(s.body).toHaveLength(6);
  expect(s.skins.slice(start)).toEqual(['🍪']);
  s.gift = { x: 12, y: 10, skin: '🧦' };
  step(s, Math.random);
  expect(s.skins.slice(start)).toEqual(['🍪', '🧦']);
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
  s.bag = [];
  s.forcedSkin = null;
  const seen = [];
  for (let i = 0; i < GIFTS.length; i += 1) seen.push(nextSkin(s, Math.random));
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

test('the starting body is presents: one skin per body segment after the head', () => {
  const s = createSnake(20, 20, Math.random);
  expect(s.skins).toHaveLength(s.body.length - 1);
  s.skins.forEach((k) => expect(GIFTS).toContain(k));
});

test('a turn queued late in the tick can take effect early', () => {
  // Half a tick has passed; a turn pressed now should step the snake now instead of waiting.
  expect(shouldStepNow({ acc: 120, tick: 200, queued: 1 })).toBe(true);
  expect(shouldStepNow({ acc: 20, tick: 200, queued: 1 })).toBe(false);
  expect(shouldStepNow({ acc: 190, tick: 200, queued: 0 })).toBe(false);
});

test('the opening pace is slower than the old 150 ms tick', () => {
  expect(SPEED_START_MS).toBeGreaterThan(150);
});

test('gifts never spawn in the top row, which the HUD covers', () => {
  for (let i = 0; i < 300; i += 1) {
    const s = createSnake(20, 20, Math.random);
    placeGift(s, Math.random);
    expect(s.gift.y).toBeGreaterThanOrEqual(GIFT_MIN_Y);
  }
});

test('gift placement finishes on a nearly full board and picks the only free cell', () => {
  const s = createSnake(4, 3, () => 0.5);
  s.body = [];
  for (let y = 0; y < 3; y += 1) for (let x = 0; x < 4; x += 1) s.body.push({ x, y });
  s.body = s.body.filter((p) => !(p.x === 2 && p.y === 2)); // leave (2,2) free
  placeGift(s, () => 0.5);
  expect(s.gift).toMatchObject({ x: 2, y: 2 });
});

test('a completely full board leaves no gift instead of hanging', () => {
  const s = createSnake(4, 3, () => 0.5);
  s.body = [];
  for (let y = 0; y < 3; y += 1) for (let x = 0; x < 4; x += 1) s.body.push({ x, y });
  placeGift(s, () => 0.5);
  expect(s.gift).toBe(null);
});

test('the speed ramp is gentler: slower start, slower drop, higher floor', () => {
  expect(SPEED_START_MS).toBe(220);
  expect(SPEED_MIN_MS).toBe(90);
  // 3 ms per gift: a gift 10 in is still well above the floor, so the pace builds slowly.
  expect(tickMsFor(10)).toBe(190);
  expect(tickMsFor(10_000)).toBe(90);
});
