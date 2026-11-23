// Snake achievement tiers from plans/todo/006. Pure rules: the game passes run stats in.
// Ids are "<game>:<track>:<tier>" with the server game id (advent-1 is Snake).
const GAME = 'advent-1';

// Each track: the tier thresholds and the stat it reads. Loop tiers are "open loops at once".
export const SNAKE_TRACKS = {
  loops: { stat: 'maxLoops', tiers: [{ n: 1, name: 'Nidhogg' }, { n: 2, name: 'Ouroboros' }, { n: 3, name: 'Jormungandr' }] },
  shield: { stat: 'maxShields', tiers: [{ n: 3, name: 'Buckler' }, { n: 6, name: 'Aegis' }, { n: 10, name: 'Aegishjalmur' }] },
  trim: { stat: 'trims', tiers: [{ n: 3, name: 'Snip of the Norns' }, { n: 6, name: 'Shears of Atropos' }, { n: 10, name: 'The Last Cut' }] },
};

// Every tier the stats have reached, as ids. Repeats are harmless: the server keeps the first.
export function reachedSnakeIds(stats) {
  const ids = [];
  for (const [track, { stat, tiers }] of Object.entries(SNAKE_TRACKS))
    for (const t of tiers) if ((stats[stat] ?? 0) >= t.n) ids.push(`${GAME}:${track}:${t.n}`);
  return ids;
}

// A new game starts with an empty card queue: cards queued in the last game are not shown late.
export const newGameQueue = () => [];
