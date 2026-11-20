import { textResolution } from '../static/text_resolution';

test('text is drawn at device pixel density times the on-screen scale', () => {
  // A 600px-wide canvas shown at 1200 CSS px on a 2x display needs 4x resolution to stay sharp.
  expect(textResolution({ displayScale: 2, devicePixelRatio: 2 })).toBe(4);
});

test('never below 1, and capped so huge screens do not blow up memory', () => {
  expect(textResolution({ displayScale: 0.5, devicePixelRatio: 1 })).toBe(1);
  expect(textResolution({ displayScale: 10, devicePixelRatio: 3 })).toBe(4);
});
