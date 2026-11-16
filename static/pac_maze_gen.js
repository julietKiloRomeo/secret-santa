// Pac-Santa maze generator. Pure, no Phaser. Output uses the same codes as pac_santa_core.js:
// '#' wall, '.' cookie, 'o' candy cane, ' ' empty, 'G' ghost start, 'S' Santa start.
// A depth-first carve on odd cells makes every open tile reachable; a few extra openings add loops.

const DIRS = [
  [0, -2],
  [0, 2],
  [-2, 0],
  [2, 0],
];

export function generateMaze(w, h, rand = Math.random) {
  const g = Array.from({ length: h }, () => Array(w).fill('#'));
  const carve = (x, y) => {
    g[y][x] = ' ';
    const order = [...DIRS].sort(() => rand() - 0.5);
    for (const [dx, dy] of order) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx > 0 && ny > 0 && nx < w - 1 && ny < h - 1 && g[ny][nx] === '#') {
        g[y + dy / 2][x + dx / 2] = ' ';
        carve(nx, ny);
      }
    }
  };
  carve(1, 1);

  // Loops: open some walls that separate two open tiles, so the maze has more than one route.
  for (let i = 0; i < (w * h) / 12; i += 1) {
    const x = 1 + Math.floor(rand() * (w - 2));
    const y = 1 + Math.floor(rand() * (h - 2));
    if (g[y][x] === '#' && open(g, x - 1, y) && open(g, x + 1, y) && rand() < 0.5) g[y][x] = ' ';
    else if (g[y][x] === '#' && open(g, x, y - 1) && open(g, x, y + 1)) g[y][x] = ' ';
  }

  // Tunnels: open the middle row at both edges and one tile in, so each tunnel joins the maze.
  const mid = Math.floor(h / 2);
  for (const x of [0, 1, w - 2, w - 1]) g[mid][x] = ' ';

  // Ghost pen in the centre (2x2 open, closed in by walls), Santa just below it.
  const cx = Math.floor(w / 2);
  const cy = Math.floor(h / 2);
  for (const [x, y] of [[cx - 1, cy - 1], [cx, cy - 1], [cx - 1, cy], [cx, cy]]) g[y][x] = ' ';
  g[cy - 1][cx - 1] = 'G';
  g[cy - 1][cx] = 'G';
  g[cy][cx - 1] = 'G';
  g[cy][cx] = 'G';

  // Santa starts on an open tile below the pen.
  g[cy + 2][cx] = 'S';
  g[cy + 2][cx - 1] = ' ';

  // The pen and Santa's start can cut off a stray tile: open walls where that helps, then wall off any tile still cut off.
  connectAll(g, w, h);
  wallOffUnreachable(g, w, h);

  // Pellets on every remaining open tile, with candy canes in the corners.
  for (let y = 1; y < h - 1; y += 1) {
    for (let x = 1; x < w - 1; x += 1) if (g[y][x] === ' ') g[y][x] = '.';
  }
  return g.map((row) => row.join(''));
}

// Open a wall whenever it separates a reachable open tile from an unreachable one, until none are left.
function connectAll(g, w, h) {
  for (let pass = 0; pass < 200; pass += 1) {
    const seen = flood(g, w, h);
    let changed = false;
    for (let y = 1; y < h - 1 && !changed; y += 1) {
      for (let x = 1; x < w - 1 && !changed; x += 1) {
        if (g[y][x] !== '#') continue;
        const sides = [[0, 1], [0, -1], [1, 0], [-1, 0]]
          .map(([dx, dy]) => [x + dx, y + dy])
          .filter(([nx, ny]) => nx >= 0 && ny >= 0 && nx < w && ny < h && g[ny][nx] !== '#');
        const hasSeen = sides.some(([nx, ny]) => seen.has(`${nx},${ny}`));
        const hasLost = sides.some(([nx, ny]) => !seen.has(`${nx},${ny}`));
        if (hasSeen && hasLost) {
          g[y][x] = ' ';
          changed = true;
        }
      }
    }
    if (!changed) return;
  }
}

// Any open tile still unreachable from Santa becomes a wall, so every open tile is reachable.
function wallOffUnreachable(g, w, h) {
  const seen = flood(g, w, h);
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      if (g[y][x] !== '#' && !seen.has(`${x},${y}`)) g[y][x] = '#';
    }
  }
}

function flood(g, w, h) {
  const start = [];
  g.forEach((row, y) => row.forEach((c, x) => c === 'S' && start.push({ x, y })));
  const seen = new Set();
  const q = start.length ? [start[0]] : [];
  if (q.length) seen.add(`${q[0].x},${q[0].y}`);
  while (q.length) {
    const { x, y } = q.shift();
    for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
      const nx = x + dx;
      const ny = y + dy;
      const k = `${nx},${ny}`;
      if (nx >= 0 && ny >= 0 && nx < w && ny < h && !seen.has(k) && g[ny][nx] !== '#') {
        seen.add(k);
        q.push({ x: nx, y: ny });
      }
    }
  }
  return seen;
}

export const open = (g, x, y) => g[y]?.[x] !== undefined && g[y][x] !== '#';

// Count open tiles and how many are reachable from Santa, for tests and sanity checks.
export function reachable(maze) {
  const g = maze.map((r) => r.split(''));
  let total = 0;
  let start = null;
  g.forEach((row, y) =>
    row.forEach((c, x) => {
      if (c !== '#') total += 1;
      if (c === 'S') start = { x, y };
    }),
  );
  const seen = new Set();
  const q = [start];
  seen.add(`${start.x},${start.y}`);
  while (q.length) {
    const { x, y } = q.shift();
    for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
      const nx = x + dx;
      const ny = y + dy;
      const k = `${nx},${ny}`;
      if (!seen.has(k) && open(g, nx, ny)) {
        seen.add(k);
        q.push({ x: nx, y: ny });
      }
    }
  }
  return { open: total, seen: seen.size };
}
