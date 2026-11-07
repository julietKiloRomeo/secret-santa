// Nissen & Kuglen view: Matter physics inside Phaser. Rules live in bauble_core.js, levels in bauble_levels.js.
import { LEVELS, WORLD } from './bauble_levels.js';
import { createRun, addMove, finishLevel, isDone, totalScore, reachedStar, fellOff } from './bauble_core.js';
import { showScores } from './arcade_scene.js';

const COLORS = { bauble: 0xffd23f, star: 0xfff3b0, block: 0xb02a3a, ramp: 0x1a5a4c, rope: 0xe8d9b0 };

class BaubleScene extends Phaser.Scene {
  constructor() {
    super('bauble');
  }

  create() {
    this.run = createRun(LEVELS.length);
    this.cameras.main.setBackgroundColor('#06201a');
    this.g = this.add.graphics();
    this.hud = this.add.text(12, 12, '', { fontFamily: 'monospace', fontSize: '18px', color: '#fff3b0' }).setDepth(10);
    this.input.on('pointerdown', (p) => this.onDown(p));
    this.input.on('pointermove', (p) => this.onMove(p));
    this.input.on('pointerup', () => this.onUp());
    this.loadLevel(0);
    window.__baubleDebug__ = { snapshot: () => this.snapshot() };
  }

  loadLevel(i) {
    this.matter.world.setBounds(0, 0, WORLD.width, WORLD.height);
    this.matter.world.engine.gravity.y = 1;
    this.level = LEVELS[i];
    this.pieces = this.level.pieces.map((p) => this.makePiece(p));
    this.bauble = this.matter.add.circle(this.level.bauble.x, this.level.bauble.y, 18, { restitution: 0.2, friction: 0.05 });
    this.state = 'playing';
    this.drag = null;
    this.draw();
  }

  makePiece(p) {
    // Pieces stay put until the player moves them; only the bauble is free-falling.
    const opts = { isStatic: true, angle: p.angle || 0, friction: 0.4 };
    const body = p.kind === 'rope'
      ? this.matter.add.rectangle(p.x, p.y, p.length, 8, opts)
      : this.matter.add.rectangle(p.x, p.y, p.w, p.h, opts);
    return { def: p, body };
  }

  onDown(p) {
    if (this.state !== 'playing') return;
    const hit = this.pieces.find((pc) => pc.body && this.containsPoint(pc.body, p));
    if (!hit) return;
    if (hit.def.removable && !this.drag) {
      this.matter.world.remove(hit.body);
      hit.body = null;
      addMove(this.run);
      this.draw();
      return;
    }
    if (hit.def.movable) this.drag = { piece: hit, dx: p.x - hit.body.position.x, dy: p.y - hit.body.position.y };
  }

  onMove(p) {
    if (!this.drag) return;
    const b = this.drag.piece.body;
    this.matter.body.setPosition(b, { x: p.x - this.drag.dx, y: p.y - this.drag.dy });
    this.drag.moved = true;
  }

  onUp() {
    if (!this.drag) return;
    if (this.drag.moved) addMove(this.run);
    this.drag = null;
  }

  containsPoint(body, p) {
    const { min, max } = body.bounds;
    return p.x >= min.x && p.x <= max.x && p.y >= min.y && p.y <= max.y;
  }

  update() {
    if (this.state !== 'playing') return;
    const pos = this.bauble.position;
    if (reachedStar(pos, { ...this.level.star })) return this.finish(true);
    if (fellOff(pos, WORLD.height)) return this.finish(false);
    this.draw();
  }

  finish(won) {
    this.state = 'over';
    if (won) finishLevel(this.run);
    this.draw();
    setTimeout(() => this.next(won), 900);
  }

  async next(won) {
    if (!won) {
      this.run.moves = 0; // a fall is a retry: the level's moves start again
      return this.loadLevel(this.run.index);
    }
    if (!isDone(this.run)) return this.loadLevel(this.run.index);
    await showScores(this, { gameId: 'advent-6', score: totalScore(this.run), title: 'Nissen & Kuglen' });
    this.run = createRun(LEVELS.length);
    this.loadLevel(0);
  }

  draw() {
    const g = this.g;
    g.clear();
    const s = this.level.star;
    g.fillStyle(COLORS.star, 1).fillCircle(s.x, s.y, s.r);
    for (const pc of this.pieces) {
      if (!pc.body) continue;
      const { x, y } = pc.body.position;
      g.fillStyle(COLORS[pc.def.kind] ?? COLORS.block, 1);
      if (pc.def.kind === 'rope') g.fillRect(x - pc.def.length / 2, y - 4, pc.def.length, 8);
      else g.fillRect(x - pc.def.w / 2, y - pc.def.h / 2, pc.def.w, pc.def.h);
    }
    const b = this.bauble.position;
    g.fillStyle(COLORS.bauble, 1).fillCircle(b.x, b.y, 18);
    this.hud.setText(`Bane ${this.run.index + 1}/${LEVELS.length}  ·  Træk ${this.run.moves}`);
  }

  snapshot() {
    return {
      level: this.run.index,
      moves: this.run.moves,
      state: this.state,
      bauble: { x: this.bauble.position.x, y: this.bauble.position.y },
      scores: this.run.scores,
    };
  }
}

new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'bauble-wrap',
  width: WORLD.width,
  height: WORLD.height,
  backgroundColor: '#06201a',
  dom: { createContainer: true },
  physics: { default: 'matter', matter: { gravity: { y: 1 }, debug: false } },
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  scene: [BaubleScene],
});
