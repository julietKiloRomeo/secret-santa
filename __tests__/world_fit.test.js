import { worldFor } from '../static/world_fit';

test('keeps the world height fixed and stretches the width to the screen aspect', () => {
  // Wide desktop: more sky to the right, same vertical scale.
  expect(worldFor(1600, 900, 360)).toEqual({ width: 640, height: 360, scale: 900 / 360 });
});

test('tall phone: height fixed, width stays at the minimum so the game is never cropped', () => {
  const w = worldFor(390, 844, 360);
  expect(w.height).toBe(360);
  expect(w.width).toBeGreaterThanOrEqual(360);
  expect(w.width * w.scale).toBeCloseTo(390, 0);
});

test('never returns a world narrower than the minimum playable width', () => {
  expect(worldFor(200, 900, 360).width).toBeGreaterThanOrEqual(360);
});
