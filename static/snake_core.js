// Pure Snake rules (no rendering) so they can be unit tested.
export const GIFTS = ['🎁', '🍬', '🧦', '🍪', '🍫', '🧸'];
const DELTA = { left: [-1, 0], right: [1, 0], up: [0, -1], down: [0, 1] };
const OPPOSITE = { left: 'right', right: 'left', up: 'down', down: 'up' };

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

export function placeGift(s, rand) {
  let x, y;
  do {
    x = Math.floor(rand() * s.cols);
    y = Math.floor(rand() * s.rows);
  } while (s.body.some((p) => p.x === x && p.y === y));
  s.gift = { x, y, skin: nextSkin(s, rand) };
}

export function createSnake(cols, rows, rand) {
  const cx = Math.floor(cols / 2),
    cy = Math.floor(rows / 2);
  const s = {
    cols,
    rows,
    dir: 'right',
    pending: 'right',
    score: 0,
    alive: true,
    body: Array.from({ length: 5 }, (_, i) => ({ x: cx - i, y: cy })),
    skins: [],
    bag: [],
    forcedSkin: null,
    gift: null,
  };
  placeGift(s, rand);
  return s;
}

export const turn = (s, dir) => {
  s.pending = dir;
};

// Advance one tick. Returns 'dead', 'ate' or 'moved'.
export function step(s, rand) {
  if (OPPOSITE[s.pending] !== s.dir) s.dir = s.pending;
  const [dx, dy] = DELTA[s.dir];
  const head = { x: s.body[0].x + dx, y: s.body[0].y + dy };
  // The tail moves away this tick, so its cell is free unless the snake grows (then it stays put).
  const eating = s.gift && head.x === s.gift.x && head.y === s.gift.y;
  const solid = eating ? s.body : s.body.slice(0, -1);
  const hit =
    head.x < 0 ||
    head.x >= s.cols ||
    head.y < 0 ||
    head.y >= s.rows ||
    solid.some((p) => p.x === head.x && p.y === head.y);
  if (hit) {
    s.alive = false;
    return 'dead';
  }
  s.body.unshift(head);
  if (s.gift && head.x === s.gift.x && head.y === s.gift.y) {
    s.skins.push(s.gift.skin); // skins[i] is drawn on body[i + 1]
    s.score += 1;
    placeGift(s, rand);
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
