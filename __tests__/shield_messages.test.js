import { WALL_SAVES, SAVE_LINES, pickSaveLine, saveStreakLine } from '../static/shield_messages';

test('there are many save lines, and a rare streak line is kept apart from them', () => {
  expect(SAVE_LINES.wall.length).toBeGreaterThanOrEqual(8);
  expect(SAVE_LINES.body.length).toBeGreaterThanOrEqual(8);
  expect(SAVE_LINES.streak.length).toBeGreaterThanOrEqual(3);
});

test('pickSaveLine returns a line from the requested pool, chosen by the rng', () => {
  expect(SAVE_LINES.wall).toContain(pickSaveLine('wall', () => 0));
  expect(SAVE_LINES.body).toContain(pickSaveLine('body', () => 0.999));
});

test('the streak line only appears on the fifth save in a row', () => {
  expect(WALL_SAVES).toBe(5);
  expect(saveStreakLine(1, () => 0)).toBe(null);
  expect(saveStreakLine(4, () => 0)).toBe(null);
  expect(SAVE_LINES.streak).toContain(saveStreakLine(5, () => 0));
});

test('the streak line is rare: only a small share of the fifth saves get it', () => {
  // A fifth save only gets the rare line one time in four; the rest get the normal line.
  expect(saveStreakLine(5, () => 0.5)).toBe(null);
  expect(saveStreakLine(5, () => 0.1)).not.toBe(null);
});

test('the save streak counts consecutive saves and resets when the run stops absorbing', async () => {
  const { nextStreak } = await import('../static/shield_messages');
  let st = 0;
  st = nextStreak(st, 'absorbed');
  st = nextStreak(st, 'absorbed');
  expect(st).toBe(2);
  st = nextStreak(st, 'moved'); // a normal tick breaks the streak
  expect(st).toBe(0);
});
