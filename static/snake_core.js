// Pure Snake rules (no rendering) so they can be unit tested.
export const GIFTS = ['🎁', '🍬', '🧦', '🍪', '🍫', '🧸'];
const DELTA = { left: [-1, 0], right: [1, 0], up: [0, -1], down: [0, 1] };
const OPPOSITE = { left: 'right', right: 'left', up: 'down', down: 'up' };
export const SPEED_START_MS = 190;
export const SPEED_MIN_MS = 70;
const QUEUE_MAX = 2; // buffered turns; a third quick press in one tick is dropped

// Faster as the snake grows. Tick time in ms, never below SPEED_MIN_MS.
export const tickMsFor = (score) => Math.max(SPEED_MIN_MS, SPEED_START_MS - score * 4);

// A queued turn steps the snake early once half a tick has passed, so a key press
// lands within about half a tick instead of up to a full one.
export const shouldStepNow = ({ acc, tick, queued }) => queued > 0 && acc >= tick / 2;

export function nextSkin(s, rand) {
  if (s.forcedSkin) {
    const k = s.forcedSkin;
    s.forcedSkin = null;
    return k;
  }
  if (!s.bag.length) {
    s.bag = [...GIFTS];
    for (let i = s.bag.length - 1; i > 0; i -= 1) {
      const j = Math.floor(rand() * (i + 1));
      [s.bag[i], s.bag[j]] = [s.bag[j], s.bag[i]];
    }
  }
  return s.bag.pop();
}

// Row 0 is under the HUD, so gifts never spawn there.
export const GIFT_MIN_Y = 1;

// Pick a random free cell from a list of candidates; no retry loop, so a full board cannot hang.
export function placeGift(s, rand) {
  const taken = new Set(s.body.map((p) => p.y * s.cols + p.x));
  const free = [];
  for (let y = GIFT_MIN_Y; y < s.rows; y += 1)
    for (let x = 0; x < s.cols; x += 1) if (!taken.has(y * s.cols + x)) free.push({ x, y });
  if (!free.length) {
    s.gift = null;
    return;
  }
  const { x, y } = free[Math.floor(rand() * free.length)];
  s.gift = { x, y, skin: nextSkin(s, rand) };
}

export function createSnake(cols, rows, rand) {
  const cx = Math.floor(cols / 2),
    cy = Math.floor(rows / 2);
  const s = {
    cols,
    rows,
    dir: 'right',
    queue: [], // turns waiting for a tick, applied one per tick
    score: 0,
    alive: true,
    body: Array.from({ length: 5 }, (_, i) => ({ x: cx - i, y: cy })),
    skins: [],
    bag: [],
    forcedSkin: null,
    gift: null,
  };
  // Start as a present: the body is skinned from the same shuffle bag as the gifts.
  s.skins = Array.from({ length: 4 }, () => nextSkin(s, rand));
  placeGift(s, rand);
  return s;
}

// Queue a turn. Reverses are checked when applied, against the direction actually in use.
export const turn = (s, dir) => {
  if (s.queue.length < QUEUE_MAX) s.queue.push(dir);
};

// Advance one tick. Returns 'dead', 'ate' or 'moved'.
export function step(s, rand) {
  const next = s.queue.shift();
  if (next && OPPOSITE[next] !== s.dir) s.dir = next;
  const [dx, dy] = DELTA[s.dir];
  const head = { x: s.body[0].x + dx, y: s.body[0].y + dy };
  // The tail moves away this tick, so its cell is free unless the snake grows (then it stays put).
  const eating = s.gift && head.x === s.gift.x && head.y === s.gift.y;
  const solid = eating ? s.body : s.body.slice(0, -1);
  const ghosting = (s.effects?.ghost ?? 0) > 0;
  if (ghosting) s.effects.ghost -= 1;
  const wall = head.x < 0 || head.x >= s.cols || head.y < 0 || head.y >= s.rows;
  const self = !ghosting && solid.some((p) => p.x === head.x && p.y === head.y);
  if (wall || self) {
    if ((s.effects?.shield ?? 0) > 0) {
      // A shield absorbs the hit: the snake stays where it is for this tick.
      s.effects.shield -= 1;
      return 'moved';
    }
    s.alive = false;
    return 'dead';
  }
  s.body.unshift(head);
  if (s.powerup && head.x === s.powerup.x && head.y === s.powerup.y) {
    s.lastPowerup = s.powerup.kind; // the caller applies it with eatPowerup (see snake_powerups)
    s.powerup = null;
    s.body.pop();
    return 'powered';
  }
  if (s.gift && head.x === s.gift.x && head.y === s.gift.y) {
    s.skins.push(s.gift.skin); // skins[i] is drawn on body[i + 1]
    s.score += 1;
    s.gift = null; // the caller refills the floor with placeFloor (gift or powerup)
    return 'ate';
  }
  s.body.pop();
  return 'moved';
}

export function swipeDir(dx, dy, threshold = 24) {
  if (Math.abs(dx) < threshold && Math.abs(dy) < threshold) return null;
  if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? 'right' : 'left';
  return dy > 0 ? 'down' : 'up';
}
