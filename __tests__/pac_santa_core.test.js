import { createGame, queueTurn, tick, MAZE } from '../static/pac_santa_core';

const open = (g, x, y) => g.maze[y][x] !== '#';

test('maze has exactly one Santa start and four ghost starts on open tiles', () => {
  const g = createGame();
  expect(g.santa.x).toBeGreaterThan(0);
  expect(open(g, g.santa.x, g.santa.y)).toBe(true);
  expect(g.ghosts).toHaveLength(4);
  g.ghosts.forEach((gh) => expect(open(g, gh.x, gh.y)).toBe(true));
  expect(MAZE.every((row) => row.length === MAZE[0].length)).toBe(true);
});

test('a queued turn applies only when the tile in that direction is open', () => {
  const g = createGame();
  g.ghosts = [];
  g.santa = { x: 3, y: 3, dir: 'right', next: null };
  queueTurn(g, 'up'); // (3,2) is a wall in the maze: the turn waits
  tick(g);
  expect(g.santa.dir).toBe('right');
  queueTurn(g, 'down'); // (3,4) is open: the turn applies
  tick(g);
  expect(g.santa.dir).toBe('down');
});

test('eating a cookie scores 10 and removes it; a candy cane scores 50 and frightens ghosts', () => {
  const g = createGame();
  g.santa = { x: 1, y: 1, dir: 'right', next: null };
  g.maze[1][2] = '.';
  g.maze[1][1] = ' ';
  g.ghosts = [];
  tick(g, 0);
  expect(g.score).toBe(10);
  expect(g.maze[1][2]).toBe(' ');

  g.santa = { x: 2, y: 1, dir: 'right', next: null };
  g.maze[1][3] = 'o';
  g.maze[1][2] = ' ';
  tick(g, 0);
  expect(g.score).toBe(60);
  expect(g.frightened).toBeGreaterThan(0);
});

test('a ghost on Santa costs a life, or ends the game with no lives left', () => {
  const g = createGame();
  g.santa = { x: 1, y: 1, dir: 'right', next: null };
  g.ghosts = [{ x: 2, y: 1, dir: 'left', home: { x: 9, y: 9 }, frightened: false }];
  g.maze[1][2] = ' ';
  tick(g, 0);
  expect(g.lives).toBe(2);
  expect(g.status).toBe('playing');
  g.lives = 1;
  g.santa = { x: 1, y: 1, dir: 'right', next: null };
  g.ghosts = [{ x: 2, y: 1, dir: 'left', home: { x: 9, y: 9 }, frightened: false }];
  tick(g, 0);
  expect(g.lives).toBe(0);
  expect(g.status).toBe('over');
});

test('eating a frightened ghost sends it home and scores 200', () => {
  const g = createGame();
  g.santa = { x: 1, y: 1, dir: 'right', next: null };
  g.frightened = 100;
  g.ghosts = [{ x: 2, y: 1, dir: 'left', home: { x: 9, y: 9 }, frightened: true }];
  g.maze[1][2] = ' ';
  tick(g, 0);
  expect(g.score).toBe(200);
  expect(g.ghosts[0].eaten).toBe(true);
});

test('a tunnel on the left edge wraps Santa to the right edge', () => {
  const g = createGame();
  g.ghosts = [];
  const h = g.maze.length;
  const w = g.maze[0].length;
  const y = Math.floor(h / 2);
  g.maze[y][0] = ' ';
  g.maze[y][w - 1] = ' ';
  g.santa = { x: 0, y, dir: 'left', next: null };
  tick(g);
  expect(g.santa.x).toBe(w - 1);
});

test('a tunnel on the top edge wraps Santa to the bottom edge', () => {
  const g = createGame();
  g.ghosts = [];
  const h = g.maze.length;
  const w = g.maze[0].length;
  const x = Math.floor(w / 2);
  g.maze[0][x] = ' ';
  g.maze[h - 1][x] = ' ';
  g.santa = { x, y: 0, dir: 'up', next: null };
  tick(g);
  expect(g.santa.y).toBe(h - 1);
});
