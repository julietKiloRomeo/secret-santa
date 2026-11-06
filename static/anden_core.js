// Flappy Santa rules, no rendering. Units are logical px at a 400px-wide reference
// (scaled by run.scale), seconds for time. Tune here.
export const CONFIG = {
  gravity: 800, // px/s^2
  flapVy: -260, // px/s
  baseSpeed: 120, // px/s
  speedPerScore: 3, // px/s per point
  playerXRatio: 0.18,
  leadOffsetRatio: 0.145,
  secondOffsetRatio: 0.085,
  thirdOffsetRatio: 0.055,
  gapRatio: 0.4125, // 0.275 * 1.5, gap as fraction of width
  gapMin: 48,
  reindeerHitBoxScale: 0.72,
  graceMs: 1200,
  spawnIntervalMs: 3000,
  chimneyWidth: 40,
  levelTwoScore: 25,
  levelThreeScore: 50,
};

// Frames of lead-y history; trailing reindeer sample it so they follow the same path with a delay.
export const TRAIL_LEN = 60;

export const levelFor = (score) =>
  score >= CONFIG.levelThreeScore ? 3 : score >= CONFIG.levelTwoScore ? 2 : 1;

export const speedFor = (score, scale) => (CONFIG.baseSpeed + score * CONFIG.speedPerScore) * scale;

export function createRun({ width, height, rand = Math.random }) {
  const scale = width / 400;
  const run = {
    width,
    height,
    scale,
    rand,
    state: 'grace', // grace -> playing -> dead
    graceLeft: CONFIG.graceMs,
    birdW: Math.max(28, Math.round(width * 0.12)),
    birdH: Math.max(28, Math.round(width * 0.12 * (148 / 109))),
    gap: Math.max(CONFIG.gapMin, Math.round(width * CONFIG.gapRatio)),
    playerX: Math.round(width * CONFIG.playerXRatio),
    leadX: Math.round(width * CONFIG.playerXRatio) + Math.round(width * CONFIG.leadOffsetRatio),
    y: height / 2,
    vy: 0,
    chimneys: [],
    score: 0,
    sinceSpawn: 0,
    gapPlan: null, // next gap top, shown as a hint before it spawns
    trail: new Array(TRAIL_LEN).fill(height / 2),
  };
  run.gapPlan = pickGapTop(run);
  return run;
}

// Level 2 hints the next gap one second before it spawns; level 3 always does.
export function previewActive(run) {
  if (run.score >= CONFIG.levelThreeScore) return true;
  return run.score >= CONFIG.levelTwoScore && run.sinceSpawn >= CONFIG.spawnIntervalMs - 1000;
}

function pickGapTop(run) {
  return 30 + run.rand() * gapSpan(run);
}

export const gapSpan = (run) => Math.max(30, run.height - run.gap - 60) * 0.9;

export function flap(run) {
  run.graceLeft = 0;
  if (run.state === 'grace') run.state = 'playing';
  if (run.state === 'playing') run.vy = CONFIG.flapVy * run.scale;
}

export function leadHitbox(run) {
  const half = (run.birdW * CONFIG.reindeerHitBoxScale) / 2;
  return { half, halfH: (run.birdH * CONFIG.reindeerHitBoxScale) / 2 };
}

// Advance the run by dt seconds.
export function step(run, dt) {
  if (run.state === 'dead') return run;
  if (run.state === 'grace') {
    run.graceLeft -= dt * 1000;
    if (run.graceLeft <= 0) run.state = 'playing';
    run.trail.unshift(run.y);
    run.trail.length = TRAIL_LEN;
    return run;
  }
  if (run.state !== 'playing') return run;

  run.vy += CONFIG.gravity * run.scale * dt;
  run.y += run.vy * dt;
  run.trail.unshift(run.y);
  run.trail.length = TRAIL_LEN;

  run.sinceSpawn += dt * 1000;
  if (run.sinceSpawn >= CONFIG.spawnIntervalMs) {
    run.sinceSpawn = 0;
    run.chimneys.push({ x: run.width + 10, top: run.gapPlan, passed: false });
    run.gapPlan = pickGapTop(run);
  }

  const speed = speedFor(run.score, run.scale);
  for (const c of run.chimneys) {
    c.x -= speed * dt;
    if (!c.passed && c.x + CONFIG.chimneyWidth * run.scale < run.leadX) {
      c.passed = true;
      run.score += 1;
    }
  }
  run.chimneys = run.chimneys.filter((c) => c.x > -80 * run.scale);

  if (collides(run)) run.state = 'dead';
  return run;
}

function collides(run) {
  const { half, halfH } = leadHitbox(run);
  if (run.y - halfH <= 0 || run.y + halfH >= run.height) return true;
  const right = CONFIG.chimneyWidth * run.scale;
  for (const c of run.chimneys) {
    const overlapX = run.leadX + half > c.x && run.leadX - half < c.x + right;
    if (overlapX && (run.y - halfH < c.top || run.y + halfH > c.top + run.gap)) return true;
  }
  return false;
}
