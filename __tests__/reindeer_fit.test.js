import fs from 'fs';
import path from 'path';

const src = fs.readFileSync(path.join(__dirname, '../static/reindeer_rush.js'), 'utf8');

test('reindeer rush sizes its world with worldFor, so it fills the screen like the other games', () => {
  expect(src).toMatch(/worldFor\(/);
});

test('reindeer rush does not hard-code a 640-wide world', () => {
  expect(src).not.toMatch(/const W = 640;/);
});
