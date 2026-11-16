// Pac-Santa rules: pure state, no rendering. The view in pac_santa.js draws this state.

// '#' wall, '.' cookie, 'o' candy cane, ' ' empty, 'G' ghost start, 'S' Santa start.
export const MAZE = [
  '###################',
  '#o....#.....#....o#',
  '#.##..#.###.#..##.#',
  '#.................#',
  '#.##.#.#####.#.##.#',
  '#....#...#...#....#',
  '####.### # ###.####',
  '   #.#       #.#   ',
  '####.# ###G# #.####',
  '    .  #GGG#  .    ',
  '####.# #####.#.####',
  '   #.#       #.#   ',
  '####.# #####.#.####',
  '#........#........#',
  '#.##.###.#.###.##.#',
  '#o.#.....S.....#.o#',
  '##.#.#.#####.#.#.##',
  '#....#...#...#....#',
  '#.######.#.######.#',
  '#.................#',
  '###################',
];

const DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
const OPPOSITE = { up: 'down', down: 'up', left: 'right', right: 'left' };
export const COOKIE = 10;
export const CANDY = 50;
export const GHOST_POINTS = 200;
export const FRIGHT_TICKS = 150; // ticks at the 60 Hz step rate
export const MAX_LIVES = 3;

export const RELEASE_TICKS = 40; // ghost i leaves the pen after i * RELEASE_TICKS

export function createGame() {
  const maze = MAZE.map((row) => row.split(''));
  let santa = null;
  const ghosts = [];
  maze.forEach((row, y) =>
    row.forEach((c, x) => {
      if (c === 'S') {
        santa = { x, y, dir: 'left', next: null };
        row[x] = ' ';
      }
      if (c === 'G') {
        ghosts.push({ x, y, dir: 'up', home: { x, y }, frightened: false, eaten: false });
        row[x] = ' ';
      }
    }),
  );
  ghosts.forEach((gh, i) => (gh.releaseAt = i * RELEASE_TICKS));
  return { maze, santa, ghosts, score: 0, lives: MAX_LIVES, frightened: 0, status: 'playing', age: 0 };
}

const at = (g, x, y) => g.maze[y]?.[x] ?? '#';
const passable = (g, x, y) => at(g, x, y) !== '#';

// Tunnels wrap on both axes, so a transposed maze plays the same either way.
function wrap(g, x, y) {
  const w = g.maze[0].length;
  const h = g.maze.length;
  if (x < 0) return { x: w - 1, y };
  if (x >= w) return { x: 0, y };
  if (y < 0) return { x, y: h - 1 };
  if (y >= h) return { x, y: 0 };
  return { x, y };
}

// Queue the next turn; it is applied at the next tile centre where the path is open.
export function queueTurn(g, dir) {
  if (DIRS[dir]) g.santa.next = dir;
}

function stepInto(g, pos, dir) {
  const [dx, dy] = DIRS[dir];
  const n = wrap(g, pos.x + dx, pos.y + dy);
  return passable(g, n.x, n.y) ? n : null;
}

function moveSanta(g) {
  const s = g.santa;
  if (s.next && s.next !== OPPOSITE[s.dir] && stepInto(g, s, s.next)) s.dir = s.next;
  const n = stepInto(g, s, s.dir);
  if (n) {
    s.x = n.x;
    s.y = n.y;
  }
}

// Ghosts pick the open exit closest to their target (squared distance), never reversing
// unless at a dead end. Frightened ghosts pick the farthest exit.
function moveGhost(g, gh, target) {
  const options = Object.keys(DIRS).filter((d) => d !== OPPOSITE[gh.dir] && stepInto(g, gh, d));
  const pool = options.length ? options : [OPPOSITE[gh.dir]];
  const dist = (d) => {
    const n = stepInto(g, gh, d) ?? gh;
    const dx = n.x - target.x;
    const dy = n.y - target.y;
    return dx * dx + dy * dy;
  };
  let best = pool[0];
  for (const d of pool) {
    const better = gh.frightened ? dist(d) > dist(best) : dist(d) < dist(best);
    if (better) best = d;
  }
  gh.dir = best;
  const n = stepInto(g, gh, best);
  if (n) {
    gh.x = n.x;
    gh.y = n.y;
  }
}

function ghostTarget(g, gh) {
  if (gh.eaten) return gh.home;
  if (gh.frightened) return gh;
  return { x: g.santa.x, y: g.santa.y };
}

function eatAt(g) {
  const s = g.santa;
  const c = at(g, s.x, s.y);
  if (c === '.') {
    g.score += COOKIE;
    g.maze[s.y][s.x] = ' ';
  } else if (c === 'o') {
    g.score += CANDY;
    g.maze[s.y][s.x] = ' ';
    g.frightened = FRIGHT_TICKS;
    g.ghosts.forEach((gh) => {
      if (!gh.eaten) gh.frightened = true;
    });
  }
}

function collideGhosts(g) {
  const s = g.santa;
  for (const gh of g.ghosts) {
    if (gh.x !== s.x || gh.y !== s.y) continue;
    if (gh.frightened && !gh.eaten) {
      gh.eaten = true;
      gh.frightened = false;
      g.score += GHOST_POINTS;
    } else if (!gh.eaten) {
      g.lives -= 1;
      resetPositions(g);
      if (g.lives <= 0) g.status = 'over';
      return;
    }
  }
}

function resetPositions(g) {
  g.santa = { x: 9, y: 15, dir: 'left', next: null };
  g.ghosts.forEach((gh) => {
    gh.x = gh.home.x;
    gh.y = gh.home.y;
    gh.frightened = false;
    gh.eaten = false;
  });
  g.frightened = 0;
}

// One fixed step. Santa and ghosts move on the same tick.
export function tick(g) {
  if (g.status !== 'playing') return g;
  moveSanta(g);
  eatAt(g);
  collideGhosts(g);
  if (g.status !== 'playing') return g;
  if (g.frightened > 0) {
    g.frightened -= 1;
    if (g.frightened === 0) g.ghosts.forEach((gh) => (gh.frightened = false));
  }
  g.age += 1;
  g.ghosts.forEach((gh) => {
    if (gh.eaten && gh.x === gh.home.x && gh.y === gh.home.y) gh.eaten = false;
    if (g.age < gh.releaseAt) return;
    moveGhost(g, gh, ghostTarget(g, gh));
  });
  collideGhosts(g);
  if (g.status === 'playing' && !g.maze.some((r) => r.includes('.') || r.includes('o'))) {
    g.status = 'won';
  }
  return g;
}
