// Reindeer Rush view: draws the run and turns input into core actions. Rules are in reindeer_core.js.
import { createRun, tick, jump, duck, unduck, dash, STEP, REINDEER_X } from './reindeer_core.js';
import { showScores } from './arcade_scene.js';

const W = 640;
const H = 260;
const SWIPE_PX = 24; // same swipe threshold as Snake
const SPRITE = { run: 'rr/run.png', jump: 'rr/jump.png', slide: 'rr/slide.png', snowman: 'rr/snowman.png', islandA: 'rr/island-a.png', islandB: 'rr/island-b.png' };

class ReindeerScene extends Phaser.Scene {
  preload() {
    for (const [key, file] of Object.entries(SPRITE)) this.load.image(key, `/static/sprites/${file}`);
    this.load.image('snowball', '/static/sprites/rr/snowball.png');
    this.load.image('star', '/static/sprites/rr/star.png');
    this.load.audio('jump', '/static/jump.mp3');
    this.load.audio('coin', '/static/coin.mp3');
    this.load.audio('death', '/static/explosion.mp3');
  }

  create() {
    this.sky = this.add.graphics().setDepth(0);
    this.flakes = Array.from({ length: 40 }, () => ({ x: Math.random() * W, y: Math.random() * H, v: 20 + Math.random() * 40 }));
    this.snowGfx = this.add.graphics().setDepth(1);
    this.platformImgs = [];
    this.snowmanImgs = [];
    this.reindeer = this.add.image(REINDEER_X, 0, 'run').setOrigin(0.5, 1).setDepth(4);
    this.label = this.add.text(12, 10, '', { fontFamily: 'monospace', fontSize: '16px', color: '#fff3b0' }).setDepth(9);
    this.hint = this.add
      .text(W / 2, H * 0.3, 'Tryk for at hoppe · swipe ned for at ducke · swipe højre for at dashe', {
        fontFamily: 'monospace',
        fontSize: '14px',
        color: '#fde68a',
        align: 'center',
        wordWrap: { width: W - 40 },
      })
      .setOrigin(0.5)
      .setDepth(9);

    this.busy = false;
    this.frameClock = 0;
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
    this.input.on('pointerup', () => this.onRelease());
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
    this.hint.setText('Av!').setVisible(true);
    this.sound.play('death', { volume: 0.5 });
    await new Promise((r) => this.time.delayedCall(1200, r));
    await showScores(this, { gameId: 'advent-4', score: this.run.score, title: 'Reindeer Rush' });
    this.newRun();
  }

  drawRun() {
    const r = this.run;
    this.label.setText(`Score ${r.score}`);
    this.drawSky();
    this.placeAll(this.platformImgs, (i) => (i % 2 ? 'islandB' : 'islandA'), r.platforms, (img, p) => {
      // Each island is drawn to the platform's width, with its top surface on the platform's y.
      const scale = p.w / img.width;
      img.setOrigin(0, 0).setScale(scale).setDepth(3);
      img.setPosition(p.x, p.y - img.displayHeight * 0.18);
    });
    this.placeAll(this.snowmanImgs, () => 'snowman', r.snowmen, (img, s) => {
      img.setPosition(s.x, r.groundY).setOrigin(0, 1).setDisplaySize(s.w * 1.8, s.h * 1.8);
    });

    // Reindeer frame by state. The drawn height matches the hitbox so what you see is what collides.
    const key = this.frameFor(r);
    const baseH = r.hitbox.h * r.scale * 1.8;
    this.reindeer.setTexture(key).setPosition(REINDEER_X, r.y).setDisplaySize(baseH * (this.reindeer.width / this.reindeer.height), baseH);
  }

  drawSky() {
    const g = this.sky.clear();
    g.fillGradientStyle(0x0d093a, 0x0d093a, 0x2a1a5e, 0x2a1a5e, 1);
    g.fillRect(0, 0, W, H);
    g.fillStyle(0xffffff, 0.8);
    for (const f of this.flakes) {
      f.y += f.v * (1 / 60);
      if (f.y > H) f.y = -4;
      g.fillCircle(f.x, f.y, 1.4);
    }
  }

  frameFor(r) {
    if (r.state === 'ready') return 'run';
    if (!r.grounded) return 'jump';
    if (r.ducking) return 'slide';
    return 'run';
  }

  // Show one image per item from a pool, hiding unused ones. Pool entries are created on demand.
  placeAll(pool, keyFor, items, place) {
    items.forEach((item, i) => {
      pool[i] ??= this.add.image(0, 0, keyFor(i)).setDepth(3);
      pool[i].setTexture(keyFor(i)).setVisible(true);
      place(pool[i], item, i);
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
