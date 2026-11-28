// Shield save messages: many lines per situation, picked at random, in a dry dungeon-crawler tone.
// Pure, no Phaser, so Jest can check the picking rules.
export const WALL_SAVES = 5; // saves in a row that earn the rare streak line
export const STREAK_CHANCE = 0.25; // share of fifth-in-a-row saves that get the streak line

export const SAVE_LINES = {
  wall: [
    'Godt, du havde et skjold! Vælg en retning for at fortsætte.',
    'Muren tabte den omgang. Vælg en retning for at fortsætte.',
    'Skjoldet tog slaget. Muren står endnu. Din værdighed? Knap så meget. Vælg en retning.',
    'Muren holder. Det gør du også. Vælg en retning for at fortsætte.',
    'Modigt at nikke kulissen en skalle. Skjoldet siger nej. Vælg en retning.',
    'Skjold: brugt. Mur: uimponeret. Vælg en retning for at fortsætte.',
    'Intet siger "det var med vilje" som et skjold. Vælg en retning.',
    'Den mur glemmer dig ikke. Næppe af kærlighed. Vælg en retning for at fortsætte.',
  ],
  body: [
    'Du kørte ind i dig selv. Skjoldet kalder det taktik. Vælg en retning.',
    'Din krop er ikke en mur, men den er lige så uimponeret. Vælg en retning.',
    'Skjoldet reddede dig fra dig selv. Vælg en retning, og prøv løkken igen.',
    'Sammenstød med dig selv: afværget. Din hale har kommentarer. Vælg en retning.',
    'Godt, du havde et skjold. Din krop synes, du skal se dig for. Vælg en retning.',
    'Du mødte dig selv og overlevede. Vælg en retning for at fortsætte.',
    'Et skjold, en løkke og ingen fortrydelse. Vælg en retning for at fortsætte.',
    'Du stødte ind i dine tidligere valg. Skjoldet klarede det. Vælg en retning.',
  ],
  streak: [
    'Fem redninger i træk. Fangehullet har bemærket dig. Vælg en retning for at fortsætte.',
    'Fem skjolde, fem gange tæt på. Et sted tager en spiludvikler noter. Vælg en retning.',
    'Du er blevet reddet fem gange. Skæbnen er irriteret. Vælg en retning for at fortsætte.',
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
