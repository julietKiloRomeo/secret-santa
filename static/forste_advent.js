// Første Advent: Jule Snake on Phaser. Rules live in snake_core.js.
// Fixed-step simulation (tickMsFor sets the pace) drawn with interpolation, so motion stays smooth
// at any frame rate. The simulation never depends on the frame rate.
import {
  createSnake,
  step,
  turn,
  swipeDir,
  placeGift,
  nextSkin,
  tickMsFor,
  shouldStepNow,
} from './snake_core.js';
import { showScores } from './arcade_scene.js';
import { boardFor } from './snake_board.js';
import { FEEL } from './snake_feel.js';
import {
  placeFloor,
  tickFloor,
  eatPowerup,
  activeEffects,
  expirePowerup,
  cardFor,
  needsCard,
  markCardSeen,
} from './snake_powerups.js';

const { cols: COLS, rows: ROWS } = boardFor(window.innerWidth, window.innerHeight);
const CELL = 30; // logical px; Scale.FIT stretches the board to the page
const MAX_FRAME_MS = 250; // clamp so a stalled tab cannot queue a burst of ticks
const COLORS = {
  bg: 0x000022,
  grid: 0x111144,
  snake: 0x2c8a2c,
  edge: 0x1e5e1e,
  burst: 0xfde68a,
  glow: 0xfde68a,
  puRing: 0x7dd3fc,
};
// Gift emoji from snake_core.js mapped to pixel-art sprites in static/sprites/snake/.
const SKIN_SPRITE = {
  '🎁': 'gift-red',
  '🍬': 'candy',
  '🧦': 'sock',
  '🍪': 'cookie',
  '🧸': 'gift-blue',
  '🍫': 'gift-green',
};
const SPRITE_FILES = {
  ...Object.fromEntries(Object.values(SKIN_SPRITE).map((k) => [k, k])),
  head: 'head',
  'pu-shield': 'pu-shield',
  'pu-ghost': 'pu-ghost',
  'pu-trim': 'pu-trim',
};
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
    this.glow = this.add.graphics().setDepth(3);
    this.puRing = this.add.graphics().setDepth(4);
    this.puSprite = this.add.image(0, 0, 'pu-shield').setVisible(false);
    this.hudEl = null; // effects line is created on first use, see refreshHud
    this.head = this.add.image(0, 0, 'head').setVisible(false);
    this.headPop = 1;
    this.marks = []; // reusable sprite objects for the gift and the body skins
    this.input.keyboard.on('keydown', (e) => this.onKey(e));
    this.input.on('pointerdown', (p) => {
      if (this.cardOpen) return this.dismissCard();
      if (this.waiting) return; // a tap during the wait does not reset the run
      if (!this.running() && !this.busy) this.restart();
      this.swipe = p.position.clone();
    });
    this.input.on('pointerup', (p) => {
      const dir =
        this.swipe &&
        swipeDir((p.x - this.swipe.x) * this.scaleRatio(), (p.y - this.swipe.y) * this.scaleRatio());
      this.swipe = null;
      if (dir && this.waiting) this.startFromWait(dir);
      else if (dir) turn(this.s, dir);
      if (dir) beep(this, 440, 40, 'square', 0.01);
    });
    this.paused = false;
    this.acc = 0;
    this.restart();
    exposeDebug(this);
  }

  // Accumulate real time and run whole ticks; draw between ticks at the fractional position.
  update(_time, delta) {
    if (this.stopLeft > 0) this.stopLeft -= delta; // hit-stop: real time, input still queues
    if (!this.running() || this.stopLeft > 0) return this.drawFrame(1);
    this.acc += Math.min(delta, MAX_FRAME_MS);
    let tick = tickMsFor(this.s.score);
    // A turn pressed mid-tick steps early (shouldStepNow), so keys do not wait for the next tick.
    if (shouldStepNow({ acc: this.acc, tick, queued: this.s.queue.length })) this.acc = tick;
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
    if (this.cardOpen) return this.dismissCard();
    if (this.waiting) {
      if (KEY_DIR[e.key]) {
        this.startFromWait(KEY_DIR[e.key]);
        beep(this, 440, 40, 'square', 0.01);
      }
      return;
    }
    if (!this.running() && !this.busy && RESTART_KEYS.has(e.code)) this.restart();
    if (KEY_DIR[e.key]) {
      turn(this.s, KEY_DIR[e.key]);
      beep(this, 440, 40, 'square', 0.01);
    }
  }

  restart() {
    this.waiting = false;
    this.seenCards = new Set(); // every game start: the loot cards are read again once
    this.s = createSnake(COLS, ROWS, Math.random);
    placeFloor(this.s, Math.random); // the floor holds one gift or powerup, never both
    this.prev = this.s.body.map((p) => ({ ...p }));
    this.paused = false;
    this.acc = 0;
    this.stopLeft = 0;
    scoreEl.textContent = 'Score: 0';
    setStatus('Klar! Tap eller brug piletasterne.');
    this.drawFrame(1);
  }

  // One simulation tick. Only ever called from update() or the debug hook.
  advance() {
    const r = step(this.s, Math.random);
    if (r === 'dead') return this.gameOver();
    if (r === 'absorbed') return this.holdForDirection(); // shield stopped a wall: pick a way out
    tickFloor(this.s, Math.random); // a waiting powerup counts down one tick
    if (r === 'ate') {
      placeFloor(this.s, Math.random); // refill the floor: gift or powerup
      this.onPickup();
    }
    if (r === 'powered') {
      eatPowerup(this.s, this.s.lastPowerup);
      placeFloor(this.s, Math.random);
      this.onPowerup(this.s.lastPowerup);
    }
    this.refreshHud();
  }

  // Shield and ghost counts plus the trim note, so stacked pickups stay readable.
  refreshHud() {
    const e = activeEffects(this.s);
    const parts = [];
    if (e.shield) parts.push(`🛡 ${e.shield}`);
    if (e.ghost) parts.push(`👻 ${e.ghost}`);
    if (!this.hudEl) {
      this.hudEl = document.createElement('div');
      this.hudEl.className = 'game-status';
      this.hudEl.style.top = '6.5rem';
      statusEl?.parentElement?.appendChild(this.hudEl);
    }
    this.hudEl.textContent = parts.join('  ');
  }

  // First pickup of a kind: pause and show its loot card. Later pickups only play the sound.
  onPowerup(kind) {
    beep(this, 660, 150, 'triangle', 0.03);
    this.seenCards ??= new Set();
    this.lastCardKind = kind;
    if (!needsCard(this.seenCards, kind)) return;
    markCardSeen(this.seenCards, kind);
    this.showCard(kind);
  }

  showCard(kind) {
    const c = cardFor(kind);
    this.card?.destroy();
    const W = this.scale.width;
    const H = this.scale.height;
    const box = this.add.container(W / 2, H / 2).setDepth(20);
    const panel = this.add.rectangle(0, 0, W * 0.8, H * 0.5, 0x0b1020, 0.96).setStrokeStyle(2, 0xfbbf24, 0.9);
    // The card text is DOM, so it is crisp at any scale (same as the score screen and name input).
    const el = document.createElement('div');
    el.className = 'arcade-card';
    el.style.width = `${W * 0.72}px`;
    el.innerHTML = `
      <div class="arcade-card-title">${c.name}</div>
      <div class="arcade-card-flavor">${c.flavor}</div>
      <div class="arcade-card-effect">${c.effect}</div>
      <div class="arcade-card-hint">[ tap or press a key ]</div>`;
    const dom = this.add.dom(W / 2, H / 2, el);
    const title = dom;
    const flavor = dom;
    const effect = dom;
    const hint = dom;
    box.add([panel, dom]);
    this.card = box;
    this.cardOpen = true;
    this.paused = true; // the card holds the game until the player dismisses it
    this.time.delayedCall(250, () => {
      this.cardReady = true; // ignore the key or tap that picked the powerup up
    });
  }

  // Closing the card leaves the game waiting, paused, until a direction is pressed.
  dismissCard() {
    if (!this.cardOpen || !this.cardReady) return;
    this.card?.destroy();
    this.card = null;
    this.cardOpen = false;
    this.cardReady = false;
    this.waiting = true;
    setStatus('Good luck. Press a direction to start again');
  }

  // In the waiting state only a direction (key or swipe) resumes the game.
  // A shield stopped the snake at a wall. Pause and wait for a direction, like after a loot card.
  holdForDirection() {
    this.waiting = true;
    this.paused = true;
    beep(this, 330, 160, 'triangle', 0.03);
    setStatus('Good luck. Press a direction to start again');
  }

  startFromWait(dir) {
    this.waiting = false;
    this.paused = false;
    setStatus('');
    turn(this.s, dir);
  }

  onPickup() {
    scoreEl.textContent = `Score: ${this.s.score}`;
    beep(this, 880, 120, 'sine', 0.03);
    this.time.delayedCall(120, () => beep(this, 1320, 120, 'sine', 0.02));
    if (REDUCE_MOTION) return;
    const h = this.s.body[0];
    this.burst(h.x * CELL + CELL / 2, h.y * CELL + CELL / 2, FEEL.pickup.burstCount);
    this.stopLeft = FEEL.pickup.stopMs;
    this.headPop = FEEL.pickup.popScale;
    this.tweens.add({ targets: this, headPop: 1, duration: FEEL.pickup.popMs, ease: 'Back.easeOut' });
  }

  // Powerup on the floor: its sprite with a shrinking countdown ring. Blinks in its last 3 ticks.
  drawPowerup(pu) {
    if (!pu) return;
    const x = pu.x * CELL + CELL / 2;
    const y = pu.y * CELL + CELL / 2;
    const left = pu.ttl / pu.maxTtl;
    const blink = pu.ttl <= 3 && Math.floor(this.time.now / 120) % 2 === 0;
    this.puSprite
      .setTexture(`pu-${pu.kind}`)
      .setPosition(x, y)
      .setDisplaySize(CELL - 2, CELL - 2)
      .setDepth(4)
      .setAlpha(blink ? 0.35 : 1)
      .setVisible(true);
    this.puRing
      .clear()
      .lineStyle(3, COLORS.puRing, 0.9)
      .beginPath()
      .arc(x, y, CELL * 0.62, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * left, false)
      .strokePath();
  }

  // Soft pulsing ring under the floor gift. Drawn in the body graphics layer, so no extra objects.
  drawGlow(gift) {
    if (!gift || REDUCE_MOTION) {
      this.glow.clear(); // a powerup or no item on the floor: no gift glow
      return;
    }
    const pulse = 0.5 + 0.5 * Math.sin(this.time.now / 180);
    const x = gift.x * CELL + CELL / 2;
    const y = gift.y * CELL + CELL / 2;
    this.glow
      .clear()
      .lineStyle(2, COLORS.glow, 0.35 + 0.4 * pulse)
      .strokeCircle(x, y, CELL * (0.55 + 0.1 * pulse));
  }

  // Ring of small circles that expands and fades. Visual only.
  burst(x, y, count) {
    for (let i = 0; i < count; i += 1) {
      const a = (i / count) * Math.PI * 2;
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
    if (!REDUCE_MOTION) {
      this.stopLeft = FEEL.death.stopMs;
      this.cameras.main.shake(260, 0.012 * FEEL.death.trauma);
      this.cameras.main.flash(FEEL.death.flashMs, 255, 80, 80, false);
    }
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
    this.body.clear();
    const h = at(0);
    this.head
      .setVisible(true)
      .setTexture('head')
      .setPosition(h.x * CELL + CELL / 2, h.y * CELL + CELL / 2)
      .setDisplaySize(CELL * (this.headPop ?? 1), CELL * (this.headPop ?? 1))
      .setRotation(HEAD_ANGLE[this.s.dir] ?? 0);
    // Body segments are presents too: skins[i] is drawn on body[i + 1].
    // The floor gift is drawn last, on top of the body, with a pulsing glow so it reads at a glance.
    const bodyMarks = skins.slice(0, body.length - 1).map((skin, i) => ({ ...at(i + 1), skin }));
    const marks = [...bodyMarks, ...(gift ? [{ ...gift, floor: true }] : [])];
    marks.forEach((m, i) => {
      this.marks[i] ??= this.add.image(0, 0, 'gift-red');
      this.marks[i]
        .setTexture(SKIN_SPRITE[m.skin] ?? 'gift-red')
        .setPosition(m.x * CELL + CELL / 2, m.y * CELL + CELL / 2)
        .setDisplaySize(CELL - 4, CELL - 4)
        .setVisible(true)
        .setDepth(m.floor ? 4 : 2);
    });
    this.marks.slice(marks.length).forEach((t) => t.setVisible(false));
    this.drawGlow(gift);
    if (this.s.powerup) this.drawPowerup(this.s.powerup);
    else {
      this.puSprite.setVisible(false);
      this.puRing.clear();
    }
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
    placePowerupNextToHead(kind = 'shield', dx = 1, dy = 0) {
      const h = scene.s.body[0];
      scene.s.gift = null;
      scene.s.powerup = { x: h.x + dx, y: h.y + dy, kind, ttl: 40, maxTtl: 40 };
      scene.drawFrame(1);
    },
    getEffects: () => activeEffects(scene.s),
    getCard: () =>
      scene.cardOpen ? { open: true, name: cardFor(scene.lastCardKind)?.name } : { open: false },
    getPowerup: () => (scene.s.powerup ? { ...scene.s.powerup } : null),
    placeGiftNextToHead(dx = 1, dy = 0) {
      const h = scene.s.body[0];
      scene.s.gift = { x: h.x + dx, y: h.y + dy, skin: nextSkin(scene.s, Math.random) };
      scene.drawFrame(1);
    },
    setDirection: (d) => turn(scene.s, d),
    getPendingDirection: () => scene.s.queue.at(-1) ?? scene.s.dir,
    getDirection: () => scene.s.dir,
    getQueue: () => [...scene.s.queue],
    tickOnce: () => {
      if (!scene.s.alive || scene.waiting) return; // a wait must hold, as in the real loop
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
    isWaiting: () => Boolean(scene.waiting),
    isAlive: () => scene.s.alive,
    grantEffect: (kind) => eatPowerup(scene.s, kind),
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
