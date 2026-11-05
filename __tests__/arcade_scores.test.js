import { qualifies, rankFor, MAX_NAME } from '../static/arcade_scores';

const list = (...scores) => scores.map((score, i) => ({ name: `P${i}`, score }));

test('qualifies needs a positive score and a free or beaten top-10 slot', () => {
  expect(qualifies([], 0)).toBe(false);
  expect(qualifies([], 1)).toBe(true);
  const full = list(100, 90, 80, 70, 60, 50, 40, 30, 20, 10);
  expect(qualifies(full, 10)).toBe(false);
  expect(qualifies(full, 11)).toBe(true);
});

test('rankFor places ties below existing entries', () => {
  expect(rankFor(list(400, 300, 150), 180)).toBe(2);
  expect(rankFor(list(400, 300, 150), 150)).toBe(3);
  expect(rankFor([], 5)).toBe(0);
});

test('name cap matches the server', () => {
  expect(MAX_NAME).toBe(18);
});
