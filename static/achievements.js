// Achievements carried across games, kept per player in localStorage.
// Pure rules: unlock checks take run stats; storage takes an injected store so Jest can test it.
// Tone: dry, in-world, a little snarky, like a dungeon-crawler loot card.

export const ACHIEVEMENTS = [
  {
    id: 'first-present',
    name: 'Gift Receipt',
    snark: 'You ate a present. The elves have noted your appetite and your lack of manners.',
    check: (st) => st.gifts >= 1,
  },
  {
    id: 'five-lives',
    name: 'Five Lives, Zero Dignity',
    snark: 'Saved five times in a row. The shield is not impressed, but it did show up.',
    check: (st) => st.saveStreak >= 5,
  },
  {
    id: 'shielded-up',
    name: 'Insurance Claim',
    snark: 'Picked up a powerup. Somewhere a claims adjuster sighed.',
    check: (st) => st.powerups >= 1,
  },
  {
    id: 'ten-gifts',
    name: 'Chimney Inspector',
    snark: 'Ten presents in one run. Your waistline is a matter for another loot card.',
    check: (st) => st.gifts >= 10,
  },
  {
    id: 'twenty-five-gifts',
    name: 'Santa Is Nervous',
    snark: 'Twenty-five presents. The sleigh budget is being reviewed.',
    check: (st) => st.gifts >= 25,
  },
];

// Achievements this run newly earns, given the stats and the set already held.
export const newlyUnlocked = (st, have) => ACHIEVEMENTS.filter((a) => !have.has(a.id) && a.check(st));

const keyFor = (player) => `snake-achievements:${player}`;

export function loadUnlocked(storage, player) {
  try {
    const raw = storage.getItem(keyFor(player));
    const ids = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(ids) ? ids : []);
  } catch {
    return new Set(); // a corrupt value must not break the game
  }
}

export function saveUnlocked(storage, player, set) {
  storage.setItem(keyFor(player), JSON.stringify([...set]));
}
