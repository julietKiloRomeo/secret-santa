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
  expect(step(s, () => 0.5)).toBe('moved');
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
