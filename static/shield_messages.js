// Shield save messages: many lines per situation, picked at random, in a dry dungeon-crawler tone.
// Pure, no Phaser, so Jest can check the picking rules.
export const WALL_SAVES = 5; // saves in a row that earn the rare streak line
export const STREAK_CHANCE = 0.25; // share of fifth-in-a-row saves that get the streak line

export const SAVE_LINES = {
  wall: [
    'Good thing you had a shield! Press an arrow to continue.',
    'The wall lost that round. Press an arrow to keep going.',
    'Your shield took the hit. The wall is still standing, unlike your dignity. Press an arrow.',
    'Structural integrity: the wall. Your integrity: intact. Press an arrow to go on.',
    'Brave of you to headbutt the scenery. The shield says no. Press an arrow.',
    'Shield: used. Wall: unimpressed. Press an arrow to continue.',
    'Nothing says "I meant to do that" like a shield. Press an arrow.',
    'That wall will remember this. Probably not kindly. Press an arrow to continue.',
  ],
  body: [
    'You ran into yourself. The shield says that counts as a tactic. Press an arrow.',
    'Your own body is not a wall, and it is not impressed either. Press an arrow to go on.',
    'The shield absorbed you walking into yourself. Choose a direction and try the loop again.',
    'Self-collision, absorbed. Your tail has notes. Press an arrow to continue.',
    'Good thing you had a shield. Your body thinks you should look where you are going. Press an arrow.',
    'You met yourself and lived. Press an arrow to continue.',
    'A shield, a loop, and no regrets. Press an arrow to keep moving.',
    'You bumped into your own past choices. The shield handled it. Press an arrow.',
  ],
  streak: [
    'Five saves in a row. The dungeon has noticed you. Press an arrow to continue.',
    'Five shields, five near misses. Somewhere a game designer is taking notes. Press an arrow.',
    'You have been saved five times. Fate is annoyed. Press an arrow to keep going.',
  ],
};

// A random line from one pool. The rng is passed in so tests can fix it.
export const pickSaveLine = (pool, rand = Math.random) => {
  const lines = SAVE_LINES[pool];
  return lines[Math.floor(rand() * lines.length)];
};

// The rare line: only on the fifth save in a row, and only some of the time.
export const saveStreakLine = (streak, rand = Math.random) => {
  if (streak !== WALL_SAVES) return null;
  if (rand() >= STREAK_CHANCE) return null;
  return pickSaveLine('streak', rand);
};

// Consecutive saves. Any step that is not an absorbed hit ends the streak.
export const nextStreak = (streak, result) => (result === 'absorbed' ? streak + 1 : 0);
