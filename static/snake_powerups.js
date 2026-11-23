// Snake powerups: rules only. The floor holds one item at a time: a gift or a powerup.
// Powerups time out and turn into a normal gift on the same cell. Pure, no Phaser.
import { GIFT_MIN_Y, nextSkin } from './snake_core.js';

export const POWERUP_CHANCE = 0.2; // share of floor spawns that are powerups
export const POWERUP_KINDS = ['shield', 'ghost', 'trim'];
export const GHOST_TICKS = 10; // ticks the head may pass through its own body per pickup
export const TRIM_COUNT = 3; // tail segments removed by a trim pickup
const MIN_TIMER = 8; // ticks
const TIMER_FACTOR = 1.5; // timer = path length x this

// Ticks a powerup stays on the floor, from the shortest walk to it.
export const powerupTimer = (pathLen) => Math.max(MIN_TIMER, Math.ceil(pathLen * TIMER_FACTOR));

// Shortest walk from the head to a cell, around the body. Infinity when no path exists.
export function pathLength(s, target) {
  const head = s.body[0];
  const key = (x, y) => y * s.cols + x;
  const blocked = new Set(s.body.slice(0, -1).map((p) => key(p.x, p.y)));
  const dist = new Map([[key(head.x, head.y), 0]]);
  const queue = [head];
  for (let i = 0; i < queue.length; i += 1) {
    const cur = queue[i];
    if (cur.x === target.x && cur.y === target.y) return dist.get(key(cur.x, cur.y));
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const nx = cur.x + dx;
      const ny = cur.y + dy;
      if (nx < 0 || ny < 0 || nx >= s.cols || ny >= s.rows) continue;
      const k = key(nx, ny);
      if (blocked.has(k) || dist.has(k)) continue;
      dist.set(k, dist.get(key(cur.x, cur.y)) + 1);
      queue.push({ x: nx, y: ny });
    }
  }
  return Infinity;
}

// Put one item on the floor: a powerup with POWERUP_CHANCE, otherwise a gift. Never both.
export function placeFloor(s, rand) {
  const taken = new Set(s.body.map((p) => p.y * s.cols + p.x));
  const free = [];
  for (let y = GIFT_MIN_Y; y < s.rows; y += 1)
    for (let x = 0; x < s.cols; x += 1) if (!taken.has(y * s.cols + x)) free.push({ x, y });
  s.gift = null;
  s.powerup = null;
  if (!free.length) return;
  const { x, y } = free[Math.floor(rand() * free.length)];
  if (s.loops > 0 || rand() < POWERUP_CHANCE) {
    // After a loop, the next powerup is a ghost (guaranteed).
    const kind = s.loops > 0 ? 'ghost' : POWERUP_KINDS[Math.floor(rand() * POWERUP_KINDS.length)];
    const pathLen = pathLength(s, { x, y });
    const ttl = Number.isFinite(pathLen) ? powerupTimer(pathLen) : MIN_TIMER;
    s.powerup = { x, y, kind, ttl, maxTtl: ttl };
  } else {
    s.gift = { x, y, skin: nextSkin(s, rand) };
  }
}

// A powerup that ran out of time becomes a normal gift on the same cell.
export function expirePowerup(s, rand) {
  if (!s.powerup) return;
  const { x, y } = s.powerup;
  s.powerup = null;
  s.gift = { x, y, skin: nextSkin(s, rand) };
}

// One tick passes: a powerup loses a tick and turns into a gift when its time is up.
export function tickFloor(s, rand) {
  if (!s.powerup) return;
  s.powerup.ttl -= 1;
  if (s.powerup.ttl <= 0) expirePowerup(s, rand);
}

// Apply a pickup. Stacking: shield charges and ghost ticks add up. Trim is instant.
export function eatPowerup(s, kind) {
  s.effects ??= { shield: 0, ghost: 0 };
  if (kind === 'shield') s.effects.shield += 1;
  if (kind === 'ghost') {
    s.effects.ghost += GHOST_TICKS;
    s.loops = 0; // the guaranteed ghost is spent
  }
  if (kind === 'trim') {
    const keep = Math.max(s.body.length - TRIM_COUNT, 5);
    const drop = s.body.length - keep;
    s.body.splice(keep);
    s.skins.splice(Math.max(s.skins.length - drop, 0));
  }
}

export const activeEffects = (s) => ({ shield: s.effects?.shield ?? 0, ghost: s.effects?.ghost ?? 0 });

// Loot-card text, in the dry in-world style of a dungeon-crawler item: a name, a flavor line
// and a plain effect line. Shown once per kind, on the first pickup.
export const POWERUP_CARDS = {
  shield: {
    name: 'Ward of the Frost Hearth',
    flavor: 'Forged from the last warm ember in the North Pole. It remembers every wall it has met.',
    effect: 'Absorbs one collision. Stacks. A wall hit stops you; a body hit still lets you through.',
  },
  ghost: {
    name: 'Mistletoe Spectre',
    flavor: 'A bored elf\u2019s ghost, bound to a sprig. It likes to coil, and it has opinions about your tail.',
    effect: 'Pass through your own body for 10 ticks. Stacks. Ends mid-coil, so plan the exit.',
  },
  trim: {
    name: 'Shears of the Tidy Elf',
    flavor: 'Used for cutting ribbon and reputations. Clean cuts, no hard feelings.',
    effect: 'Removes 3 tail segments and their presents. Score is kept. Never drops below 5.',
  },
};

export const cardFor = (kind) => POWERUP_CARDS[kind];

// The card appears on the first pickup of each kind, tracked per run in a Set.
export const needsCard = (seen, kind) => !seen.has(kind);
export const markCardSeen = (seen, kind) => seen.add(kind);
