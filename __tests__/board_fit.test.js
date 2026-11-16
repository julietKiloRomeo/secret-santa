import { boardFor } from '../static/snake_board';

test('a 16:10 desktop gets a wide board close to its aspect', () => {
  const b = boardFor(1280, 800);
  expect(b).toEqual({ cols: 26, rows: 16 });
  expect(b.cols / b.rows).toBeCloseTo(1280 / 800, 1);
});

test('a portrait phone gets a tall board close to its aspect', () => {
  const b = boardFor(390, 844);
  expect(b).toEqual({ cols: 13, rows: 29 });
  expect(b.cols / b.rows).toBeCloseTo(390 / 844, 1);
});

test('a square window gets a square board', () => {
  expect(boardFor(600, 600)).toEqual({ cols: 20, rows: 20 });
});

test('the board keeps roughly the same number of cells on every screen', () => {
  for (const [w, h] of [[1280, 800], [390, 844], [844, 390]]) {
    const b = boardFor(w, h);
    expect(b.cols * b.rows).toBeGreaterThan(300);
    expect(b.cols * b.rows).toBeLessThan(500);
  }
});
