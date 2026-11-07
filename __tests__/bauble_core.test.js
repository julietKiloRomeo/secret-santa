import {
  levelScore,
  createRun,
  addMove,
  finishLevel,
  isDone,
  totalScore,
  reachedStar,
  fellOff,
} from '../static/bauble_core';

test('a level scores 500 for one move and loses 25 per extra move, never below 100', () => {
  expect(levelScore(1)).toBe(500);
  expect(levelScore(2)).toBe(475);
  expect(levelScore(17)).toBe(100);
  expect(levelScore(99)).toBe(100);
});

test('finishing a level records its score, resets moves and advances', () => {
  const run = createRun(2);
  addMove(run);
  addMove(run);
  finishLevel(run);
  expect(run.scores).toEqual([475]);
  expect(run.moves).toBe(0);
  expect(run.index).toBe(1);
  expect(isDone(run)).toBe(false);
});

test('the run is done after the last level and the total is the sum of level scores', () => {
  const run = createRun(2);
  addMove(run);
  finishLevel(run);
  addMove(run);
  addMove(run);
  finishLevel(run);
  expect(isDone(run)).toBe(true);
  expect(totalScore(run)).toBe(500 + 475);
});

test('finishing past the last level does not add a score', () => {
  const run = createRun(1);
  addMove(run);
  finishLevel(run);
  finishLevel(run);
  expect(run.scores).toEqual([500]);
});

test('the bauble reaches the star inside its radius only', () => {
  const star = { x: 500, y: 400, r: 30 };
  expect(reachedStar({ x: 510, y: 410 }, star)).toBe(true);
  expect(reachedStar({ x: 540, y: 400 }, star)).toBe(false);
});

test('the bauble has fallen off once it is well below the world', () => {
  expect(fellOff({ y: 500 }, 540)).toBe(false);
  expect(fellOff({ y: 600 }, 540)).toBe(true);
});
