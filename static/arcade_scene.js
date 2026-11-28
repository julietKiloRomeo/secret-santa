// Shared score screen. HTML owns the panel and its layout; Phaser owns the pause/resume lifecycle.
import { fetchScores, submitScore, qualifies, LIMIT, MAX_NAME } from './arcade_scores.js';

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

class ScoresScene extends Phaser.Scene {
  async create({ gameId, score, title = 'Søde Børn', message = '', onClose }) {
    this.state = 'loading';
    window.__arcadeScores__ = this; // test hook
    const panel = document.createElement('dialog');
    panel.className = 'arcade-panel arcade-leaderboard';
    panel.setAttribute('aria-labelledby', 'arcade-score-title');
    panel.innerHTML = `
      <header>
        <p class="arcade-kicker">Rangliste</p>
        <h2 id="arcade-score-title" class="arcade-title" tabindex="-1" autofocus></h2>
        <p class="arcade-score-summary">Dine point <strong></strong></p>
      </header>
      <div class="arcade-ranking" role="region" aria-label="Placeringer" tabindex="0"><ol role="list"></ol></div>
      <p id="arcade-score-message" class="arcade-score-message" role="status">Henter resultater …</p>
      <form class="arcade-score-form" hidden>
        <div class="arcade-form-heading">
          <label for="arcade-score-name">Dit navn på julemandens liste</label>
          <button class="arcade-skip" type="button">Spring over</button>
        </div>
        <div class="arcade-entry">
          <input id="arcade-score-name" class="arcade-input" name="name" autocomplete="nickname" required>
          <button class="arcade-action" type="submit">Gem point</button>
        </div>
      </form>
      <button class="arcade-action" type="button" data-score-close>Luk</button>`;
    const heading = panel.querySelector('h2');
    heading.textContent = title;
    const summary = panel.querySelector('.arcade-score-summary');
    summary.querySelector('strong').textContent = score;
    if (message) summary.prepend(`${message} · `);
    const ranking = panel.querySelector('.arcade-ranking');
    const list = ranking.querySelector('ol');
    const status = panel.querySelector('[role="status"]');
    const form = panel.querySelector('form');
    const input = form.elements.namedItem('name');
    const save = form.querySelector('[type="submit"]');
    const skip = form.querySelector('.arcade-skip');
    const close = panel.querySelector('[data-score-close]');
    input.maxLength = MAX_NAME;

    const renderRows = (scores) => {
      ranking.hidden = !scores.length;
      list.replaceChildren(
        ...scores.slice(0, LIMIT).map(({ name, score }, i) => {
          const row = document.createElement('li');
          row.className = 'arcade-score-row';
          for (const [role, value] of [
            ['rank', String(i + 1).padStart(2, '0')],
            ['player', name],
            ['points', score],
          ]) {
            const cell = document.createElement('span');
            cell.className = `arcade-${role}`;
            cell.textContent = value;
            row.append(cell);
          }
          return row;
        }),
      );
    };

    const showList = (scores, notice = '') => {
      this.state = 'list';
      renderRows(scores);
      status.textContent = notice || (scores.length ? '' : 'Ingen resultater endnu.');
      form.hidden = true;
      close.hidden = false;
      close.focus();
    };

    const finish = () => {
      if (!['loading', 'list', 'entry'].includes(this.state)) return;
      this.state = 'closed';
      panel.close();
      this.scene.stop();
      onClose();
    };
    close.addEventListener('click', finish);
    skip.addEventListener('click', finish);
    panel.addEventListener('cancel', (e) => {
      e.preventDefault();
      finish();
    });
    panel.addEventListener('click', (e) => {
      if (e.target !== panel || this.state !== 'list') return;
      const { left, right, top, bottom } = panel.getBoundingClientRect();
      if (e.clientX < left || e.clientX > right || e.clientY < top || e.clientY > bottom) finish();
    });
    // Keep Phaser's global capture from consuming Space/arrows in the native controls.
    this.input.keyboard.disableGlobalCapture();
    panel.addEventListener('keydown', (e) => e.stopPropagation());
    this.events.once('shutdown', () => {
      panel.remove();
      window.__arcadeScores__ = null;
      this.input.keyboard.enableGlobalCapture();
    });
    ranking.hidden = true;
    document.body.append(panel);
    panel.showModal();

    const scores = await fetchScores(gameId);
    if (!panel.isConnected) return;
    if (!scores) return showList([], 'Kunne ikke hente ranglisten.');
    if (!qualifies(scores, score)) return showList(scores);

    this.state = 'entry';
    renderRows(scores);
    status.textContent = 'Ny rekord!';
    close.hidden = true;
    form.hidden = false;
    input.value = window.__defaultPlayerName__ || '';
    input.focus();
    input.select();
    input.addEventListener('input', () => {
      if (!input.hasAttribute('aria-invalid')) return;
      input.removeAttribute('aria-invalid');
      input.removeAttribute('aria-describedby');
      status.textContent = 'Ny rekord!';
    });
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (this.state !== 'entry') return;
      const name = input.value.trim();
      if (!name) {
        status.textContent = 'Skriv et navn for at gemme dine point.';
        input.setAttribute('aria-invalid', 'true');
        input.setAttribute('aria-describedby', status.id);
        input.focus();
        return;
      }
      this.state = 'saving';
      save.disabled = true;
      skip.disabled = true;
      status.textContent = 'Gemmer dine point …';
      const ok = await submitScore(gameId, name, score).catch(() => false);
      if (!panel.isConnected) return;
      if (!ok) {
        this.state = 'entry';
        status.textContent = 'Kunne ikke gemme dine point. Prøv igen.';
        save.disabled = false;
        skip.disabled = false;
        input.focus();
        return;
      }
      const updated = await fetchScores(gameId);
      if (!panel.isConnected) return;
      if (updated) showList(updated);
      else showList(scores, 'Dine point er gemt, men ranglisten kunne ikke opdateres.');
    });
  }
}
