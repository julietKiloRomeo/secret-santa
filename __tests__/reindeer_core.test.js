import { createRun, tick, jump, duck, dash, STEP, REINDEER_X, jumpHeight, speedFor } from '../static/reindeer_core';

const W = 640;
const H = 260;

// Advance the simulation by simulated seconds.
const run = (r, seconds) => {
  for (let i = 0; i < seconds / STEP; i++) {
    tick(r, STEP);
    if (r.state === 'dead') break;
  }
  return r;
};

test('the reindeer starts on the ground and a jump leaves it', () => {
  const r = createRun({ width: W, height: H, rand: () => 0.5 });
  expect(r.grounded).toBe(true);
  jump(r);
  run(r, 0.1);
  expect(r.y).toBeLessThan(r.groundY - 20);
});

test('a held jump is higher than a tap', () => {
  expect(jumpHeight(true)).toBeGreaterThan(jumpHeight(false));
});

test('the reindeer lands back on the ground after a jump', () => {
  const r = createRun({ width: W, height: H, rand: () => 0.5 });
  jump(r);
  run(r, 1.2);
  expect(r.grounded).toBe(true);
  expect(r.y).toBeCloseTo(r.groundY, 0);
});

test('speed rises with distance and is capped', () => {
  expect(speedFor(0)).toBeLessThan(speedFor(500));
  expect(speedFor(100000)).toBe(speedFor(1e9));
});

test('a dash is not a free escape: it is only possible off cooldown', () => {
  const r = createRun({ width: W, height: H, rand: () => 0.5 });
  jump(r);
  dash(r);
  const cooldown = r.dashCooldown;
  dash(r);
  expect(r.dashCooldown).toBe(cooldown);
});

test('a bot that jumps one airtime before each gap survives 9 seconds of gaps', () => {
  // A held jump is airborne for about 0.73s, so the bot leaves the ground when the next gap or
  // snowman is that far ahead. The rule is the test: if this bot dies, the rules are unfair.
  const AIRTIME = 0.73;
  const r = createRun({ width: W, height: H, rand: () => 0.5 });
  jump(r, true);
  let steps = 0;
  while (r.state !== 'dead' && steps < 9 / STEP) {
    const lead = AIRTIME * r.speed;
    const gapAhead = r.platforms.find((p) => p.x > REINDEER_X + 4 && p.x < REINDEER_X + lead);
    const landingEdge = r.platforms.find((p) => p.x <= REINDEER_X && p.x + p.w > REINDEER_X);
    const needsJump = gapAhead !== undefined && landingEdge !== undefined;
    if (r.grounded && needsJump) jump(r, true);
    tick(r, STEP);
    steps += 1;
  }
  expect(r.state).toBe('running');
});

test('a snowman is a real obstacle: running into one without a dash ends the run', () => {
  const r = createRun({ width: W, height: H, rand: () => 0.5 });
  jump(r);
  run(r, 0.1);
  r.snowmen.push({ x: REINDEER_X, w: 40, h: 60, alive: true });
  run(r, 0.05);
  expect(r.state).toBe('dead');
  expect(r.deathReason).toBe('snowman');
});

test('a ducked reindeer passes under a low snowman that a standing one hits', () => {
  // Design: a snowman is a low obstacle (40 design px) so ducking is a real answer.
  // Both runs are on the ground when the snowman arrives, so the only difference is the duck.
  const standing = createRun({ width: W, height: H, rand: () => 0.5 });
  jump(standing);
  for (let i = 0; i < 0.9 / STEP && standing.state === 'running'; i++) tick(standing, STEP);
  expect(standing.grounded).toBe(true);
  standing.snowmen.push({ x: REINDEER_X, w: 40 * standing.scale, h: 40 * standing.scale, alive: true });
  for (let i = 0; i < 0.1 / STEP; i++) tick(standing, STEP);
  expect(standing.state).toBe('dead');

  const ducked = createRun({ width: W, height: H, rand: () => 0.5 });
  jump(ducked);
  for (let i = 0; i < 0.9 / STEP && ducked.state === 'running'; i++) tick(ducked, STEP);
  expect(ducked.grounded).toBe(true);
  duck(ducked);
  ducked.snowmen.push({ x: REINDEER_X, w: 40 * ducked.scale, h: 40 * ducked.scale, alive: true });
  for (let i = 0; i < 0.1 / STEP; i++) tick(ducked, STEP);
  expect(ducked.state).toBe('running');
});

test('a taller world keeps the design physics scale when scale is passed explicitly', () => {
  const r = createRun({ width: 640, height: 400, scale: 1, rand: () => 0.5 });
  expect(r.scale).toBe(1);
  expect(r.maxGap).toBe(150);
});

test('without an explicit scale the physics scale follows the world height', () => {
  const r = createRun({ width: 640, height: 520, rand: () => 0.5 });
  expect(r.scale).toBe(2);
});
