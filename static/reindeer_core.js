// Reindeer Rush rules: a fixed-step endless runner. The reindeer stays at REINDEER_X and the
// world scrolls past it. No rendering, no audio, so Jest can test it.
// Units: px for space, seconds for time. Everything scales with the canvas height via `scale`.
export const STEP = 1 / 60;
export const REINDEER_X = 80;
export const SNOWMAN_BONUS = 120;

const GRAVITY = 1800; // px/s^2
const JUMP_TAP = -560; // px/s
const JUMP_HOLD = -680; // higher arc when the button is held on takeoff
const DOUBLE_JUMP = -520;
const COYOTE = 0.12; // s after leaving a ledge you can still jump
const DASH_TIME = 0.26; // s of boosted travel
const DASH_COOLDOWN = 0.45; // s before the next dash
const DASH_BOOST = 2.2; // travel multiplier while dashing
const INVULN_TIME = 0.24; // s of snowman immunity after a dash starts
const FALL_MARGIN = 200; // px below the screen before a fall ends the run
const SNOWMAN_DELAY = 4.8; // s of running before the first snowman
const SNOWMAN_H = 40; // design px: lower than a standing reindeer, higher than a ducked one, so ducking is an answer
const DISTANCE_SCALE = 0.02; // points per px travelled (0.02 = 1 point per 50px)
export const LANDING_TOL = 6; // px: how far a foot may be below a platform top and still land

const HITBOX_STAND = { w: 36, h: 48 };
const HITBOX_DUCK = { w: 36, h: 28 };

export const jumpHeight = (held) => (held ? -JUMP_HOLD : -JUMP_TAP);

// Speed grows with distance and is capped; dashing multiplies it.
export const speedFor = (distance) => 440 + Math.min(620, distance * 0.15);

export function createRun({ width, height, scale = height / 260, rand = Math.random }) {
  const groundY = height * 0.7;
  const run = {
    width,
    height,
    scale,
    rand,
    state: 'ready', // ready -> running -> dead
    time: 0,
    distance: 0,
    bonus: 0,
    y: groundY,
    vy: 0,
    groundY,
    grounded: true,
    coyote: 0,
    doubleUsed: false,
    ducking: false,
    speed: 0,
    dashTimer: 0,
    dashCooldown: 0,
    invulnerable: 0,
    maxGap: 150 * scale,
    platforms: [],
    snowmen: [],
    nextSnowmanAt: SNOWMAN_DELAY,
    deathReason: null,
    get hitbox() {
      return this.ducking ? HITBOX_DUCK : HITBOX_STAND;
    },
    get score() {
      return Math.floor(this.distance) + this.bonus;
    },
  };
  // Start with a flat runway so the first jump always has something to land on.
  run.platforms.push({ x: REINDEER_X - 40, y: groundY, w: width * 2 });
  seedPlatforms(run);
  return run;
}

function seedPlatforms(run) {
  // If the list ever empties (e.g. every platform scrolled away), restart the chain from the reindeer.
  if (run.platforms.length === 0) run.platforms.push({ x: REINDEER_X, y: run.groundY, w: run.width });
  const edge = () => run.platforms[run.platforms.length - 1];
  while (edge().x + edge().w < run.width * 3) {
    const last = edge();
    const gap = run.maxGap * (0.3 + run.rand() * 0.6);
    const w = run.width * (0.25 + run.rand() * 0.2);
    const drift = (run.rand() - 0.5) * 60 * run.scale;
    const y = Math.min(run.groundY, Math.max(run.height * 0.35, last.y + drift));
    run.platforms.push({ x: last.x + last.w + gap, y, w });
  }
}

// Start the run on the first press. Later presses are handled by jump().
function ensureRunning(run) {
  if (run.state === 'ready') run.state = 'running';
}

export function jump(run, held = false) {
  if (run.state === 'dead') return;
  ensureRunning(run);
  if (run.grounded || run.coyote > 0) {
    run.vy = -jumpHeight(held) * run.scale;
    run.grounded = false;
    run.coyote = 0;
    return;
  }
  if (!run.doubleUsed) {
    run.vy = DOUBLE_JUMP * run.scale;
    run.doubleUsed = true;
  }
}

export function duck(run) {
  if (run.state === 'dead') return;
  run.ducking = true;
}

export function unduck(run) {
  run.ducking = false;
}

export function dash(run) {
  if (run.state === 'dead' || run.dashCooldown > 0) return;
  ensureRunning(run);
  run.dashTimer = DASH_TIME;
  run.dashCooldown = DASH_COOLDOWN;
  run.invulnerable = INVULN_TIME;
}

// The platform the reindeer is over, whose top is at or below the foot before this step.
function platformUnder(run, x, footBefore) {
  let best = null;
  for (const p of run.platforms) {
    if (x < p.x || x > p.x + p.w) continue;
    if (p.y + LANDING_TOL < footBefore) continue; // already above us, so it is not a landing
    if (!best || p.y < best.y) best = p;
  }
  return best;
}

function spawnSnowman(run) {
  const gap = run.width * (1.5 + run.rand() * 0.5);
  const last = run.snowmen[run.snowmen.length - 1];
  const x = Math.max(run.width + 40, last ? last.x + gap : run.width + 40);
  run.snowmen.push({ x, w: 40 * run.scale, h: SNOWMAN_H * run.scale, alive: true });
}

function scrollWorld(run, dx) {
  for (const p of run.platforms) p.x -= dx;
  for (const s of run.snowmen) s.x -= dx;
  run.platforms = run.platforms.filter((p) => p.x + p.w > -100);
  run.snowmen = run.snowmen.filter((s) => s.alive && s.x > -100);
  seedPlatforms(run);
}

// run.y is the foot line: the surface the reindeer stands on.
function hitsSnowman(run, s) {
  const hb = run.hitbox;
  const rw = hb.w * run.scale;
  const rh = hb.h * run.scale;
  const left = REINDEER_X - rw / 2;
  const top = run.y - rh;
  // The box overlaps the snowman's band when it is horizontally across it and spans the snowman's top:
  // its top is above that line and its foot is below it. A jump clears it (top and foot both above),
  // a duck passes under it (top below the line), and a standing reindeer is hit.
  const snowTop = run.groundY - s.h;
  return left < s.x + s.w && left + rw > s.x && top < snowTop && run.y > snowTop;
}

// Advance the simulation by dt seconds, in fixed steps of STEP.
export function tick(run, dt) {
  if (run.state !== 'running') return run;
  run.time += dt;
  run.speed = speedFor(run.distance) * (run.dashTimer > 0 ? DASH_BOOST : 1);
  run.distance += run.speed * dt * DISTANCE_SCALE; // points: 1 per 50px travelled
  run.dashTimer = Math.max(0, run.dashTimer - dt);
  run.dashCooldown = Math.max(0, run.dashCooldown - dt);
  run.invulnerable = Math.max(0, run.invulnerable - dt);

  // Gravity and landing. A landing needs the foot to cross a platform top while falling.
  const footBefore = run.y;
  run.vy += GRAVITY * run.scale * dt;
  run.y += run.vy * dt;
  const landing = run.vy >= 0 ? platformUnder(run, REINDEER_X, footBefore) : null;
  if (landing && run.y >= landing.y - LANDING_TOL) {
    run.y = landing.y;
    run.vy = 0;
    run.grounded = true;
    run.doubleUsed = false;
    run.coyote = COYOTE;
  } else {
    run.grounded = false;
    run.coyote = Math.max(0, run.coyote - dt);
  }

  // Scroll the world and spawn snowmen once the run has settled.
  const dx = run.speed * dt;
  scrollWorld(run, dx);
  if (run.time >= run.nextSnowmanAt) {
    spawnSnowman(run);
    run.nextSnowmanAt = run.time + 2.5 + run.rand() * 2;
  }

  // Collisions. Smashed snowmen leave the list straight away.
  for (const s of run.snowmen) {
    if (!s.alive || !hitsSnowman(run, s)) continue;
    if (run.dashTimer > 0 || run.invulnerable > 0) {
      s.alive = false;
      run.bonus += SNOWMAN_BONUS;
    } else {
      run.state = 'dead';
      run.deathReason = 'snowman';
      return run;
    }
  }
  run.snowmen = run.snowmen.filter((s) => s.alive);
  if (run.y > run.height + FALL_MARGIN) {
    run.state = 'dead';
    run.deathReason = 'fell';
  }
  return run;
}
