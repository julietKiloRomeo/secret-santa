import {
  createRun,
  tick,
  jump,
  duck,
  unduck,
  dash,
  jumpHeight,
  STEP,
  REINDEER_X,
  SNOWMAN_BONUS,
  LANDING_TOL,
} from '../static/reindeer_core';

const H = 260;
const run = (opts = {}) => createRun({ width: 640, height: H, rand: () => 0.5, ...opts });

// Advance by real milliseconds in fixed steps, like the view does.
const advance = (r, ms) => {
  for (let t = 0; t < ms; t += STEP * 1000) tick(r, STEP);
  return r;
};

// Jump whenever the next gap is close, so the run survives on the generated platforms.
const autoplay = (r, ms) => {
  for (let t = 0; t < ms && r.state !== 'dead'; t += STEP * 1000) {
    // Next platform that starts ahead of the reindeer; jump when it is close and we are on the ground.
    const next = r.platforms.find((p) => p.x > REINDEER_X);
    const gapAhead = next && next.x - REINDEER_X < r.width * 0.25;
    if (r.grounded && gapAhead) jump(r, true);
    tick(r, STEP);
  }
  return r;
};

describe('fixed-step simulation', () => {
  test('one step is 1/60s and time accumulates in seconds', () => {
    expect(STEP).toBeCloseTo(1 / 60);
    const r = run();
    jump(r); // the first press starts the run
    tick(r, STEP);
    expect(r.time).toBeCloseTo(STEP);
  });

  test('nothing moves before the first press', () => {
    const r = run();
    tick(r, 1);
    expect(r.time).toBe(0);
    expect(r.distance).toBe(0);
  });

  test('the run starts on the ground and moves forward', () => {
    const r = run();
    jump(r); // start the run on the first press
    advance(r, 500);
    expect(r.distance).toBeGreaterThan(0);
    expect(r.state).toBe('running');
  });

  test('frame rate does not change the outcome: same time in 60fps or 30fps steps', () => {
    const a = run();
    const b = run();
    jump(a);
    jump(b);
    for (let i = 0; i < 120; i += 1) tick(a, 1 / 60);
    for (let i = 0; i < 60; i += 1) tick(b, 1 / 30);
    expect(a.distance).toBeCloseTo(b.distance, 1);
    expect(a.y).toBeCloseTo(b.y, 1);
  });
});

describe('jumping', () => {
  test('a jump leaves the ground and gravity brings the reindeer back down', () => {
    const r = run();
    jump(r);
    advance(r, 100);
    expect(r.y).toBeLessThan(r.groundY);
    advance(r, 1500);
    expect(r.y).toBeCloseTo(r.groundY, 0);
    expect(r.grounded).toBe(true);
  });

  test('a single extra jump in the air is allowed (double jump) and no third', () => {
    const r = run();
    jump(r);
    advance(r, 150);
    jump(r);
    const vy = r.vy;
    jump(r);
    expect(r.vy).toBe(vy); // the third press does nothing
  });

  test('coyote time lets you still jump just after walking off a ledge', () => {
    const r = run();
    r.grounded = false;
    r.coyote = 0.05;
    r.y = r.groundY - 5;
    jump(r);
    expect(r.vy).toBeLessThan(0);
  });

  test('holding jump gives a higher arc than a tap', () => {
    expect(jumpHeight(true)).toBeGreaterThan(jumpHeight(false));
  });
});

describe('ducking', () => {
  test('ducking shrinks the hitbox from the top, releasing restores it', () => {
    const r = run();
    const standing = r.hitbox.h;
    duck(r);
    expect(r.hitbox.h).toBeLessThan(standing);
    unduck(r);
    expect(r.hitbox.h).toBe(standing);
  });
});

describe('dashing', () => {
  test('a dash speeds up travel and makes you invulnerable for a short time', () => {
    const r = run();
    jump(r);
    tick(r, STEP);
    const before = r.speed;
    dash(r);
    tick(r, STEP);
    expect(r.speed).toBeGreaterThan(before);
    expect(r.invulnerable).toBeGreaterThan(0);
  });

  test('dash has a cooldown', () => {
    const r = run();
    dash(r);
    const t = r.dashCooldown;
    dash(r);
    expect(r.dashCooldown).toBe(t);
  });
});

describe('snowmen', () => {
  const runningRun = () => {
    const r = run();
    jump(r);
    r.snowmen.length = 0;
    return r;
  };

  test('running into a snowman ends the run', () => {
    const r = runningRun();
    r.snowmen.push({ x: REINDEER_X + 10, w: 40, h: 60, alive: true });
    tick(r, STEP);
    expect(r.state).toBe('dead');
    expect(r.deathReason).toBe('snowman');
  });

  test('dashing through a snowman destroys it and adds bonus points', () => {
    const r = runningRun();
    r.snowmen.push({ x: REINDEER_X + 10, w: 40, h: 60, alive: true });
    dash(r);
    tick(r, STEP);
    expect(r.state).toBe('running');
    expect(r.snowmen).toHaveLength(0);
    expect(r.bonus).toBe(SNOWMAN_BONUS);
  });

  test('snowmen spawn only after the first stretch of running', () => {
    const r = runningRun();
    autoplay(r, 2000);
    expect(r.snowmen.length).toBe(0);
    autoplay(r, 10000);
    expect(r.state).not.toBe('ready');
    expect(r.snowmen.length + (r.snowmenSeen || 0)).toBeGreaterThan(0);
  });
});

describe('platforms and falling', () => {
  test('falling below the screen ends the run', () => {
    const r = run();
    jump(r);
    // Move every platform away from the reindeer so nothing catches it.
    for (const p of r.platforms) p.x -= 10000;
    advance(r, 3000);
    expect(r.state).toBe('dead');
    expect(r.deathReason).toBe('fell');
  });

  test('every gap is small enough to jump across from the platform before it', () => {
    const r = run();
    jump(r);
    advance(r, 40000);
    const ps = r.platforms;
    for (let i = 1; i < ps.length; i += 1) {
      const gap = ps[i].x - (ps[i - 1].x + ps[i - 1].w);
      expect(gap).toBeLessThanOrEqual(r.maxGap);
    }
  });

  test('landing on a platform inside the tolerance keeps the run alive', () => {
    const r = run();
    jump(r);
    r.platforms = [{ x: REINDEER_X - 20, y: r.groundY - 60, w: 200 }];
    r.y = r.groundY - 60 - r.hitbox.h + LANDING_TOL;
    r.vy = 0;
    advance(r, 300);
    expect(r.state).toBe('running');
  });
});

describe('score', () => {
  test('score is distance plus snowman bonus, both as whole points', () => {
    const r = run();
    jump(r);
    advance(r, 3000);
    expect(Number.isInteger(r.score)).toBe(true);
    expect(r.score).toBe(Math.floor(r.distance) + r.bonus);
  });
});
