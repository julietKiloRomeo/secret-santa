// Første Advent: Jule Snake on Phaser. Rules live in snake_core.js.
import { createSnake, step, turn, swipeDir, placeGift, nextSkin } from './snake_core.js';
import { showScores } from './arcade_scene.js';

const COLS = 20;
const CELL = 30; // logical px; Scale.FIT stretches the 600x600 board to the page
const SPEED_MS = 150;
const COLORS = { bg: 0x000022, grid: 0x111144, snake: 0x2c8a2c, edge: 0x1e5e1e };
// Gift emoji from snake_core.js mapped to pixel-art sprites in static/sprites/snake/.
const SKIN_SPRITE = { '🎁': 'gift-red', '🍬': 'candy', '🧦': 'sock', '🍪': 'cookie', '🧸': 'gift-blue', '🍫': 'gift-green' };
const SPRITE_FILES = { ...Object.fromEntries(Object.values(SKIN_SPRITE).map((k) => [k, k])), head: 'head' };
const KEY_DIR = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down' };
const RESTART_KEYS = new Set(['Space', 'Enter', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);

const scoreEl = document.getElementById('score');
const statusEl = document.getElementById('status');
const setStatus = (t) => {
  if (statusEl) statusEl.textContent = t;
};

class SnakeScene extends Phaser.Scene {
  preload() {
    for (const key of Object.keys(SPRITE_FILES)) this.load.image(key, `/static/sprites/snake/${SPRITE_FILES[key]}.png`);
  }

  create() {
    const g = this.add.graphics();
    g.fillStyle(COLORS.bg)
      .fillRect(0, 0, COLS * CELL, COLS * CELL)
      .lineStyle(1, COLORS.grid);
    for (let i = 0; i <= COLS; i += 1) {
      g.lineBetween(i * CELL, 0, i * CELL, COLS * CELL).lineBetween(0, i * CELL, COLS * CELL, i * CELL);
    }
    this.body = this.add.graphics();
    this.marks = []; // reusable sprite objects for the gift and the body skins
    this.input.keyboard.on('keydown', (e) => this.onKey(e));
    this.input.on('pointerdown', (p) => {
      if (!this.running() && !this.busy) this.restart();
      this.swipe = p.position.clone();
    });
    this.input.on('pointerup', (p) => {
      const dir =
        this.swipe &&
        swipeDir((p.x - this.swipe.x) * this.scaleRatio(), (p.y - this.swipe.y) * this.scaleRatio());
      this.swipe = null;
      if (dir) {
        turn(this.s, dir);
        beep(this, 440, 40, 'square', 0.01);
      }
    });
    this.timer = this.time.addEvent({ delay: SPEED_MS, loop: true, callback: () => this.tick() });
    this.restart();
    exposeDebug(this);
  }

  running() {
    return this.s.alive && !this.timer.paused;
  }

  // Swipe threshold is in screen px, pointer coords are in game px.
  scaleRatio() {
    return this.scale.displayScale.x ? 1 / this.scale.displayScale.x : 1;
  }

  onKey(e) {
    if (!this.running() && !this.busy && RESTART_KEYS.has(e.code)) this.restart();
    if (KEY_DIR[e.key]) {
      turn(this.s, KEY_DIR[e.key]);
      beep(this, 440, 40, 'square', 0.01);
    }
  }

  restart() {
    this.s = createSnake(COLS, COLS, Math.random);
    this.timer.paused = false;
    scoreEl.textContent = 'Score: 0';
    setStatus('Klar! Tap eller brug piletasterne.');
    this.draw();
  }

  tick() {
    if (!this.s.alive) return;
    const r = step(this.s, Math.random);
    if (r === 'ate') {
      scoreEl.textContent = `Score: ${this.s.score}`;
      beep(this, 880, 120, 'sine', 0.03);
      this.time.delayedCall(120, () => beep(this, 1320, 120, 'sine', 0.02));
    }
    if (r === 'dead') return this.gameOver();
    this.draw();
  }

  async gameOver() {
    this.timer.paused = true;
    setStatus('Game Over! Tryk Space, pil eller tap for at prøve igen 🎅');
    beep(this, 220, 400, 'sawtooth', 0.03);
    this.busy = true;
    await showScores(this, { gameId: 'advent-1', score: this.s.score, title: 'Søde Børn' });
    this.busy = false;
  }

  draw() {
    const { body, gift, skins } = this.s;
    this.body.clear().fillStyle(COLORS.snake).lineStyle(1, COLORS.edge);
    body.forEach((p) => {
      this.body.fillRect(p.x * CELL + 2, p.y * CELL + 2, CELL - 4, CELL - 4);
      this.body.strokeRect(p.x * CELL + 2, p.y * CELL + 2, CELL - 4, CELL - 4);
    });
    const marks = [gift, ...skins.slice(0, body.length - 1).map((skin, i) => ({ ...body[i + 1], skin }))];
    marks.forEach((m, i) => {
      this.marks[i] ??= this.add.image(0, 0, 'gift-red');
      this.marks[i]
        .setTexture(SKIN_SPRITE[m.skin] ?? 'gift-red')
        .setPosition(m.x * CELL + CELL / 2, m.y * CELL + CELL / 2)
        .setDisplaySize(CELL - 4, CELL - 4)
        .setVisible(true);
    });
    this.marks.slice(marks.length).forEach((t) => t.setVisible(false));
  }
}

function beep(scene, freq, ms, type, gain) {
  const ctx = scene.sound.context;
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  g.gain.value = gain;
  osc.connect(g).connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + ms / 1000);
}

// Hooks for Playwright.
function exposeDebug(scene) {
  window.__snakeDebug__ = {
    placeGiftNextToHead(dx = 1, dy = 0) {
      const h = scene.s.body[0];
      scene.s.gift = { x: h.x + dx, y: h.y + dy, skin: nextSkin(scene.s, Math.random) };
      scene.draw();
    },
    setDirection: (d) => turn(scene.s, d),
    getPendingDirection: () => scene.s.pending,
    getDirection: () => scene.s.dir,
    tickOnce: () => scene.tick(),
    getSnakeLength: () => scene.s.body.length,
    getSnakeCoords: () => scene.s.body.map(({ x, y }) => ({ x, y })),
    getSkinsFiltered: () => scene.s.skins.slice(0, scene.s.body.length - 1),
    setNextGiftSkin: (k) => {
      scene.s.forcedSkin = k;
    },
    getGrid: () => ({ cols: COLS, rows: COLS, cell: CELL }),
    rerollGift: () => {
      placeGift(scene.s, Math.random);
      scene.draw();
      return { x: scene.s.gift.x, y: scene.s.gift.y };
    },
    isRunning: () => scene.running(),
    debugStop: (msg = 'Pause') => {
      scene.timer.paused = true;
      setStatus(msg);
    },
    restartGame: () => scene.restart(),
  };
}

document.body.classList.add('arcade-fullscreen');
new Phaser.Game({
  type: Phaser.CANVAS,
  canvas: document.getElementById('snake-canvas'),
  parent: document.getElementById('snake-canvas').parentElement,
  width: COLS * CELL,
  height: COLS * CELL,
  backgroundColor: '#000022',
  dom: { createContainer: true },
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  scene: SnakeScene,
});
