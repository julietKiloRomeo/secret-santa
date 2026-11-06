// Pac-Santa view: draws the maze and turns keys and swipes into queued turns.
// Rules live in pac_santa_core.js.
import { createGame, queueTurn, tick, MAZE } from './pac_santa_core.js';
import { showScores } from './arcade_scene.js';

const TILE = 24;
const STEP_MS = 120; // one tick per step: Santa moves a tile every 120 ms
const SWIPE_PX = 24;
const KEYS = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
  w: 'up',
  s: 'down',
  a: 'left',
  d: 'right',
};

class PacScene extends Phaser.Scene {
  create() {
    this.width = MAZE[0].length * TILE;
    this.height = MAZE.length * TILE;
    this.cameras.main.setBackgroundColor('#0b1a33');
    this.gfx = this.add.graphics();
    this.hud = this.add.text(8, 4, '', { fontFamily: 'monospace', fontSize: '16px', color: '#f0f8ff' });
    this.hud.setDepth(10);
    this.start();
    this.input.keyboard.on('keydown', (e) => {
      if (KEYS[e.key]) queueTurn(this.g, KEYS[e.key]);
      if (this.g.status !== 'playing' && e.key === ' ') this.restart();
    });
    this.input.on('pointerdown', (p) => (this.swipeStart = { x: p.x, y: p.y }));
    this.input.on('pointerup', (p) => this.onSwipe(p));
    this.timer = this.time.addEvent({ delay: STEP_MS, loop: true, callback: () => this.step() });
    window.__pacDebug__ = { snapshot: () => this.snapshot() };
  }

  start() {
    this.g = createGame();
    this.ended = false;
  }

  restart() {
    this.start();
  }

  onSwipe(p) {
    if (!this.swipeStart) return;
    const dx = p.x - this.swipeStart.x;
    const dy = p.y - this.swipeStart.y;
    this.swipeStart = null;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < SWIPE_PX) return;
    const dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up';
    queueTurn(this.g, dir);
  }

  step() {
    if (this.g.status !== 'playing') {
      if (!this.ended) {
        this.ended = true;
        this.endRun();
      }
      return;
    }
    tick(this.g);
    this.draw();
  }

  async endRun() {
    this.draw();
    await new Promise((r) => setTimeout(r, 600));
    await showScores(this, { gameId: 'advent-5', score: this.g.score, title: 'Pac-Santa' });
    this.restart();
  }

  draw() {
    const g = this.g;
    this.gfx.clear();
    MAZE.forEach((row, y) =>
      [...row].forEach((c, x) => {
        const px = x * TILE;
        const py = y * TILE;
        if (c === '#') this.gfx.fillStyle(0x3b6ea5).fillRect(px, py, TILE, TILE);
        if (g.maze[y][x] === '.') this.gfx.fillStyle(0xffe9b0).fillCircle(px + TILE / 2, py + TILE / 2, 3);
        if (g.maze[y][x] === 'o') this.gfx.fillStyle(0xff4d6d).fillCircle(px + TILE / 2, py + TILE / 2, 7);
      }),
    );
    this.gfx
      .fillStyle(0xffd23f)
      .fillCircle(g.santa.x * TILE + TILE / 2, g.santa.y * TILE + TILE / 2, TILE / 2 - 2);
    g.ghosts.forEach((gh) => {
      if (gh.eaten) return;
      this.gfx.fillStyle(gh.frightened ? 0x9ad0ff : 0xe0245e);
      this.gfx.fillCircle(gh.x * TILE + TILE / 2, gh.y * TILE + TILE / 2, TILE / 2 - 3);
    });
    this.hud.setText(`Score ${g.score}   Lives ${g.lives}`);
  }

  snapshot() {
    const g = this.g;
    return {
      status: g.status,
      score: g.score,
      lives: g.lives,
      santa: { x: g.santa.x, y: g.santa.y },
      frightened: g.frightened,
    };
  }
}

new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'pac-santa-canvas-wrap',
  width: MAZE[0].length * TILE,
  height: MAZE.length * TILE,
  backgroundColor: '#0b1a33',
  dom: { createContainer: true },
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  scene: [PacScene],
});
