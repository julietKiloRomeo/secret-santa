// Reindeer Rush - simple canvas runner implementation (minimal playable client)
(function () {
  const defaultPlayerName = window.__defaultPlayerName__ || 'Guest';

  function el(id) { return document.getElementById(id); }

  // Leaderboard helpers (kept simple)
  async function fetchLeaderboard() {
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

  // Game state
  let canvas, ctx, dpr = window.devicePixelRatio || 1;
  let width = 600, height = 260;
  let running = false;
  let lastTs = 0;
  let distance = 0; // meters (display only)

  const groundOffset = 40; // px from bottom

  const player = {
    x: 80,
    y: 0,
    w: 48,
    h: 36,
    vy: 0,
    grounded: true
  };

  const gravity = 0.0018; // px / ms^2
  const jumpVel = -0.55; // px / ms

  let obstacles = [];
  let spawnTimer = 0;
  let spawnInterval = 1400; // ms

  function initCanvas() {
    const holder = el('reindeer-canvas');
    if (!holder) return;
    // Create canvas if not already
    canvas = holder.querySelector('canvas');
    if (!canvas) {
      canvas = document.createElement('canvas');
      canvas.style.width = '100%';
      canvas.style.height = '100%';
      holder.innerHTML = '';
      holder.appendChild(canvas);
    }
    ctx = canvas.getContext('2d');
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
  }

  function resizeCanvas() {
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    width = Math.max(300, Math.floor(rect.width));
    height = Math.max(120, Math.floor(rect.height));
    dpr = window.devicePixelRatio || 1;
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function resetGame() {
    distance = 0;
    player.y = height - groundOffset - player.h;
    player.vy = 0;
    player.grounded = true;
    obstacles = [];
    spawnTimer = 0;
    lastTs = 0;
  }

  function startGame() {
    if (running) return;
    initCanvas();
    resetGame();
    running = true;
    document.getElementById('reindeer-start').disabled = true;
    document.getElementById('reindeer-stop').disabled = false;
    requestAnimationFrame(loop);
  }

  function stopGame() {
    if (!running) return;
    running = false;
    document.getElementById('reindeer-start').disabled = false;
    document.getElementById('reindeer-stop').disabled = true;
    showSubmitOverlay();
  }

  function spawnObstacle() {
    const h = 20 + Math.floor(Math.random() * 60);
    const w = 22 + Math.floor(Math.random() * 40);
    obstacles.push({ x: width + 10, y: height - groundOffset - h, w, h });
  }

  function loop(ts) {
    if (!running) return;
    if (!lastTs) lastTs = ts;
    const dt = ts - lastTs;
    lastTs = ts;

    // Distance increases with time
    distance += Math.floor(dt * 0.02);
    // Speed grows slightly with distance
    const baseSpeed = 180 + Math.min(600, distance * 0.2); // px/sec
    const speedPxPerMs = baseSpeed / 1000;

    // Player physics
    if (!player.grounded) {
      player.vy += gravity * dt;
      player.y += player.vy * dt;
      const groundY = height - groundOffset - player.h;
      if (player.y >= groundY) {
        player.y = groundY;
        player.vy = 0;
        player.grounded = true;
      }
    }

    // Obstacles
    spawnTimer += dt;
    if (spawnTimer >= spawnInterval) {
      spawnTimer = 0;
      spawnObstacle();
      // Slightly speed up spawn over time
      spawnInterval = Math.max(700, spawnInterval - 8);
    }

    for (let i = obstacles.length - 1; i >= 0; i--) {
      const o = obstacles[i];
      o.x -= speedPxPerMs * dt;
      if (o.x + o.w < -10) obstacles.splice(i, 1);
    }

    // Collision detection (AABB)
    for (const o of obstacles) {
      if (rectsOverlap(player.x, player.y, player.w, player.h, o.x, o.y, o.w, o.h)) {
        stopGame();
        break;
      }
    }

    drawScene();
    updateUI();
    requestAnimationFrame(loop);
  }

  function rectsOverlap(x1, y1, w1, h1, x2, y2, w2, h2) {
    return !(x1 + w1 < x2 || x1 > x2 + w2 || y1 + h1 < y2 || y1 > y2 + h2);
  }

  function drawScene() {
    if (!ctx) return;
    // Clear
    ctx.clearRect(0, 0, width, height);
    // Sky
    ctx.fillStyle = '#e6f2ff';
    ctx.fillRect(0, 0, width, height - groundOffset);
    // Ground
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, height - groundOffset, width, groundOffset);
    ctx.strokeStyle = '#e0e7ff';
    ctx.beginPath();
    ctx.moveTo(0, height - groundOffset + 0.5);
    ctx.lineTo(width, height - groundOffset + 0.5);
    ctx.stroke();

    // Player
    ctx.fillStyle = '#8b5cf6';
    ctx.fillRect(Math.round(player.x), Math.round(player.y), player.w, player.h);

    // Obstacles
    ctx.fillStyle = '#ef4444';
    for (const o of obstacles) {
      ctx.fillRect(Math.round(o.x), Math.round(o.y), o.w, o.h);
    }

    // HUD
    ctx.fillStyle = '#111827';
    ctx.font = '14px system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial';
    ctx.fillText(`${distance} m`, 10, 20);
  }

  function updateUI() {
    const scoreEl = el('reindeer-score');
    if (scoreEl) scoreEl.textContent = `${distance} m`;
  }

  function doJump() {
    if (!player.grounded) return;
    player.vy = jumpVel;
    player.grounded = false;
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
    panel.className = 'bg-white p-4 rounded-md shadow-lg text-gray-900';
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
    input.className = 'block w-full rounded-md border border-gray-300 bg-white text-gray-900 placeholder-gray-400 px-3 py-2 shadow-sm';
    input.style.margin = '8px 0';
    panel.appendChild(input);

    const btn = document.createElement('button');
    btn.textContent = 'Save Score';
    btn.className = 'inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600';
    btn.style.marginTop = '0.5rem';
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
    cancel.className = 'inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-gray-900 bg-gray-200';
    cancel.style.marginLeft = '8px';
    cancel.addEventListener('click', () => {
      document.body.removeChild(overlay);
    });
    panel.appendChild(cancel);

    overlay.appendChild(panel);
    document.body.appendChild(overlay);
  }

  document.addEventListener('DOMContentLoaded', () => {
    initCanvas();
    const start = el('reindeer-start');
    const stop = el('reindeer-stop');
    const jump = el('reindeer-jump');
    if (start) start.addEventListener('click', startGame);
    if (stop) stop.addEventListener('click', stopGame);
    if (jump) jump.addEventListener('click', doJump);

    // Spacebar to jump
    window.addEventListener('keydown', (ev) => {
      if (ev.code === 'Space') {
        ev.preventDefault();
        doJump();
      }
    });

    // Touch to jump
    const holder = el('reindeer-canvas');
    if (holder) {
      holder.addEventListener('touchstart', (e) => { e.preventDefault(); doJump(); }, { passive: false });
      holder.addEventListener('mousedown', () => doJump());
    }

    refreshLeaderboard();
    updateUI();
  });

  // Expose for debugging
  window.__reindeerRush__ = {
    startGame, stopGame, refreshLeaderboard
  };
})();
