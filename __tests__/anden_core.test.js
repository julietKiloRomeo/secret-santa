import {
  createRun,
  flap,
  step,
  gapSpan,
  levelFor,
  speedFor,
  leadHitbox,
  previewActive,
  TRAIL_LEN,
  CONFIG,
} from '../static/anden_core';

const W = 400;
const H = 800;
const DT = 1 / 60;

// Deterministic randomness: every gap sits at the same place unless overridden.
const fixed = (v) => () => v;

const run = (opts = {}) => createRun({ width: W, height: H, rand: fixed(0.5), ...opts });

describe('createRun', () => {
  test('starts in grace with the bird at mid-height and no chimneys', () => {
    const r = run();
    expect(r.state).toBe('grace');
    expect(r.y).toBe(H / 2);
    expect(r.chimneys).toEqual([]);
    expect(r.score).toBe(0);
    expect(r.graceLeft).toBeCloseTo(CONFIG.graceMs);
  });

  test('scale follows the canvas width relative to 400px', () => {
    expect(run({ width: 800, height: 1600 }).scale).toBe(2);
  });
});

describe('physics', () => {
  test('nothing moves during grace, not even the bird', () => {
    const r = run();
    step(r, DT);
    expect(r.y).toBe(H / 2);
    expect(r.vy).toBe(0);
  });

  test('gravity pulls down once grace is over and a flap lifts the bird', () => {
    const r = run();
    r.graceLeft = 0;
    r.state = 'playing';
    step(r, DT);
    expect(r.vy).toBeGreaterThan(0);
    flap(r);
    expect(r.vy).toBeLessThan(0);
  });

  test('first flap during grace ends grace immediately so the bird lifts at once', () => {
    const r = run();
    flap(r);
    expect(r.state).toBe('playing');
    expect(r.graceLeft).toBe(0);
    expect(r.vy).toBeLessThan(0);
  });
});

describe('gap and spawning', () => {
  test('gap size is a fraction of width with a minimum', () => {
    expect(run().gap).toBeCloseTo(Math.max(CONFIG.gapMin, W * CONFIG.gapRatio));
  });

  test('a chimney spawns on the right edge after the spawn interval', () => {
    const r = run();
    r.graceLeft = 0;
    r.state = 'playing';
    r.sinceSpawn = CONFIG.spawnIntervalMs - 1;
    step(r, DT);
    expect(r.chimneys).toHaveLength(1);
    expect(r.chimneys[0].x).toBeGreaterThan(W - 50);
  });

  test('gap top stays inside the playfield for any random roll', () => {
    for (const roll of [0, 0.5, 0.999]) {
      const r = run({ rand: fixed(roll) });
      expect(r.gapPlan).toBeGreaterThanOrEqual(30);
      expect(r.gapPlan).toBeLessThanOrEqual(30 + gapSpan(r));
    }
  });
});

describe('scoring and levels', () => {
  test('passing a chimney adds one point exactly once', () => {
    const r = run();
    r.graceLeft = 0;
    r.state = 'playing';
    r.chimneys.push({ x: r.leadX - 60, top: 200, passed: false });
    step(r, DT);
    step(r, DT);
    expect(r.score).toBe(1);
  });

  test('levels change at 25 and 50 points', () => {
    expect(levelFor(0)).toBe(1);
    expect(levelFor(24)).toBe(1);
    expect(levelFor(25)).toBe(2);
    expect(levelFor(49)).toBe(2);
    expect(levelFor(50)).toBe(3);
  });

  test('speed rises with score', () => {
    expect(speedFor(10, 1)).toBeGreaterThan(speedFor(0, 1));
  });
});

describe('collisions', () => {
  test('hitting the ceiling or floor ends the run', () => {
    const r = run();
    r.graceLeft = 0;
    r.state = 'playing';
    r.y = 2;
    r.vy = -500;
    step(r, DT);
    expect(r.state).toBe('dead');
  });

  test('passing through a gap is safe, touching a chimney is not', () => {
    const r = run();
    r.graceLeft = 0;
    r.state = 'playing';
    const hb = leadHitbox(r);
    r.chimneys.push({ x: r.leadX - hb.half, top: r.y - r.gap / 2, passed: false });
    step(r, 0);
    expect(r.state).toBe('playing');

    r.chimneys[0] = { x: r.leadX - hb.half, top: r.y + 10, passed: false };
    step(r, 0);
    expect(r.state).toBe('dead');
  });

  test('hitbox is the visible reindeer size scaled by config', () => {
    const r = run();
    expect(leadHitbox(r).half).toBeCloseTo((r.birdW * CONFIG.reindeerHitBoxScale) / 2);
  });
});

describe('reindeer trail', () => {
  test('keeps one y per frame so the trailing reindeer follow the lead with a delay', () => {
    const r = run();
    r.graceLeft = 0;
    r.state = 'playing';
    r.vy = 300; // falling, so each frame's y differs from the last
    for (let i = 0; i < 20; i += 1) step(r, DT);
    expect(r.trail).toHaveLength(TRAIL_LEN);
    expect(r.trail[0]).toBe(r.y);
    expect(r.trail[8]).toBeLessThan(r.trail[0]); // 8 frames ago the bird was higher
  });
});

describe('gap preview', () => {
  test('level 1 never previews the next gap', () => {
    const r = run();
    r.graceLeft = 0;
    r.state = 'playing';
    r.sinceSpawn = CONFIG.spawnIntervalMs - 100;
    expect(previewActive(r)).toBe(false);
  });

  test('level 2 previews the gap 1s before it spawns', () => {
    const r = run();
    r.score = CONFIG.levelTwoScore;
    r.sinceSpawn = 0;
    expect(previewActive(r)).toBe(false);
    r.sinceSpawn = CONFIG.spawnIntervalMs - 1000;
    expect(previewActive(r)).toBe(true);
  });

  test('level 3 always previews', () => {
    const r = run();
    r.score = CONFIG.levelThreeScore;
    r.sinceSpawn = 0;
    expect(previewActive(r)).toBe(true);
  });
});
