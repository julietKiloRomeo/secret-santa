import fs from 'fs';

// In-game notifications are powerup loot cards only. Achievements go to the server, not to cards.
const src = fs.readFileSync('static/forste_advent.js', 'utf8');

test('the game does not import the old local achievement rules', () => {
  expect(src).not.toMatch(/from '\.\/achievements\.js'/);
});

test('the game never queues an achievement card', () => {
  expect(src).not.toMatch(/pendingCards/);
  expect(src).not.toMatch(/checkAchievements\(/);
  expect(src).not.toMatch(/Achievement unlocked/);
});

test('reached tiers are sent after the pickup is applied, not before', () => {
  // The shield count must be read after eatPowerup, or the third shield is never sent.
  const pickup = src.indexOf("eatPowerup(this.s, this.s.lastPowerup);");
  const send = src.indexOf("this.sendReachedTiers();", pickup);
  expect(pickup).toBeGreaterThan(-1);
  expect(send).toBeGreaterThan(pickup);
});
