import { worldFor } from '../static/world_fit';

test('desktop: width is the minimum world width, height follows the screen aspect, no bars', () => {
  const w = worldFor(1280, 800, 260, 640);
  expect(w.width).toBe(640);
  expect(w.scale).toBe(2);
  expect(Math.abs(w.height * w.scale - 800)).toBeLessThan(2);
});

test('portrait phone: fills the whole screen with a taller world', () => {
  const w = worldFor(390, 844, 260, 200);
  expect(Math.abs(w.width * w.scale - 390)).toBeLessThan(2);
  expect(Math.abs(w.height * w.scale - 844)).toBeLessThan(2);
  expect(w.height).toBeGreaterThan(260);
});

test('landscape phone: height stays at the design height, width grows', () => {
  const w = worldFor(844, 390, 260, 200);
  expect(w.height).toBe(260);
  expect(Math.abs(w.width * w.scale - 844)).toBeLessThan(2);
});

test('never returns a world narrower than the minimum playable width', () => {
  expect(worldFor(200, 900, 260, 360).width).toBeGreaterThanOrEqual(360);
});
