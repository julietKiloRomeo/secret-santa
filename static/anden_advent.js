// Flappy Santa view. Rules live in anden_core.js; this file draws and handles input.
import { createRun, flap, step, previewActive, levelFor, CONFIG, TRAIL_LEN } from './anden_core.js';
import { showScores } from './arcade_scene.js';

const W = 400;
const H = 800;
const DEATH_PAUSE_MS = 1000;
const REINDEER_ASPECT = 148 / 109;
// Which trail entry each sprite samples: lead 0, then delayed followers.
const TRAIL_LAG = { lead: 0, second: 8, third: 16 };
const SANTA_LAG = 18;

class FlappyScene extends Phaser.Scene {
  preload() {
    this.load.image('sleigh', '/static/sprites/santa_sleigh.png');
    this.load.image('reindeer1', '/static/sprites/reindeer1.png');
    this.load.image('reindeer2', '/static/sprites/reindeer2.png');
    this.load.image('reindeer3', '/static/sprites/reindeer3.png');
  }

  create() {
    this.gfx = this.add.graphics().setDepth(1);
    this.sky = this.add.graphics().setDepth(0);
    this.drawSky();
    this.sleigh = this.add.image(0, 0, 'sleigh').setDepth(5);
    this.reindeer = ['reindeer1', 'reindeer2', 'reindeer3'].map((k) => this.add.image(0, 0, k).setDepth(4));
    this.scoreText = this.add
      .text(W - 16, 16, '', { fontFamily: 'monospace', fontSize: '26px', color: '#f0f8ff' })
      .setOrigin(1, 0)
      .setDepth(10);
    this.statusText = this.add
      .text(W / 2, H * 0.4, '', {
        fontFamily: 'monospace',
        fontSize: '24px',
        color: '#fde68a',
        align: 'center',
      })
      .setOrigin(0.5)
      .setDepth(10);

    this.input.on('pointerdown', () => this.onTap());
    this.input.keyboard.on('keydown-SPACE', () => this.onTap());
    window.__andenScene = this;
    this.newRun();
  }

  newRun() {
    this.run = createRun({ width: W, height: H });
    this.lastScore = 0;
    this.deathUntil = 0;
    this.busy = false;
    this.statusText.setText('');
  }

  update() {
    if (this.busy) return;
    const dt = Math.min(this.game.loop.delta, 50) / 1000; // a backgrounded tab must not teleport the bird
    step(this.run, dt);
    if (this.run.score > this.lastScore) {
      this.lastScore = this.run.score;
      if (this.run.score === CONFIG.levelTwoScore || this.run.score === CONFIG.levelThreeScore) {
        this.flash(`Level ${levelFor(this.run.score)}!`);
      }
    }
    if (this.run.state === 'dead') {
      this.die();
      return;
    }
    this.render();
  }

  onTap() {
    if (this.busy) return;
    if (this.run.state === 'dead') {
      if (this.time.now >= this.deathUntil) this.newRun();
      return;
    }
    flap(this.run);
  }

  flash(text) {
    this.statusText.setText(text);
    this.time.delayedCall(2000, () => {
      if (this.statusText.text === text) this.statusText.setText('');
    });
  }

  async die() {
    this.busy = true;
    this.render();
    this.statusText.setText('Game Over! Try igen 🎅');
    this.deathUntil = this.time.now + DEATH_PAUSE_MS;
    // Wait on the browser clock: showScores pauses this scene, which would also freeze its timers.
    await new Promise((resolve) => setTimeout(resolve, DEATH_PAUSE_MS));
    await showScores(this, { gameId: 'anden-advent', score: this.run.score, title: 'Ny high score!' });
    this.newRun();
  }

  drawSky() {
    this.sky.fillGradientStyle(0x7ec0ff, 0x7ec0ff, 0x5aa0d8, 0x5aa0d8, 1).fillRect(0, 0, W, H);
  }

  render() {
    const r = this.run;
    const g = this.gfx.clear();
    for (const c of r.chimneys) {
      g.fillStyle(0x88bb33).fillRect(c.x, 0, CONFIG.chimneyWidth, c.top);
      g.fillRect(c.x, c.top + r.gap, CONFIG.chimneyWidth, H - c.top - r.gap);
      g.fillStyle(0xaa3333).fillRect(c.x - 4, c.top - 8, CONFIG.chimneyWidth + 8, 8);
      g.fillRect(c.x - 4, c.top + r.gap, CONFIG.chimneyWidth + 8, 8);
    }
    if (previewActive(r)) g.lineStyle(2, 0xffffff, 0.8).strokeRect(W - 30, r.gapPlan, 14, r.gap);

    this.scoreText.setText(`Score ${r.score}`);
    const reW = r.birdW * 0.55;
    const reH = reW * REINDEER_ASPECT;
    const xs = [
      r.leadX,
      r.playerX + Math.round(W * CONFIG.secondOffsetRatio),
      r.playerX + Math.round(W * CONFIG.thirdOffsetRatio),
    ];
    const lags = [TRAIL_LAG.lead, TRAIL_LAG.second, TRAIL_LAG.third];
    this.reindeer.forEach((img, i) => place(img, xs[i], r.trail[lags[i]], reW, reH));
    place(this.sleigh, r.playerX, r.trail[Math.min(TRAIL_LEN - 1, SANTA_LAG)], r.birdW * 1.8, r.birdH * 1.4);
  }
}

// Hooks for Playwright: read-only snapshot of the run.
window.__andenDebug__ = {
  snapshot: () => {
    const r = window.__andenScene?.run;
    return r && { state: r.state, y: r.y, score: r.score, chimneys: r.chimneys.length, scale: r.scale };
  },
};

function place(img, x, y, w, h) {
  img.setPosition(x, y).setDisplaySize(w, h);
}

new Phaser.Game({
  type: Phaser.CANVAS,
  parent: 'santa-canvas-wrap',
  width: W,
  height: H,
  backgroundColor: '#68b',
  dom: { createContainer: true },
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  scene: FlappyScene,
});
