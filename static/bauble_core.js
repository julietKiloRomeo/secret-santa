// Nissen & Kuglen rules: scoring and run progress. Pure, no Phaser or Matter.
const TOP_SCORE = 500;
const PER_EXTRA_MOVE = 25;
const MIN_SCORE = 100;

export const levelScore = (moves) => Math.max(MIN_SCORE, TOP_SCORE - PER_EXTRA_MOVE * (moves - 1));

export function createRun(levelCount) {
  return { levelCount, index: 0, moves: 0, scores: [] };
}

export const addMove = (run) => {
  run.moves += 1;
};

export function finishLevel(run) {
  if (isDone(run)) return run;
  run.scores.push(levelScore(Math.max(1, run.moves)));
  run.moves = 0;
  run.index += 1;
  return run;
}

export const isDone = (run) => run.index >= run.levelCount;

export const totalScore = (run) => run.scores.reduce((sum, s) => sum + s, 0);

export const reachedStar = (bauble, star) => Math.hypot(bauble.x - star.x, bauble.y - star.y) <= star.r;

export const fellOff = (bauble, worldBottom) => bauble.y > worldBottom + 40;
