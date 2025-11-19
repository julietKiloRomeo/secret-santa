// Minimal Reindeer Rush client skeleton: distance-based endless runner placeholder
(function () {
  const defaultPlayerName = window.__defaultPlayerName__ || 'Guest';

  function el(id) { return document.getElementById(id); }

  let running = false;
  let distance = 0; // meters
  let speed = 100; // ms per tick
  let tickId = null;

  function formatDistance(d) { return `${d} m`; }

  function updateUI() {
    const scoreEl = el('reindeer-score');
    if (scoreEl) scoreEl.textContent = formatDistance(distance);
  }

  function startGame() {
    if (running) return;
    running = true;
    distance = 0;
    updateUI();
    const startBtn = el('reindeer-start');
    if (startBtn) startBtn.disabled = true;
    const stopBtn = el('reindeer-stop');
    if (stopBtn) stopBtn.disabled = false;
    tickId = setInterval(() => {
      distance += 1;
      updateUI();
    }, 200);
  }

  function stopGame() {
    if (!running) return;
    running = false;
    if (tickId) { clearInterval(tickId); tickId = null; }
    const startBtn = el('reindeer-start');
    if (startBtn) startBtn.disabled = false;
    const stopBtn = el('reindeer-stop');
    if (stopBtn) stopBtn.disabled = true;
    showSubmitOverlay();
  }

  function fetchLeaderboard() {
    return fetch('/api/scores/reindeer-rush').then(r => r.json()).catch(() => ({ scores: [] }));
  }

  function renderLeaderboard(scores) {
    const container = el('reindeer-leaderboard');
    if (!container) return;
    container.innerHTML = '';
    const ol = document.createElement('ol');
    ol.style.padding = '0';
    ol.style.margin = '0';
    (scores || []).forEach((s) => {
      const li = document.createElement('li');
      li.textContent = `${s.name} — ${s.score}`;
      li.style.padding = '4px 0';
      ol.appendChild(li);
    });
    container.appendChild(ol);
  }

  async function refreshLeaderboard() {
    try {
      const data = await fetchLeaderboard();
      renderLeaderboard(data.scores || []);
    } catch (e) {
      console.error('Failed to load leaderboard', e);
    }
  }

  async function submitScore(name, score) {
    try {
      const resp = await fetch('/api/scores/reindeer-rush', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, score })
      });
      return resp.ok;
    } catch (e) {
      console.error('Failed to submit score', e);
      return false;
    }
  }

  function showSubmitOverlay() {
    const overlay = document.createElement('div');
    overlay.style.position = 'fixed';
    overlay.style.inset = '0';
    overlay.style.display = 'flex';
    overlay.style.alignItems = 'center';
    overlay.style.justifyContent = 'center';
    overlay.style.background = 'rgba(0,0,0,0.75)';
    overlay.style.zIndex = '1000';

    const panel = document.createElement('div');
    panel.style.background = '#fff';
    panel.style.padding = '1rem';
    panel.style.borderRadius = '8px';
    panel.style.minWidth = '260px';
    panel.style.textAlign = 'center';

    const title = document.createElement('h3');
    title.textContent = 'Game Over — Submit Score';
    panel.appendChild(title);

    const scoreText = document.createElement('p');
    scoreText.textContent = `Distance: ${distance} m`;
    panel.appendChild(scoreText);

    const input = document.createElement('input');
    input.type = 'text';
    input.value = defaultPlayerName || '';
    input.style.width = '100%';
    input.style.padding = '8px';
    input.style.margin = '8px 0';
    panel.appendChild(input);

    const btn = document.createElement('button');
    btn.textContent = 'Save Score';
    btn.style.padding = '8px 12px';
    btn.addEventListener('click', async () => {
      btn.disabled = true;
      const name = (input.value || defaultPlayerName || 'Guest').trim();
      await submitScore(name, distance);
      document.body.removeChild(overlay);
      refreshLeaderboard();
    });
    panel.appendChild(btn);

    const cancel = document.createElement('button');
    cancel.textContent = 'Cancel';
    cancel.style.marginLeft = '8px';
    cancel.addEventListener('click', () => {
      document.body.removeChild(overlay);
    });
    panel.appendChild(cancel);

    overlay.appendChild(panel);
    document.body.appendChild(overlay);
  }

  document.addEventListener('DOMContentLoaded', () => {
    const start = el('reindeer-start');
    const stop = el('reindeer-stop');
    const jump = el('reindeer-jump');
    if (start) start.addEventListener('click', startGame);
    if (stop) stop.addEventListener('click', stopGame);
    if (jump) jump.addEventListener('click', () => { /* placeholder for jump */ });

    refreshLeaderboard();
    updateUI();
  });

  // Expose some helpers for debugging
  window.__reindeerRush__ = {
    startGame, stopGame, refreshLeaderboard
  };
})();

