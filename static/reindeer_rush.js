// Reindeer Rush view: draws the run and turns input into core actions. Rules are in reindeer_core.js.
import { createRun, tick, jump, duck, unduck, dash, STEP, REINDEER_X } from './reindeer_core.js';
import { showScores } from './arcade_scene.js';

const W = 640;
const H = 260;
const GROUND_SURFACE_ROW = 78; // ground.png: the grass line sits on this row
const GROUND_W = 364;
const GROUND_H = 212;
const RUDOLPH = { run: 6, jump: 3 }; // frame counts: /static/sprites/rudolph/{run,jump}-N.png
const SWIPE_PX = 24; // same swipe threshold as Snake

class ReindeerScene extends Phaser.Scene {
  preload() {
    for (let i = 1; i <= RUDOLPH.run; i += 1)
      this.load.image(`run${i}`, `/static/sprites/rudolph/run-${i}.png`);
    for (let i = 1; i <= RUDOLPH.jump; i += 1)
      this.load.image(`jump${i}`, `/static/sprites/rudolph/jump-${i}.png`);
    this.load.image('slide', '/static/sprites/rudolph/slide.png');
    this.load.image('ground', '/static/sprites/ground.png');
    this.load.image('snowman', '/static/sprites/snowman.png');
    this.load.image('moon', '/static/BG/moon.png');
    this.load.audio('jump', '/static/jump.mp3');
    this.load.audio('coin', '/static/coin.mp3');
    this.load.audio('death', '/static/explosion.mp3');
  }

  create() {
    this.sky = this.add.graphics().setDepth(0);
    this.add
      .image(W - 70, 50, 'moon')
      .setScale(0.4)
      .setDepth(1);
    this.rudolph = this.add.image(REINDEER_X, 0, 'run1').setOrigin(0.5, 1).setDepth(4);
    // Sprite pools: reuse images each frame instead of creating new ones.
    this.groundImgs = [];
    this.snowmanImgs = [];
    this.label = this.add
      .text(12, 10, '', { fontFamily: 'monospace', fontSize: '16px', color: '#fff' })
      .setDepth(9);
    this.hint = this.add
      .text(W / 2, H * 0.3, 'Tap eller mellemrum for at løbe', {
        fontFamily: 'monospace',
        fontSize: '16px',
        color: '#fde68a',
      })
      .setOrigin(0.5)
      .setDepth(9);

    this.run = null;
    this.busy = false;
    this.frameClock = 0;
    this.holdStart = null;
    this.drag = null;
    this.input.keyboard.on('keydown-SPACE', () => this.pressJump());
    this.input.keyboard.on('keydown-DOWN', () => this.setDuck(true));
    this.input.keyboard.on('keyup-DOWN', () => this.setDuck(false));
    this.input.keyboard.on('keydown-RIGHT', () => this.dashNow());
    this.input.on('pointerdown', (p) => {
      this.drag = { x: p.x, y: p.y };
      this.pressJump();
    });
    this.input.on('pointermove', (p) => this.onDrag(p));
    this.input.on('pointerup', (p) => this.onRelease(p));
    window.__rrDebug__ = {
      snapshot: () => ({
        state: this.run.state,
        score: this.run.score,
        y: this.run.y,
        snowmen: this.run.snowmen.length,
      }),
    };
    this.newRun();
  }

  newRun() {
    this.run = createRun({ width: W, height: H });
    this.busy = false;
    this.accum = 0;
    this.hint.setVisible(true);
    this.label.setText('');
    this.drawRun();
  }

  pressJump() {
    if (this.busy) return;
    if (this.run.state === 'dead') return this.newRun();
    jump(this.run, false);
    if (this.run.state === 'running') this.hint.setVisible(false);
    this.sound.play('jump', { volume: 0.4 });
  }

  setDuck(on) {
    if (this.busy) return;
    if (on) duck(this.run);
    else unduck(this.run);
  }

  dashNow() {
    if (this.busy || this.run.state === 'dead') return;
    dash(this.run);
  }

  onDrag(p) {
    if (!this.drag) return;
    const dx = p.x - this.drag.x;
    const dy = p.y - this.drag.y;
    if (dy > SWIPE_PX && Math.abs(dy) > Math.abs(dx)) {
      this.setDuck(true);
      this.drag.used = 'duck';
    }
    if (dx > SWIPE_PX && Math.abs(dx) > Math.abs(dy) && !this.drag.used) {
      this.dashNow();
      this.drag.used = 'dash';
    }
  }

  onRelease() {
    this.setDuck(false);
    this.drag = null;
  }

  update(_t, delta) {
    if (this.busy) return;
    // Fixed-step simulation: the same rules whatever the frame rate.
    this.accum += Math.min(delta, 100) / 1000;
    while (this.accum >= STEP) {
      tick(this.run, STEP);
      this.accum -= STEP;
      if (this.run.state === 'dead') break;
    }
    if (this.run.state === 'dead') return this.die();
    this.drawRun();
  }

  async die() {
    this.busy = true;
    this.hint.setText('Ouch!').setVisible(true);
    this.sound.play('death', { volume: 0.5 });
    await new Promise((r) => this.time.delayedCall(1200, r));
    await showScores(this, { gameId: 'advent-4', score: this.run.score, title: 'Reindeer Rush' });
    this.newRun();
  }

  drawRun() {
    const r = this.run;
    this.label.setText(`Score ${r.score}`);
    this.sky.clear().fillStyle(0x0d093a).fillRect(0, 0, W, H);

    this.placeAll(this.groundImgs, 'ground', r.platforms, (img, p) => {
      const scale = p.w / GROUND_W;
      img
        .setPosition(p.x, p.y - GROUND_SURFACE_ROW * scale)
        .setOrigin(0, 0)
        .setDisplaySize(p.w, GROUND_H * scale);
    });
    this.placeAll(this.snowmanImgs, 'snowman', r.snowmen, (img, s) => {
      img.setPosition(s.x, r.groundY).setOrigin(0, 1).setDisplaySize(s.w, s.h);
    });

    // Draw Rudolph at the hitbox height so what you see is what collides, keeping the sprite's aspect.
    const drawH = r.hitbox.h * r.scale * 1.6;
    this.rudolph
      .setTexture(this.frameFor(r))
      .setPosition(REINDEER_X, r.y)
      .setDisplaySize(drawH * (351 / 291), drawH);
  }

  frameFor(r) {
    if (r.state === 'ready') return 'run1';
    if (!r.grounded) return `jump${1 + Math.min(RUDOLPH.jump - 1, Math.floor((r.vy + 600) / 300))}`;
    if (r.ducking) return 'slide';
    this.frameClock += 1;
    return `run${1 + (Math.floor(this.frameClock / 4) % RUDOLPH.run)}`;
  }

  // Show one image per item from the pool, hiding unused ones.
  placeAll(pool, key, items, place) {
    items.forEach((item, i) => {
      pool[i] ??= this.add.image(0, 0, key).setDepth(3);
      pool[i].setVisible(true);
      place(pool[i], item);
    });
    for (let i = items.length; i < pool.length; i += 1) pool[i].setVisible(false);
  }
}

new Phaser.Game({
  type: Phaser.CANVAS,
  parent: 'reindeer-canvas',
  width: W,
  height: H,
  backgroundColor: '#0d093a',
  dom: { createContainer: true },
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  scene: ReindeerScene,
});
