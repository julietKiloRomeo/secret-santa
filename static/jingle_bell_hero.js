// Jingle Bell Hero view: draws the lanes and notes and handles the four keys.
// Rules are in jingle_bell_rules.js; audio is in jingle_bell_hero_core.js.
import { loadSongCharts } from './jingle_bell_hero_chart.js';
import { AudioPlayer, SCROLL_SPEED, HIT_ZONE_Y } from './jingle_bell_hero_core.js';
import { createGame, update, press, release, prepareLevel, MISS_LIMIT } from './jingle_bell_rules.js';
import { showScores } from './arcade_scene.js';

const W = 800;
const H = 820;
const LANES = [1, 2, 3, 4];
const LANE_X = (lane) => lane * (W / (LANES.length + 1));
const KEYS = { d: 1, f: 2, j: 3, k: 4 };
const LANE_LETTER = ['D', 'F', 'J', 'K'];
const AUDIO = new AudioPlayer();
const TOP = 40; // lanes start here, the visible playfield runs from TOP to H

class JingleScene extends Phaser.Scene {
  constructor() {
    super('jingle');
  }

  create() {
    this.gfx = this.add.graphics().setDepth(1);
    this.hud = this.add
      .text(16, 16, '', { fontFamily: 'monospace', fontSize: '22px', color: '#fff', lineSpacing: 6 })
      .setDepth(10);
    this.feedback = this.add
      .text(0, 0, '', { fontFamily: 'monospace', fontSize: '26px', color: '#22c55e' })
      .setOrigin(0.5)
      .setDepth(10);
    this.statusText = this.add
      .text(W / 2, H / 2, 'Hent sangene…', { fontFamily: 'monospace', fontSize: '28px', color: '#fde68a' })
      .setOrigin(0.5)
      .setDepth(10);

    this.keys = this.input.keyboard.addKeys('D,F,J,K');
    this.input.keyboard.on('keydown', (e) => this.onKey(e, true));
    this.input.keyboard.on('keyup', (e) => this.onKey(e, false));
    this.input.on('pointerdown', (p) => this.onBell(p, true));
    this.input.on('pointerup', (p) => this.onBell(p, false));

    this.levelIndex = 0;
    this.run = null;
    // Read-only hook for Playwright: where the next unjudged note is.
    window.__jbhDebug__ = {
      snapshot: () => {
        const r = this.run;
        if (!r) return null;
        const next = r.notes.find((n) => !r.played.has(n.id) && !r.holding.has(n.id));
        return {
          state: r.state,
          time: r.time,
          score: r.score,
          lives: r.lives,
          next: next && { lane: next.lane, start: next.start },
        };
      },
    };
    this.songs = null;
    this.clock = 0; // song time in seconds, starts at the ready countdown
    loadSongCharts()
      .then((songs) => {
        this.songs = songs;
        this.statusText.setText('Tryk for at starte');
      })
      .catch(() => this.statusText.setText('Kunne ikke hente sangene til nisse-bjælderne.'));
  }

  // Tap or click starts a level; a tap on a bell while playing is a note press.
  onBell(p, down) {
    if (!this.songs) return;
    if (!this.run) {
      if (down) this.startLevel(0);
      return;
    }
    if (this.run.state === 'over') {
      if (down) this.finish();
      return;
    }
    const lane = this.laneAt(p.x, p.y);
    if (!lane) return;
    if (down) press(this.run, lane);
    else release(this.run, lane);
  }

  onKey(e, down) {
    if (!this.songs) return;
    const lane = KEYS[e.key?.toLowerCase()];
    if (!this.run) {
      if (down && lane) this.startLevel(0);
      return;
    }
    if (!lane || this.run.state !== 'playing') return;
    if (down && !e.repeat) press(this.run, lane);
    if (!down) release(this.run, lane);
  }

  laneAt(x, y) {
    if (y < TOP) return null;
    const lane = LANES.find((l) => Math.abs(x - LANE_X(l)) < W / 10);
    return lane ?? null;
  }

  startLevel(levelIndex) {
    this.levelIndex = levelIndex;
    const { notes, label } = prepareLevel(this.songs, levelIndex);
    this.label = label;
    this.run = createGame(notes, { level: levelIndex });
    this.clock = 0;
    this.statusText.setText('');
  }

  update() {
    if (!this.run) return;
    // Song time = seconds since this level started. Capped step so a hidden tab can't skip notes.
    const dt = Math.min(this.sys.game.loop.delta, 50) / 1000;
    this.clock += dt;
    update(this.run, this.clock);
    if (this.run.state === 'levelDone') this.startLevel(this.levelIndex + 1);
    if (this.run.state === 'over') this.endGame();
    this.render();
  }

  endGame() {
    this.statusText.setText('Game Over!');
    setTimeout(() => this.finish(), 1200);
  }

  async finish() {
    const score = this.run.score;
    this.run = null;
    await showScores(this, { gameId: 'advent-3', score, title: 'Jingle Bell Hero' });
    this.statusText.setText('Tryk for at starte');
  }

  render() {
    const g = this.gfx.clear();
    for (const lane of LANES) {
      g.fillStyle(lane % 2 ? 0xffffff : 0xffffff, lane % 2 ? 0.05 : 0.03).fillRoundedRect(
        LANE_X(lane) - 90,
        TOP,
        180,
        H - 120,
        18,
      );
    }
    g.lineStyle(8, 0xffffff, 0.9).lineBetween(0, HIT_ZONE_Y, W, HIT_ZONE_Y);
    if (this.run) {
      for (const n of this.run.notes) {
        if (this.run.played.has(n.id) && !this.run.holding.has(n.id)) continue;
        const y = HIT_ZONE_Y - (n.start - this.run.time) * SCROLL_SPEED;
        if (y < -80 || y > H + 40) continue;
        if (n.sustained) {
          const endY = HIT_ZONE_Y - (n.end - this.run.time) * SCROLL_SPEED;
          g.lineStyle(10, this.run.holding.has(n.id) ? 0x22c55e : 0xfbbf24, 1).lineBetween(
            LANE_X(n.lane),
            endY,
            LANE_X(n.lane),
            y,
          );
          g.fillStyle(0xfbbf24).fillCircle(LANE_X(n.lane), endY, 15);
        }
        g.fillStyle(0xfbbf24).fillCircle(LANE_X(n.lane), y, 18);
      }
      const misses = this.run.missStreak;
      this.hud.setText([
        `Score: ${this.run.score}`,
        `Combo: ${this.run.combo}x`,
        `Lives: ${'♥'.repeat(this.run.lives)}`,
        `Miss ${misses}/${MISS_LIMIT}`,
        this.label ?? '',
      ]);
    }
    for (const lane of LANES) {
      g.fillStyle(0xffe08a, 0.9).fillCircle(LANE_X(lane), HIT_ZONE_Y + 70, 30);
    }
  }
}

new Phaser.Game({
  type: Phaser.CANVAS,
  parent: 'jingle-bell-hero-root',
  width: W,
  height: H,
  backgroundColor: '#0f172a',
  dom: { createContainer: true },
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  scene: JingleScene,
});
