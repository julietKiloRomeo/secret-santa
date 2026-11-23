import {
  levelScore,
  createRun,
  finishLevel,
  isDone,
  totalScore,
  reachedStar,
  fellOff,
  segmentsCross,
} from '../static/bauble_core';

test('a level scores 500 for a landing in 1 second and loses 25 per second, never below 100', () => {
  expect(levelScore(1)).toBe(500);
  expect(levelScore(2)).toBe(475);
  expect(levelScore(17)).toBe(100);
  expect(levelScore(99)).toBe(100);
});

test('finishing a level records its score from the landing time and advances', () => {
  const run = createRun(2);
  finishLevel(run, 2);
  expect(run.scores).toEqual([475]);
  expect(run.index).toBe(1);
  expect(isDone(run)).toBe(false);
});

test('the run is done after the last level and the total is the sum of level scores', () => {
  const run = createRun(2);
  finishLevel(run, 1);
  finishLevel(run, 2);
  expect(isDone(run)).toBe(true);
  expect(totalScore(run)).toBe(500 + 475);
});

test('finishing past the last level does not add a score', () => {
  const run = createRun(1);
  finishLevel(run, 1);
  finishLevel(run, 1);
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

test('a swipe crosses a rope link when the two segments intersect', () => {
  const link = { a: { x: 0, y: 0 }, b: { x: 0, y: 40 } };
  expect(segmentsCross({ a: { x: -20, y: 20 }, b: { x: 20, y: 20 } }, link)).toBe(true);
});

test('a swipe that misses the link, or stops short of it, does not cut it', () => {
  const link = { a: { x: 0, y: 0 }, b: { x: 0, y: 40 } };
  expect(segmentsCross({ a: { x: 10, y: 20 }, b: { x: 30, y: 20 } }, link)).toBe(false);
  expect(segmentsCross({ a: { x: -20, y: 60 }, b: { x: 20, y: 60 } }, link)).toBe(false);
});
