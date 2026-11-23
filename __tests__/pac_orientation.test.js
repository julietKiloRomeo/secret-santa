import { transpose, mazeSizeFor } from '../static/pac_orientation';

test('transpose swaps rows and columns', () => {
  expect(transpose(['ab', 'cd', 'ef'])).toEqual(['ace', 'bdf']);
});

test('transposing twice gives back the original maze', () => {
  const m = ['#.#', '...', '#S#'];
  expect(transpose(transpose(m))).toEqual(m);
});

test('portrait screens get a 30 wide by 40 tall maze, landscape gets it transposed', () => {
  expect(mazeSizeFor(390, 844)).toEqual({ cols: 30, rows: 40 });
  expect(mazeSizeFor(1280, 800)).toEqual({ cols: 40, rows: 30 });
});
