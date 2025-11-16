// Simple Flappy-Santa implementation: press space or click to flap
(function () {
  const canvas = document.getElementById('santa-canvas');
  const ctx = canvas.getContext('2d');
  const scoreEl = document.getElementById('santa-score');
  const statusEl = document.getElementById('santa-status');

  const WIDTH = canvas.width;
  const HEIGHT = canvas.height;

  // Santa sprite (use existing santa.gif as a simple image)
  const santaImg = new Image();
  santaImg.src = '/static/santa.gif';

  // WebAudio bell-like jingle for flaps (sleigh bells)
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  const audioCtx = AudioCtx ? new AudioCtx() : null;
  function jingle() {
    if (!audioCtx) return;
    try {
      const t = audioCtx.currentTime;
      const o1 = audioCtx.createOscillator();
      const o2 = audioCtx.createOscillator();
      const g = audioCtx.createGain();
      o1.type = 'sine';
      o2.type = 'sine';
      o1.frequency.setValueAtTime(880, t);
      o2.frequency.setValueAtTime(1320, t);
      o1.connect(g);
      o2.connect(g);
      g.connect(audioCtx.destination);
      g.gain.setValueAtTime(0.001, t);
      g.gain.exponentialRampToValueAtTime(0.06, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
      // slight downward pitch sweep for belliness
      o1.frequency.exponentialRampToValueAtTime(660, t + 0.9);
      o2.frequency.exponentialRampToValueAtTime(990, t + 0.9);
      o1.start(t);
      o2.start(t);
      o1.stop(t + 0.9);
      o2.stop(t + 0.9);
    } catch (e) {
      console.warn('Audio jingle failed', e);
    }
  }

  let bird = { x: 80, y: HEIGHT / 2, vy: 0, w: 48, h: 32 };
  // Make Santa fall a little bit slower for gentler gameplay
  const GRAVITY = 0.45;
  // Reduce jump height so the game is playable
  const FLAP = -6;

  // Speed scaling: increases slowly as the player scores
  const BASE_SPEED = 2.0;
  const SPEED_PER_SCORE = 0.1;

  const chimneys = [];
  const GAP = 110;
  const SPAWN_INTERVAL = 90; // frames
  let frame = 0;
  let score = 0;
  let running = true;

  function setStatus(text) { statusEl.textContent = text || ''; }

  function spawnChimney() {
    const topHeight = 30 + Math.random() * (HEIGHT - GAP - 60);
    chimneys.push({ x: WIDTH + 10, top: topHeight, passed: false });
  }

  function reset() {
    bird = { x: 80, y: HEIGHT / 2, vy: 0, w: 48, h: 32 };
    chimneys.length = 0;
    frame = 0;
    score = 0;
    running = true;
    setStatus('');
    try { hideOverlay(); } catch (e) {}
  }

  async function gameOver() {
    running = false;
    setStatus('Game Over! Try igen 🎅');
    // High-score flow similar to the snake game
    try {
      const data = await fetchScores();
      const scores = data.scores || [];
      const qualifies = scores.length < 10 || score > (scores[scores.length - 1]?.score || -1);
      if (qualifies && score > 0) {
        const panel = arcadePanel();
        panel.appendChild(arcadeTitle('Ny high score. Hvilket navn skal vi skrive på julemandens liste?'));
        const input = arcadeInput(defaultPlayerName);
        panel.appendChild(input);
        const save = arcadeButton('Gem');
        save.addEventListener('click', async () => {
          const name = (input.value || defaultPlayerName).trim();
          await submitScore('anden-advent', name, score);
          hideOverlay();
          await showHighScoresOverlay();
        });
        panel.appendChild(save);
        showOverlay(panel);
      } else {
        await showHighScoresOverlay();
      }
    } catch (e) {
      console.error('High score flow failed', e);
    }
  }

  function tick() {
    if (!running) return;
    frame += 1;
    // Physics
    bird.vy += GRAVITY;
    bird.y += bird.vy;

    // Spawn chimneys
    if (frame % SPAWN_INTERVAL === 0) spawnChimney();

    // Move chimneys (speed scales with score)
    const moveSpeed = BASE_SPEED + score * SPEED_PER_SCORE + Math.floor(frame / 600) * 0.02;
    for (let i = chimneys.length - 1; i >= 0; i--) {
      chimneys[i].x -= moveSpeed;
      // Score when passing
      if (!chimneys[i].passed && chimneys[i].x + 40 < bird.x) {
        chimneys[i].passed = true;
        score += 1;
        scoreEl.textContent = `Score: ${score}`;
      }
      if (chimneys[i].x < -80) chimneys.splice(i, 1);
    }

    // Collisions
    if (bird.y + bird.h / 2 >= HEIGHT || bird.y - bird.h / 2 <= 0) {
      return gameOver();
    }
    for (const c of chimneys) {
      const cx = c.x;
      const topH = c.top;
      const bottomY = topH + GAP;
      // chimney rectangles: top (0, topH), bottom (bottomY, HEIGHT)
      if (bird.x + bird.w / 2 > cx && bird.x - bird.w / 2 < cx + 40) {
        if (bird.y - bird.h / 2 < topH || bird.y + bird.h / 2 > bottomY) {
          return gameOver();
        }
      }
    }

    draw();
  }

  function draw() {
    // background
    ctx.fillStyle = '#88c';
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    // chimneys
    for (const c of chimneys) {
      ctx.fillStyle = '#8b3';
      // top
      ctx.fillRect(c.x, 0, 40, c.top);
      // bottom
      ctx.fillRect(c.x, c.top + GAP, 40, HEIGHT - (c.top + GAP));
      // cap
      ctx.fillStyle = '#a33';
      ctx.fillRect(c.x - 4, c.top - 8, 48, 8);
      ctx.fillRect(c.x - 4, c.top + GAP, 48, 8);
    }

    // santa (bird)
    const sx = bird.x - bird.w / 2;
    const sy = bird.y - bird.h / 2;
    // draw sleigh + reindeer behind/around santa
    drawSleighAndReindeer(sx, sy);
    if (santaImg.complete) ctx.drawImage(santaImg, sx, sy, bird.w, bird.h);
    else {
      ctx.fillStyle = '#fff';
      ctx.fillRect(sx, sy, bird.w, bird.h);
    }
  }

  function drawSleighAndReindeer(sx, sy) {
    // Sleigh behind Santa
    ctx.save();
    // sleigh body
    ctx.fillStyle = '#8b0000';
    ctx.fillRect(sx - 28, sy + 8, bird.w + 36, 14);
    // sleigh runner
    ctx.strokeStyle = '#222';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(sx - 26, sy + 22);
    ctx.lineTo(sx + bird.w + 8, sy + 22);
    ctx.stroke();
    ctx.restore();

    // Reindeers ahead of Santa (simple stylized shapes)
    const r1x = sx + bird.w + 10;
    const r2x = sx + bird.w + 34;
    const ry = sy + 4;
    ctx.fillStyle = '#7a4d20';
    // bodies
    ctx.fillRect(r1x, ry, 12, 8);
    ctx.fillRect(r2x, ry - 2, 12, 8);
    // heads
    ctx.beginPath(); ctx.arc(r1x + 3, ry + 2, 3, 0, 2 * Math.PI); ctx.fill();
    ctx.beginPath(); ctx.arc(r2x + 3, ry + 1, 3, 0, 2 * Math.PI); ctx.fill();
    // antlers
    ctx.strokeStyle = '#5b3a12'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(r1x + 1, ry); ctx.lineTo(r1x - 4, ry - 6); ctx.moveTo(r1x + 2, ry); ctx.lineTo(r1x - 1, ry - 6); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(r2x + 1, ry - 1); ctx.lineTo(r2x - 4, ry - 7); ctx.moveTo(r2x + 2, ry - 1); ctx.lineTo(r2x - 1, ry - 7); ctx.stroke();
  }

  function flap() {
    bird.vy = FLAP;
    try {
      if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
    } catch (e) {}
    jingle();
  }

  // High score / overlay UI (mirrors forste_advent behavior)
  const defaultPlayerName = window.__defaultPlayerName__ || 'Guest';

  let overlayEl = null;
  function ensureOverlay() {
    if (overlayEl) return overlayEl;
    overlayEl = document.createElement('div');
    overlayEl.id = 'overlay';
    overlayEl.style.position = 'fixed';
    overlayEl.style.inset = '0';
    overlayEl.style.background = 'rgba(0,0,0,0.9)';
    overlayEl.style.display = 'none';
    overlayEl.style.alignItems = 'center';
    overlayEl.style.justifyContent = 'center';
    overlayEl.style.zIndex = '1000';
    document.body.appendChild(overlayEl);
    return overlayEl;
  }
  function showOverlay(inner) {
    const el = ensureOverlay();
    el.innerHTML = '';
    el.appendChild(inner);
    el.style.display = 'flex';
  }
  function hideOverlay() {
    if (overlayEl) overlayEl.style.display = 'none';
  }
  function arcadePanel() {
    const panel = document.createElement('div');
    panel.style.background = '#000';
    panel.style.color = '#0f0';
    panel.style.border = '4px solid #0f0';
    panel.style.boxShadow = '0 0 20px #0f0';
    panel.style.padding = '1rem 2rem';
    panel.style.fontFamily = 'monospace';
    panel.style.textShadow = '0 0 6px #0f0';
    panel.style.maxWidth = '480px';
    panel.style.width = '90%';
    panel.style.borderRadius = '8px';
    return panel;
  }
  function arcadeTitle(text) {
    const h = document.createElement('h2');
    h.textContent = text;
    h.style.margin = '0 0 1rem 0';
    h.style.textAlign = 'center';
    return h;
  }
  function arcadeButton(text) {
    const b = document.createElement('button');
    b.textContent = text;
    b.style.background = '#0f0';
    b.style.color = '#000';
    b.style.border = '2px solid #0f0';
    b.style.padding = '0.5rem 1rem';
    b.style.fontFamily = 'monospace';
    b.style.cursor = 'pointer';
    b.style.marginTop = '1rem';
    return b;
  }
  function arcadeInput(value) {
    const i = document.createElement('input');
    i.value = value || '';
    i.style.width = '100%';
    i.style.padding = '0.5rem';
    i.style.background = '#001100';
    i.style.border = '2px solid #0f0';
    i.style.color = '#0f0';
    i.style.fontFamily = 'monospace';
    return i;
  }
  function renderScoresList(scores) {
    const ul = document.createElement('ol');
    ul.style.listStyle = 'none';
    ul.style.padding = '0';
    ul.style.margin = '0';
    scores.forEach((s, idx) => {
      const li = document.createElement('li');
      li.textContent = `${String(idx + 1).padStart(2, '0')} — ${s.name} — ${s.score}`;
      li.style.padding = '0.25rem 0';
      ul.appendChild(li);
    });
    return ul;
  }
  async function fetchScores() {
    const resp = await fetch('/api/scores/anden-advent');
    return resp.json();
  }
  async function showHighScoresOverlay() {
    const data = await fetchScores();
    const panel = arcadePanel();
    panel.appendChild(arcadeTitle('Søde Børn'));
    panel.appendChild(renderScoresList(data.scores || []));
    const close = arcadeButton('Luk');
    close.addEventListener('click', hideOverlay);
    panel.appendChild(close);
    showOverlay(panel);
  }
  async function submitScore(game, name, score) {
    try {
      const resp = await fetch(`/api/scores/${game}`, {
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

  document.addEventListener('keydown', (e) => {
    if (e.code === 'Space') {
      if (!running) reset();
      flap();
    }
  });
  canvas.addEventListener('mousedown', (e) => {
    if (!running) reset();
    flap();
  });

  setInterval(tick, 1000 / 60);
  // initial draw
  draw();
})();
