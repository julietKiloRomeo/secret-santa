// Nissen & Kuglen rules: scoring, run progress and cut geometry. Pure, no Phaser or Matter.
const TOP_SCORE = 500;
const PER_SECOND = 25;
const MIN_SCORE = 100;

// Faster landing scores higher. seconds is the time from the first cut to the landing.
export const levelScore = (seconds) => Math.max(MIN_SCORE, Math.round(TOP_SCORE - PER_SECOND * (seconds - 1)));

export function createRun(levelCount) {
  return { levelCount, index: 0, scores: [] };
}

export function finishLevel(run, seconds) {
  if (isDone(run)) return run;
  run.scores.push(levelScore(seconds));
  run.index += 1;
  return run;
}

export const isDone = (run) => run.index >= run.levelCount;

export const totalScore = (run) => run.scores.reduce((sum, s) => sum + s, 0);

export const reachedStar = (bauble, star) => Math.hypot(bauble.x - star.x, bauble.y - star.y) <= star.r;

export const fellOff = (bauble, worldBottom) => bauble.y > worldBottom + 40;

// True when swipe segment and rope link segment intersect (proper crossing or touching).
export function segmentsCross(swipe, link) {
  const side = (p, q, r) => Math.sign((q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x));
  const d1 = side(swipe.a, swipe.b, link.a);
  const d2 = side(swipe.a, swipe.b, link.b);
  const d3 = side(link.a, link.b, swipe.a);
  const d4 = side(link.a, link.b, swipe.b);
  return d1 * d2 <= 0 && d3 * d4 <= 0 && !(d1 === 0 && d2 === 0);
}
