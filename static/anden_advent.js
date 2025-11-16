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

  // WebAudio jingle for flaps
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  const audioCtx = AudioCtx ? new AudioCtx() : null;
  function jingle() {
    if (!audioCtx) return;
    try {
      const o = audioCtx.createOscillator();
      const g = audioCtx.createGain();
      o.type = 'triangle';
      o.connect(g);
      g.connect(audioCtx.destination);
      const t = audioCtx.currentTime;
      o.frequency.setValueAtTime(880, t);
      o.frequency.linearRampToValueAtTime(1100, t + 0.08);
      o.frequency.linearRampToValueAtTime(1320, t + 0.16);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.05, t + 0.005);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
      o.start(t);
      o.stop(t + 0.2);
    } catch (e) {
      // ignore audio errors
      console.warn('Audio jingle failed', e);
    }
  }

  let bird = { x: 80, y: HEIGHT / 2, vy: 0, w: 48, h: 32 };
  // Make Santa fall a little bit slower for gentler gameplay
  const GRAVITY = 0.45;
  const FLAP = -9;

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
  }

  function gameOver() {
    running = false;
    setStatus('Game Over! Try igen 🎅');
  }

  function tick() {
    if (!running) return;
    frame += 1;
    // Physics
    bird.vy += GRAVITY;
    bird.y += bird.vy;

    // Spawn chimneys
    if (frame % SPAWN_INTERVAL === 0) spawnChimney();

    // Move chimneys
    for (let i = chimneys.length - 1; i >= 0; i--) {
      chimneys[i].x -= 2.5;
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
    if (santaImg.complete) ctx.drawImage(santaImg, sx, sy, bird.w, bird.h);
    else {
      ctx.fillStyle = '#fff';
      ctx.fillRect(sx, sy, bird.w, bird.h);
    }
  }

  function flap() {
    bird.vy = FLAP;
    try {
      if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
    } catch (e) {}
    jingle();
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
