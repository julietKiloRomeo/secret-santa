import { createSnake, step, turn, placeGift, GIFT_MIN_Y } from '../static/snake_core';
import {
  POWERUP_CHANCE,
  POWERUP_KINDS,
  pathLength,
  powerupTimer,
  placeFloor,
  eatPowerup,
  activeEffects,
  TRIM_COUNT,
  GHOST_TICKS,
  expirePowerup,
  tickFloor,
  needsCard,
  markCardSeen,
  tickTrimmed,
  TRIM_HOLD_TICKS,
  TRIM_FADE_TICKS,
} from '../static/snake_powerups';

const rng = (seq) => {
  let i = 0;
  return () => seq[i++ % seq.length];
};

test('one floor item at a time: a powerup or a gift, never both', () => {
  const s = createSnake(20, 20, Math.random);
  for (let i = 0; i < 200; i += 1) {
    placeFloor(s, Math.random);
    const count = (s.gift ? 1 : 0) + (s.powerup ? 1 : 0);
    expect(count).toBe(1);
  }
});

test('a powerup spawns about POWERUP_CHANCE of the time and never in the HUD row', () => {
  let n = 0;
  const trials = 4000;
  for (let i = 0; i < trials; i += 1) {
    const s = createSnake(20, 20, Math.random);
    placeFloor(s, Math.random);
    if (s.powerup) {
      n += 1;
      expect(s.powerup.y).toBeGreaterThanOrEqual(GIFT_MIN_Y);
    }
  }
  expect(n / trials).toBeGreaterThan(POWERUP_CHANCE * 0.8);
  expect(n / trials).toBeLessThan(POWERUP_CHANCE * 1.2);
});

test('powerup kinds are shield, ghost and trim', () => {
  expect([...POWERUP_KINDS].sort()).toEqual(['ghost', 'shield', 'trim']);
});

test('the timer is the path length times 1.5, with a minimum of 8 ticks', () => {
  expect(powerupTimer(2)).toBe(8);
  expect(powerupTimer(20)).toBe(30);
});

test('pathLength is the shortest walk around the body', () => {
  const s = createSnake(10, 10, Math.random);
  s.body = [{ x: 5, y: 5 }];
  expect(pathLength(s, { x: 8, y: 5 })).toBe(3);
  // The head at (5,5) with a body wall at x=6 (y 4..7) forces a detour around the wall's end.
  s.body = [
    { x: 5, y: 5 },
    { x: 6, y: 4 },
    { x: 6, y: 5 },
    { x: 6, y: 6 },
    { x: 6, y: 7 },
  ];
  expect(pathLength(s, { x: 8, y: 5 })).toBeGreaterThan(3);
});

test('an unreachable powerup has no path length', () => {
  // Head at the corner (0,0). Body cells at (1,0), (1,1), (0,1) wall it in; the tail is the
  // last cell and is excluded from the walls, so the wall is three real body cells + one more.
  const s = createSnake(10, 10, Math.random);
  s.body = [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 1, y: 1 },
    { x: 0, y: 1 },
    { x: 0, y: 2 },
    { x: 1, y: 2 },
  ];
  // (0,1) is a body cell but not the tail, so it blocks; the head cannot leave the corner.
  expect(pathLength(s, { x: 5, y: 5 })).toBe(Infinity);
});

test('shield absorbs one wall hit and is used up', () => {
  const s = createSnake(20, 20, () => 0.5);
  s.effects = { shield: 1, ghost: 0 };
  s.body = [
    { x: 0, y: 10 },
    { x: 1, y: 10 },
  ];
  s.dir = 'left';
  expect(step(s, () => 0.5)).toBe('absorbed');
  expect(s.alive).toBe(true);
  expect(s.effects.shield).toBe(0);
  expect(step(s, () => 0.5)).toBe('dead');
});

test('two shields stack and absorb two hits', () => {
  const s = createSnake(20, 20, () => 0.5);
  eatPowerup(s, 'shield');
  eatPowerup(s, 'shield');
  expect(s.effects.shield).toBe(2);
  s.body = [
    { x: 0, y: 10 },
    { x: 1, y: 10 },
  ];
  s.dir = 'left';
  step(s, () => 0.5);
  step(s, () => 0.5);
  expect(s.alive).toBe(true);
  expect(s.effects.shield).toBe(0);
  expect(step(s, () => 0.5)).toBe('dead');
});

test('ghost lets the head pass through its own body for GHOST_TICKS ticks', () => {
  const s = createSnake(20, 20, () => 0.5);
  s.body = [
    { x: 5, y: 5 },
    { x: 4, y: 5 },
    { x: 4, y: 6 },
    { x: 5, y: 6 },
    { x: 6, y: 6 },
    { x: 6, y: 5 },
  ];
  s.dir = 'down';
  s.gift = { x: 0, y: 0, skin: '🍪' };
  eatPowerup(s, 'ghost');
  expect(s.effects.ghost).toBe(GHOST_TICKS);
  // Head moves down into (5,6), which is body: allowed while ghosting.
  expect(step(s, () => 0.5)).toBe('moved');
  expect(s.alive).toBe(true);
});

test('ghost runs out: the same self-collision kills once the time is spent', () => {
  const s = createSnake(20, 20, () => 0.5);
  // Head at (5,5) heading down into (5,6), a middle segment (not the tail, which is (4,6) here).
  s.body = [
    { x: 5, y: 5 },
    { x: 4, y: 5 },
    { x: 4, y: 6 },
    { x: 5, y: 6 },
    { x: 6, y: 6 },
  ];
  s.dir = 'down';
  s.effects = { shield: 0, ghost: 0 };
  s.gift = { x: 0, y: 0, skin: '🍪' };
  expect(step(s, () => 0.5)).toBe('dead');
});

test('ghost time stacks: two pickups add their ticks', () => {
  const s = createSnake(20, 20, () => 0.5);
  eatPowerup(s, 'ghost');
  eatPowerup(s, 'ghost');
  expect(s.effects.ghost).toBe(GHOST_TICKS * 2);
});

test('trim removes TRIM_COUNT tail segments and their skins, with no score loss', () => {
  const s = createSnake(20, 20, () => 0.5);
  s.body = Array.from({ length: 10 }, (_, i) => ({ x: 10 - i, y: 10 }));
  s.skins = Array.from({ length: 9 }, () => '🍪');
  s.score = 4;
  eatPowerup(s, 'trim');
  expect(s.body).toHaveLength(10 - TRIM_COUNT);
  expect(s.skins).toHaveLength(9 - TRIM_COUNT);
  expect(s.score).toBe(4);
});

test('trim never shortens the snake below its starting length', () => {
  const s = createSnake(20, 20, () => 0.5);
  s.body = Array.from({ length: 5 }, (_, i) => ({ x: 10 - i, y: 10 }));
  s.skins = [];
  eatPowerup(s, 'trim');
  expect(s.body.length).toBeGreaterThanOrEqual(5);
});

test('activeEffects reports the stacked totals for the HUD', () => {
  const s = createSnake(20, 20, () => 0.5);
  eatPowerup(s, 'shield');
  eatPowerup(s, 'ghost');
  eatPowerup(s, 'ghost');
  expect(activeEffects(s)).toEqual({ shield: 1, ghost: GHOST_TICKS * 2 });
});

test('an expired powerup becomes a gift on the same cell', () => {
  const s = createSnake(20, 20, rng([0.5]));
  s.powerup = { x: 12, y: 3, kind: 'shield', ttl: 1 };
  s.gift = null;
  expirePowerup(s, rng([0.5]));
  expect(s.powerup).toBe(null);
  expect(s.gift).toMatchObject({ x: 12, y: 3 });
});

test('stepping onto a powerup reports it and clears the floor item', () => {
  const s = createSnake(20, 20, () => 0.5);
  s.gift = null;
  s.powerup = { x: 11, y: 10, kind: 'ghost', ttl: 20 };
  s.dir = 'right';
  expect(step(s, () => 0.5)).toBe('powered');
  expect(s.lastPowerup).toBe('ghost');
  expect(s.powerup).toBe(null);
});

test('a powerup counts down one per tick and becomes a gift when it reaches zero', () => {
  const s = createSnake(20, 20, rng([0.5]));
  s.gift = null;
  s.powerup = { x: 12, y: 3, kind: 'trim', ttl: 2 };
  tickFloor(s, rng([0.5]));
  expect(s.powerup.ttl).toBe(1);
  expect(s.gift).toBe(null);
  tickFloor(s, rng([0.5]));
  expect(s.powerup).toBe(null);
  expect(s.gift).toMatchObject({ x: 12, y: 3 });
});

test('every powerup has a loot-style card: name, flavor line and effect line', async () => {
  const { POWERUP_CARDS, cardFor } = await import('../static/snake_powerups');
  for (const kind of ['shield', 'ghost', 'trim']) {
    const c = POWERUP_CARDS[kind];
    expect(c.name.length).toBeGreaterThan(0);
    expect(c.flavor.length).toBeGreaterThan(10);
    expect(c.effect.length).toBeGreaterThan(10);
    expect(cardFor(kind)).toBe(c);
  }
});

test('the first pickup of each kind asks for a card; later pickups do not', async () => {
  const { needsCard, markCardSeen } = await import('../static/snake_powerups');
  const seen = new Set();
  expect(needsCard(seen, 'shield')).toBe(true);
  markCardSeen(seen, 'shield');
  expect(needsCard(seen, 'shield')).toBe(false);
  expect(needsCard(seen, 'ghost')).toBe(true);
});

test('a shield absorbing a wall hit does not move the snake and reports it, so the game can wait', () => {
  const s = createSnake(20, 20, () => 0.5);
  s.gift = null;
  s.powerup = null;
  s.skins = [];
  s.body = [
    { x: 0, y: 10 },
    { x: 1, y: 10 },
    { x: 2, y: 10 },
  ];
  s.dir = 'left';
  s.effects = { shield: 1, ghost: 0 };
  expect(step(s, () => 0.5)).toBe('absorbed');
  expect(s.alive).toBe(true);
  expect(s.effects.shield).toBe(0);
  expect(s.body[0]).toEqual({ x: 0, y: 10 });
});

test('a new game starts with no cards seen, so each kind is shown once per playthrough', () => {
  const game1 = new Set();
  markCardSeen(game1, 'shield');
  expect(needsCard(game1, 'shield')).toBe(false);
  // A new game gets a fresh set, so the card is due again.
  const game2 = new Set();
  expect(needsCard(game2, 'shield')).toBe(true);
});

test('a shield absorbing a body hit stops the snake in place, like a wall: no pass-through', () => {
  const s = createSnake(20, 20, () => 0.5);
  s.gift = null;
  s.powerup = null;
  s.skins = [];
  s.body = [
    { x: 10, y: 10 },
    { x: 9, y: 10 },
    { x: 9, y: 11 },
    { x: 10, y: 11 },
    { x: 11, y: 11 },
    { x: 11, y: 10 },
    { x: 11, y: 9 },
    { x: 10, y: 9 },
    { x: 9, y: 9 },
    { x: 8, y: 9 },
  ];
  s.dir = 'up';
  s.effects = { shield: 1, ghost: 0 };
  expect(step(s, () => 0.5)).toBe('absorbed');
  expect(s.alive).toBe(true);
  expect(s.effects.shield).toBe(0);
  // The head did not move into the body.
  expect(s.body[0]).toEqual({ x: 10, y: 10 });
});

test('a shield-absorbed hit reports which kind it was, so the message fits', () => {
  const s = createSnake(20, 20, () => 0.5);
  s.gift = null;
  s.powerup = null;
  s.skins = [];
  s.body = [
    { x: 10, y: 10 },
    { x: 9, y: 10 },
    { x: 9, y: 11 },
    { x: 10, y: 11 },
    { x: 11, y: 11 },
    { x: 11, y: 10 },
    { x: 11, y: 9 },
    { x: 10, y: 9 },
    { x: 9, y: 9 },
    { x: 8, y: 9 },
  ];
  s.dir = 'up';
  s.effects = { shield: 1, ghost: 0 };
  step(s, () => 0.5);
  expect(s.lastHit).toBe('body');
});

test('ghost lasts 10 ticks', () => {
  expect(GHOST_TICKS).toBe(10);
});

test('a ghost crossing of the body while ghosting records a loop', () => {
  const s = createSnake(20, 20, () => 0.5);
  s.body = [
    { x: 5, y: 5 },
    { x: 4, y: 5 },
    { x: 4, y: 6 },
    { x: 5, y: 6 },
    { x: 6, y: 6 },
    { x: 6, y: 5 },
  ];
  s.dir = 'down';
  s.gift = { x: 0, y: 0, skin: '🍪' };
  eatPowerup(s, 'ghost');
  expect(step(s, () => 0.5)).toBe('moved');
  expect(s.loops).toBe(1);
});

test('after a loop, the next floor item is always a ghost powerup, never a gift', () => {
  // rand 0.99 would normally give a gift.
  const s = createSnake(20, 20, () => 0.5);
  s.loops = 1;
  placeFloor(s, () => 0.99);
  expect(s.gift).toBe(null);
  expect(s.powerup).toMatchObject({ kind: 'ghost' });
});

test('the guaranteed ghost is spent: the pickup clears the loop flag', () => {
  const s = createSnake(20, 20, () => 0.5);
  s.loops = 1;
  s.powerup = { x: 11, y: 10, kind: 'ghost', ttl: 20 };
  s.dir = 'right';
  expect(step(s, () => 0.5)).toBe('powered');
  eatPowerup(s, s.lastPowerup);
  expect(s.loops).toBe(0);
});

test('the ghost card hints at looping without spelling out the mechanic', async () => {
  const { POWERUP_CARDS } = await import('../static/snake_powerups');
  const text = `${POWERUP_CARDS.ghost.flavor} ${POWERUP_CARDS.ghost.effect}`;
  expect(POWERUP_CARDS.ghost.flavor + POWERUP_CARDS.ghost.effect).toMatch(/coil|coiled|circle/i);
  expect(text).toMatch(/10 ticks/);
  expect(text).not.toMatch(/loop/i); // hint only, not the mechanic's name
});

test('trim keeps the cut segments as frozen pieces with their skins', () => {
  const s = createSnake(20, 20, () => 0.5);
  s.body = Array.from({ length: 10 }, (_, i) => ({ x: 10 - i, y: 10 }));
  s.skins = Array.from({ length: 9 }, (_, i) => `skin${i}`);
  eatPowerup(s, 'trim');
  expect(s.trimmed).toHaveLength(TRIM_COUNT);
  // The cut tail is the last TRIM_COUNT body cells, with the skins drawn on them.
  // skins[i] is drawn on body[i + 1]: the cut cell at body[7] (x=3) carries skins[6].
  expect(s.trimmed.map((p) => [p.x, p.skin])).toEqual([
    [3, 'skin6'],
    [2, 'skin7'],
    [1, 'skin8'],
  ]);
  expect(s.trimmed[0].ttl).toBe(TRIM_HOLD_TICKS + TRIM_FADE_TICKS);
});

test('frozen trim pieces stay for the hold time, then are removed', () => {
  const s = createSnake(20, 20, () => 0.5);
  s.body = Array.from({ length: 10 }, (_, i) => ({ x: 10 - i, y: 10 }));
  s.skins = Array.from({ length: 9 }, () => '🍪');
  eatPowerup(s, 'trim');
  for (let i = 0; i < TRIM_HOLD_TICKS; i++) tickTrimmed(s);
  expect(s.trimmed.length).toBe(TRIM_COUNT);
  expect(s.trimmed[0].ttl).toBe(TRIM_FADE_TICKS);
  for (let i = 0; i < TRIM_FADE_TICKS; i++) tickTrimmed(s);
  expect(s.trimmed).toHaveLength(0);
});

test('frozen trim pieces do not move or count as collisions', () => {
  const s = createSnake(20, 20, () => 0.5);
  s.body = Array.from({ length: 10 }, (_, i) => ({ x: 10 - i, y: 10 }));
  s.skins = Array.from({ length: 9 }, () => '🍪');
  eatPowerup(s, 'trim');
  const before = s.trimmed.map((p) => ({ x: p.x, y: p.y }));
  s.dir = 'up';
  step(s, () => 0.5);
  expect(s.trimmed.map((p) => ({ x: p.x, y: p.y }))).toEqual(before);
  expect(s.alive).toBe(true);
});

test('trim piece opacity holds at 1 during the hold, then fades to 0', async () => {
  const { trimAlpha } = await import('../static/snake_powerups');
  expect(trimAlpha(TRIM_FADE_TICKS + TRIM_HOLD_TICKS)).toBe(1);
  expect(trimAlpha(TRIM_FADE_TICKS + 1)).toBe(1);
  expect(trimAlpha(TRIM_FADE_TICKS)).toBeCloseTo(1);
  expect(trimAlpha(1)).toBeCloseTo(0.5);
  expect(trimAlpha(0)).toBe(0);
});
