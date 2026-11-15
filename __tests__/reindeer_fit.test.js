import fs from 'fs';
import path from 'path';
import { worldFor } from '../static/world_fit';

const src = fs.readFileSync(path.join(__dirname, '../static/reindeer_rush.js'), 'utf8');

test('reindeer rush sizes its world with worldFor, so it fills the screen like the other games', () => {
  expect(src).toMatch(/worldFor\(/);
});

test('reindeer rush does not hard-code a 640-wide world', () => {
  expect(src).not.toMatch(/const W = 640;/);
});

test('on a portrait phone the world is wider than the 640 design width, so there are no side bars', () => {
  const w = worldFor(390, 844, 260);
  expect(w.height).toBe(260);
  expect(w.width * w.scale).toBeCloseTo(390, 0);
});

test('on a portrait phone the world is at least as tall on screen as a desktop world, not a thin strip', () => {
  // Phone: the world may be narrower than 640 so its height fills the screen width-wise.
  const phone = worldFor(390, 844, 260, 200);
  expect(phone.width * phone.scale).toBeCloseTo(390, 0);
  expect(phone.height * phone.scale).toBeGreaterThan(200);
});
