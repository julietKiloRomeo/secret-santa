// Nissen & Kuglen view: rope-cutting in Matter physics inside Phaser.
// Rules live in bauble_core.js, levels in bauble_levels.js.
import { LEVELS, WORLD } from './bauble_levels.js';
import { createRun, finishLevel, isDone, totalScore, fellOff, segmentsCross } from './bauble_core.js';
import { showScores } from './arcade_scene.js';

const COLORS = { bauble: 0xffd23f, stocking: 0xb02a3a, rope: 0xe8d9b0, peg: 0xd4a017 };
const BAUBLE_R = 18;
const LINK = 6;

class BaubleScene extends Phaser.Scene {
  constructor() {
    super('bauble');
  }

  create() {
    this.run = createRun(LEVELS.length);
    this.cameras.main.setBackgroundColor('#06201a');
    this.g = this.add.graphics();
    this.hud = this.add.text(12, 12, '', { fontFamily: 'monospace', fontSize: '18px', color: '#fff3b0' }).setDepth(10);
    this.swipe = null;
    this.input.on('pointerdown', (p) => (this.swipe = { a: { x: p.x, y: p.y }, b: { x: p.x, y: p.y } }));
    this.input.on('pointermove', (p) => this.swipe && this.onSwipe(p));
    this.input.on('pointerup', () => (this.swipe = null));
    this.loadLevel(0);
    window.__baubleDebug__ = { snapshot: () => this.snapshot() };
  }

  loadLevel(i) {
    // Clear the previous level's bodies, otherwise leftovers stay in the world.
    for (const b of this.matter.world.getAllBodies()) if (!this.isWall(b)) this.matter.world.remove(b);
    for (const c of this.matter.world.getAllConstraints()) this.matter.world.remove(c);
    this.matter.world.setBounds(0, 0, WORLD.width, WORLD.height);
    this.matter.world.engine.gravity.y = 1;
    this.level = LEVELS[i];
    this.ropes = this.level.ropes.map((r) => this.makeRope(r));
    this.baubles = this.level.baubles.map((b) => this.matter.add.circle(b.x, b.y, BAUBLE_R, { restitution: 0.2, friction: 0.05 }));
    // The stocking is a bowl: a solid floor and two side walls around a catch area, with a sensor
    // above it. The bauble counts as landed only once it is inside the bowl and nearly at rest.
    const st = this.level.stocking;
    const t = 10;
    this.matter.add.rectangle(st.x, st.y + st.h / 2, st.w, t, { isStatic: true });
    this.matter.add.rectangle(st.x - st.w / 2, st.y, t, st.h, { isStatic: true });
    this.matter.add.rectangle(st.x + st.w / 2, st.y, t, st.h, { isStatic: true });
    this.catch = { x: st.x, y: st.y - st.h / 2, w: st.w, h: st.h };
    this.landed = false;
    this.state = 'playing';
    this.levelStart = this.time.now;
    this.draw();
  }

  // A rope is a chain of links from a peg to the bauble. Each link keeps a constraint so a cut can drop it.
  makeRope(r) {
    const seg = r.length / r.segments;
    const anchor = this.matter.add.circle(r.peg.x, r.peg.y, 4, { isStatic: true });
    const links = [];
    for (let k = 0; k < r.segments; k++) {
      links.push(this.matter.add.rectangle(r.peg.x, r.peg.y + (k + 1) * seg, LINK, seg, { frictionAir: 0.02 }));
    }
    const cs = [this.matter.add.constraint(anchor, links[0], 0, 1, { length: 0 })];
    for (let k = 0; k + 1 < links.length; k++) {
      cs.push(this.matter.add.constraint(links[k], links[k + 1], 0, 1, { length: 0 }));
    }
    return { peg: r.peg, links, constraints: cs, cut: false };
  }

  isWall(b) {
    return b.isStatic && (b.position.y === -32 || b.position.y === 932 || b.position.x === -32 || b.position.x === 672);
  }

  onSwipe(p) {
    this.swipe.b = { x: p.x, y: p.y };
    if (this.state !== 'playing') return;
    for (const rope of this.ropes) {
      if (rope.cut) continue;
      for (let k = 0; k + 1 < rope.links.length; k++) {
        const a = rope.links[k].position;
        const b = rope.links[k + 1].position;
        if (segmentsCross(this.swipe, { a, b })) {
          this.cutRope(rope, k);
          return;
        }
      }
    }
  }

  cutRope(rope, k) {
    rope.cut = true;
    const c = rope.constraints[k];
    if (c) this.matter.world.remove(c);
    this.cutStart = this.cutStart ?? this.time.now;
    this.draw();
  }

  update() {
    if (this.state !== 'playing') return;
    const c = this.catch;
    for (const bauble of this.baubles) {
      const p = bauble.position;
      const inside = Math.abs(p.x - c.x) <= c.w / 2 && p.y > c.y && p.y <= c.y + c.h;
      const rest = Math.abs(bauble.velocity.y) < 0.3 && Math.abs(bauble.velocity.x) < 0.3;
      if (inside && rest) return this.finish(true);
      if (fellOff(bauble.position, WORLD.height)) return this.finish(false);
    }
    this.draw();
  }

  finish(won) {
    this.state = 'over';
    if (won) finishLevel(this.run, (this.time.now - (this.cutStart ?? this.levelStart)) / 1000);
    this.draw();
    setTimeout(() => this.next(won), 900);
  }

  async next(won) {
    this.cutStart = null;
    if (!won || !isDone(this.run)) return this.loadLevel(this.run.index);
    await showScores(this, { gameId: 'advent-6', score: totalScore(this.run), title: 'Nissen & Kuglen' });
    this.run = createRun(LEVELS.length);
    this.cutStart = null;
    this.loadLevel(0);
  }

  draw() {
    const g = this.g;
    g.clear();
    const s = this.level.stocking;
    g.fillStyle(COLORS.stocking, 1).fillRect(s.x - s.w / 2, s.y - s.h / 2, s.w, s.h);
    for (const rope of this.ropes) {
      g.lineStyle(3, COLORS.rope, 1);
      for (let k = 0; k + 1 < rope.links.length; k++) {
        if (rope.cut && k === 0) continue;
        const a = rope.links[k].position;
        const b = rope.links[k + 1].position;
        g.lineBetween(a.x, a.y, b.x, b.y);
      }
      g.fillStyle(COLORS.peg, 1).fillCircle(rope.peg.x, rope.peg.y, 5);
    }
    for (const b of this.baubles) g.fillStyle(COLORS.bauble, 1).fillCircle(b.position.x, b.position.y, BAUBLE_R);
    this.hud.setText(`Bane ${this.run.index + 1}/${LEVELS.length}`);
  }

  snapshot() {
    return {
      level: this.run.index,
      state: this.state,
      baubles: this.baubles.map((b) => ({ x: b.position.x, y: b.position.y })),
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
