// Shared Phaser score screen. Games need `dom: { createContainer: true }` in their config.
// Usage: showScores(this, { gameId, score, title, message }).then(() => restart())
import { fetchScores, submitScore, qualifies, rankFor, LIMIT, MAX_NAME } from './arcade_scores.js';
import { sharpen } from './text_resolution.js';

const FONT = 'ui-monospace, Menlo, monospace';

export function showScores(scene, opts) {
  return new Promise((resolve) => {
    const key = 'arcade-scores';
    if (!scene.scene.get(key)) scene.scene.add(key, ScoresScene);
    scene.scene.pause();
    scene.scene.launch(key, {
      ...opts,
      onClose: () => {
        scene.scene.resume();
        resolve();
      },
    });
  });
}

// DOM text is laid out at native resolution, so it stays sharp at any scale (like the name input).
// Returns an object with the setOrigin/setText surface the call sites use.
function domText(scene, x, y, str, style) {
  const el = document.createElement('div');
  el.className = `arcade-text${style.role ? ` arcade-${style.role}` : ''}`;
  el.textContent = str;
  el.style.fontFamily = style.fontFamily || FONT;
  el.style.fontSize = `${style.fontSize}px`;
  el.style.color = style.color || '#f8fafc';
  el.style.whiteSpace = 'pre';
  if (style.align === 'center') el.style.textAlign = 'center';
  if (style.wordWrap) {
    el.style.whiteSpace = 'normal';
    el.style.width = `${style.wordWrap.width}px`;
  }
  const obj = scene.add.dom(x, y, el).setOrigin(0.5);
  // Honour the call's origin like canvas text does: 0.5 centres, 0 anchors the left edge.
  return {
    obj,
    setOrigin: (ox = 0.5, oy = 0.5) => obj.setOrigin(ox, oy), // Phaser owns the DOM transform
    setText: (t) => {
      el.textContent = t;
      return obj;
    },
    destroy: () => obj.destroy(),
  };
}

class ScoresScene extends Phaser.Scene {
  // Score screen text is DOM so it is crisp at any scale, matching the name input.
  text(x, y, str, style) {
    return domText(this, x, y, str, style);
  }

  async create({ gameId, score, title = 'Søde Børn', message = '', onClose }) {
    this.done = onClose;
    window.__arcadeScores__ = this; // test hook
    const { width: W, height: H } = this.scale;
    this.u = Math.min(W, H) / 20; // layout unit
    // Lighter scrim so the game stays readable behind the scores, plus a panel for the list.
    this.add
      .rectangle(0, 0, W, H, 0x020617, 0.55)
      .setOrigin(0)
      .setInteractive()
      .on('pointerdown', () => this.state === 'list' && this.close());
    this.add.rectangle(W / 2, H * 0.52, W * 0.86, H * 0.76, 0x0b1020, 0.96).setStrokeStyle(2, 0xfbbf24, 0.6);
    this.text(W / 2, this.u * 1.5, title, {
      role: 'title',
      fontFamily: FONT,
      fontSize: this.u * 1.2,
      color: '#fde68a',
    }).setOrigin(0.5);
    this.msg = this.text(W / 2, this.u * 2.8, `${message ? message + '  ' : ''}Dine point: ${score}`, {
      fontFamily: FONT,
      fontSize: this.u * 0.6,
      color: '#e2e8f0',
      align: 'center',
      wordWrap: { width: W * 0.9 },
    }).setOrigin(0.5);

    const scores = await fetchScores(gameId);
    if (!this.sys.isActive()) return;
    this.input.keyboard.on('keydown', (e) => {
      if (this.state === 'list' && ['Enter', ' ', 'Escape'].includes(e.key)) this.close();
    });
    if (qualifies(scores, score)) this.askName(gameId, scores, score);
    else this.showList(scores);
  }

  rows(list, pendingAt = -1) {
    this.rowTexts?.forEach((t) => t.destroy());
    const { width: W } = this.scale;
    const u = this.u;
    this.rowTexts = list.slice(0, LIMIT).map((s, i) => {
      const y = u * 4.5 + i * u * 1.2;
      const label = `${String(i + 1).padStart(2, '0')}  ${i === pendingAt ? '' : s.name}`;
      const color = i === pendingAt ? '#fbbf24' : '#f8fafc';
      return this.text(W * 0.1, y, label.padEnd(24) + String(s.score).padStart(8), {
        role: 'score-row',
        fontFamily: FONT,
        fontSize: u * 0.7,
        color,
        fixedWidth: W * 0.8,
      }).setOrigin(0);
    });
    return (i) => u * 4.5 + i * u * 1.2;
  }

  askName(gameId, scores, score) {
    this.state = 'entry';
    const at = rankFor(scores, score);
    const list = [...scores.slice(0, at), { name: '', score }, ...scores.slice(at)];
    const yFor = this.rows(list, at);
    this.msg.setText('Ny rekord! Skriv dit navn til julemandens liste.');
    this.input.keyboard.disableGlobalCapture(); // let space/arrows reach the input
    const u = this.u;
    const input = this.add
      .dom(this.scale.width * 0.1 + u * 2.6, yFor(at) + u * 0.4, 'input', {
        width: `${this.scale.width * 0.4}px`,
        font: `${u * 0.7}px ${FONT}`,
        background: '#0f172a',
        color: '#fbbf24',
        border: '2px solid #fbbf24',
        padding: '2px 6px',
      })
      .setOrigin(0, 0.5);
    const el = input.node;
    // Phaser wraps the field in its own absolute DIV; that wrapper must sit above the canvas.
    el.parentElement.style.zIndex = '10';
    el.maxLength = MAX_NAME;
    el.className = 'arcade-input';
    el.value = window.__defaultPlayerName__ || '';
    el.focus();
    el.select();
    el.addEventListener('keydown', async (e) => {
      e.stopPropagation();
      if (e.key !== 'Enter' || !el.value.trim() || this.state !== 'entry') return;
      this.state = 'saving';
      const ok = await submitScore(gameId, el.value.trim(), score);
      input.destroy();
      this.input.keyboard.enableGlobalCapture();
      if (!ok) this.msg.setText('Kunne ikke gemme dine point.');
      this.showList(ok ? await fetchScores(gameId) : list.filter((_, i) => i !== at));
    });
  }

  showList(scores) {
    this.rows(scores);
    if (!scores.length)
      this.rowTexts.push(
        this.text(this.scale.width / 2, this.u * 5, 'Ingen resultater endnu.', {
          fontFamily: FONT,
          fontSize: this.u * 0.7,
        }).setOrigin(0.5),
      );
    this.text(this.scale.width / 2, this.scale.height - this.u * 1.5, '[ Luk ]', {
      fontFamily: FONT,
      fontSize: this.u * 0.8,
      color: '#fde68a',
    }).setOrigin(0.5);
    this.time.delayedCall(150, () => {
      this.state = 'list';
    }); // ignore the Enter that saved
  }

  close() {
    this.state = 'closed';
    window.__arcadeScores__ = null;
    this.scene.stop();
    this.done?.();
  }
}
