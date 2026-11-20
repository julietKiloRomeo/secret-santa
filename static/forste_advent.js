// Første Advent: Jule Snake on Phaser. Rules live in snake_core.js.
// Fixed-step simulation (tickMsFor sets the pace) drawn with interpolation, so motion stays smooth
// at any frame rate. The simulation never depends on the frame rate.
import { createSnake, step, turn, swipeDir, placeGift, nextSkin, tickMsFor } from './snake_core.js';
import { showScores } from './arcade_scene.js';
import { boardFor } from './snake_board.js';

const { cols: COLS, rows: ROWS } = boardFor(window.innerWidth, window.innerHeight);
const CELL = 30; // logical px; Scale.FIT stretches the board to the page
const MAX_FRAME_MS = 250; // clamp so a stalled tab cannot queue a burst of ticks
const COLORS = { bg: 0x000022, grid: 0x111144, snake: 0x2c8a2c, edge: 0x1e5e1e, burst: 0xfde68a };
// Gift emoji from snake_core.js mapped to pixel-art sprites in static/sprites/snake/.
const SKIN_SPRITE = {
  '🎁': 'gift-red',
  '🍬': 'candy',
  '🧦': 'sock',
  '🍪': 'cookie',
  '🧸': 'gift-blue',
  '🍫': 'gift-green',
};
const SPRITE_FILES = { ...Object.fromEntries(Object.values(SKIN_SPRITE).map((k) => [k, k])), head: 'head' };
const HEAD_ANGLE = { right: 0, down: Math.PI / 2, left: Math.PI, up: -Math.PI / 2 };
const KEY_DIR = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down' };
const RESTART_KEYS = new Set(['Space', 'Enter', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);
const REDUCE_MOTION = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

const scoreEl = document.getElementById('score');
const statusEl = document.getElementById('status');
const setStatus = (t) => {
  if (statusEl) statusEl.textContent = t;
};

class SnakeScene extends Phaser.Scene {
  preload() {
    for (const key of Object.keys(SPRITE_FILES))
      this.load.image(key, `/static/sprites/snake/${SPRITE_FILES[key]}.png`);
  }

  create() {
    const g = this.add.graphics();
    g.fillStyle(COLORS.bg)
      .fillRect(0, 0, COLS * CELL, ROWS * CELL)
      .lineStyle(1, COLORS.grid);
    for (let i = 0; i <= COLS; i += 1) g.lineBetween(i * CELL, 0, i * CELL, ROWS * CELL);
    for (let i = 0; i <= ROWS; i += 1) {
      g.lineBetween(0, i * CELL, COLS * CELL, i * CELL);
    }
    this.body = this.add.graphics();
    this.head = this.add.image(0, 0, 'head').setVisible(false);
    this.headPop = 1;
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
    this.paused = false;
    this.acc = 0;
    this.restart();
    exposeDebug(this);
  }

  // Accumulate real time and run whole ticks; draw between ticks at the fractional position.
  update(_time, delta) {
    if (!this.running()) return this.drawFrame(1);
    this.acc += Math.min(delta, MAX_FRAME_MS);
    let tick = tickMsFor(this.s.score);
    while (this.acc >= tick && this.s.alive && !this.paused) {
      this.acc -= tick;
      this.prev = this.s.body.map((p) => ({ ...p }));
      this.advance();
      tick = tickMsFor(this.s.score);
    }
    this.drawFrame(Math.min(this.acc / tick, 1));
  }

  running() {
    return this.s.alive && !this.paused;
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
    this.s = createSnake(COLS, ROWS, Math.random);
    this.prev = this.s.body.map((p) => ({ ...p }));
    this.paused = false;
    this.acc = 0;
    scoreEl.textContent = 'Score: 0';
    setStatus('Klar! Tap eller brug piletasterne.');
    this.drawFrame(1);
  }

  // One simulation tick. Only ever called from update() or the debug hook.
  advance() {
    const r = step(this.s, Math.random);
    if (r === 'ate') this.onPickup();
    if (r === 'dead') return this.gameOver();
  }

  onPickup() {
    scoreEl.textContent = `Score: ${this.s.score}`;
    beep(this, 880, 120, 'sine', 0.03);
    this.time.delayedCall(120, () => beep(this, 1320, 120, 'sine', 0.02));
    if (REDUCE_MOTION) return;
    const h = this.s.body[0];
    this.burst(h.x * CELL + CELL / 2, h.y * CELL + CELL / 2);
    this.headPop = 1.35;
    this.tweens.add({ targets: this, headPop: 1, duration: 160, ease: 'Back.easeOut' });
  }

  // Ring of small circles that expands and fades. Visual only.
  burst(x, y) {
    for (let i = 0; i < 6; i += 1) {
      const a = (i / 6) * Math.PI * 2;
      const dot = this.add.circle(x, y, 4, COLORS.burst).setDepth(5);
      this.tweens.add({
        targets: dot,
        x: x + Math.cos(a) * CELL * 0.9,
        y: y + Math.sin(a) * CELL * 0.9,
        alpha: 0,
        scale: 0.2,
        duration: 320,
        ease: 'Quad.easeOut',
        onComplete: () => dot.destroy(),
      });
    }
  }

  async gameOver() {
    this.paused = true;
    setStatus('Game Over! Tryk Space, pil eller tap for at prøve igen 🎅');
    beep(this, 220, 400, 'sawtooth', 0.03);
    if (!REDUCE_MOTION) this.cameras.main.shake(220, 0.008);
    this.busy = true;
    await showScores(this, { gameId: 'advent-1', score: this.s.score, title: 'Søde Børn' });
    this.busy = false;
  }

  // Segment i moves from where it was last tick (prev[i]) to where it is now (body[i]).
  drawFrame(alpha) {
    const { body, gift, skins } = this.s;
    const at = (i) => {
      const cur = body[i];
      const old = this.prev?.[i] ?? cur;
      return { x: old.x + (cur.x - old.x) * alpha, y: old.y + (cur.y - old.y) * alpha };
    };
    this.body.clear().fillStyle(COLORS.snake).lineStyle(1, COLORS.edge);
    for (let i = 1; i < body.length; i += 1) {
      const p = at(i);
      this.body.fillRect(p.x * CELL + 2, p.y * CELL + 2, CELL - 4, CELL - 4);
      this.body.strokeRect(p.x * CELL + 2, p.y * CELL + 2, CELL - 4, CELL - 4);
    }
    const h = at(0);
    this.head
      .setVisible(true)
      .setTexture('head')
      .setPosition(h.x * CELL + CELL / 2, h.y * CELL + CELL / 2)
      .setDisplaySize(CELL * (this.headPop ?? 1), CELL * (this.headPop ?? 1))
      .setRotation(HEAD_ANGLE[this.s.dir] ?? 0);
    const marks = [gift, ...skins.slice(0, body.length - 1).map((skin, i) => ({ ...at(i + 1), skin }))];
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

// Hooks for Playwright. Keep names stable: specs and TESTING.md depend on them.
function exposeDebug(scene) {
  window.__snakeDebug__ = {
    placeGiftNextToHead(dx = 1, dy = 0) {
      const h = scene.s.body[0];
      scene.s.gift = { x: h.x + dx, y: h.y + dy, skin: nextSkin(scene.s, Math.random) };
      scene.drawFrame(1);
    },
    setDirection: (d) => turn(scene.s, d),
    getPendingDirection: () => scene.s.queue.at(-1) ?? scene.s.dir,
    getDirection: () => scene.s.dir,
    tickOnce: () => {
      if (!scene.s.alive) return;
      scene.prev = scene.s.body.map((p) => ({ ...p }));
      scene.advance();
      scene.drawFrame(1);
    },
    getSnakeLength: () => scene.s.body.length,
    getSnakeCoords: () => scene.s.body.map(({ x, y }) => ({ x, y })),
    getSkinsFiltered: () => scene.s.skins.slice(0, scene.s.body.length - 1),
    setNextGiftSkin: (k) => {
      scene.s.forcedSkin = k;
    },
    getGrid: () => ({ cols: COLS, rows: ROWS, cell: CELL }),
    rerollGift: () => {
      placeGift(scene.s, Math.random);
      scene.drawFrame(1);
      return { x: scene.s.gift.x, y: scene.s.gift.y };
    },
    isRunning: () => scene.running(),
    debugStop: (msg = 'Pause') => {
      scene.paused = true;
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
  height: ROWS * CELL,
  backgroundColor: '#000022',
  dom: { createContainer: true },
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  scene: SnakeScene,
});
