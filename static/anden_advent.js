// Simple Flappy-Santa implementation: press space or click to flap
(function () {
  const canvas = document.getElementById('santa-canvas');
  const ctx = canvas.getContext('2d');
  const scoreEl = document.getElementById('santa-score');
  const statusEl = document.getElementById('santa-status');

  // Logical drawing width/height in CSS pixels (canvas is square)
  let WIDTH = canvas.clientWidth || 400;
  let HEIGHT = WIDTH;

  // Santa sprite (use existing santa.gif as a simple image)
  const santaImg = new Image();
  santaImg.src = '/static/santa.gif';

  // Sprite assets (PNG) placed in static/sprites/
  const SPRITE_DIR = '/static/sprites';
  const SPRITE_PATHS = {
    reindeer1: `${SPRITE_DIR}/reindeer1.png`,
    reindeer2: `${SPRITE_DIR}/reindeer2.png`,
    reindeer3: `${SPRITE_DIR}/reindeer3.png`,
    santaSleigh: `${SPRITE_DIR}/santa_sleigh.png`,
  };
  const sprites = {};
  function loadSprite(name, path) {
    const img = new Image();
    img.src = path;
    img.onload = () => { sprites[name] = img; };
    img.onerror = () => { sprites[name] = null; };
    sprites[name] = img; // store object immediately so callers can check .complete
    return img;
  }
  // Start loading (non-blocking)
  loadSprite('reindeer1', SPRITE_PATHS.reindeer1);
  loadSprite('reindeer2', SPRITE_PATHS.reindeer2);
  loadSprite('reindeer3', SPRITE_PATHS.reindeer3);
  loadSprite('santaSleigh', SPRITE_PATHS.santaSleigh);

  // Background parallax: clouds and silhouettes
  const cloudsFar = [];
  const cloudsNear = [];
  const silhouettes = [];
  const CLOUD_COUNTS = { far: 4, near: 3 };

  function mkCloud(x, y, w, h, opacity) {
    return { x, y, w, h, opacity };
  }

  function mkSilhouette(x, w, h, type) {
    return { x, w, h, type };
  }

  function initBackground() {
    cloudsFar.length = 0;
    cloudsNear.length = 0;
    silhouettes.length = 0;
    for (let i = 0; i < CLOUD_COUNTS.far; i++) {
      cloudsFar.push(mkCloud(Math.random() * WIDTH, Math.random() * (HEIGHT * 0.35), 90 + Math.random() * 140, 30 + Math.random() * 20, 0.35 + Math.random() * 0.25));
    }
    for (let i = 0; i < CLOUD_COUNTS.near; i++) {
      cloudsNear.push(mkCloud(Math.random() * WIDTH, Math.random() * (HEIGHT * 0.45), 120 + Math.random() * 180, 40 + Math.random() * 30, 0.55 + Math.random() * 0.3));
    }
    // silhouettes (trees/houses) at various x positions
    const baseY = HEIGHT - 28;
    let cursor = -40;
    while (cursor < WIDTH * 2) {
      const w = 40 + Math.floor(Math.random() * 80);
      const h = 20 + Math.floor(Math.random() * 60);
      const type = Math.random() > 0.6 ? 'house' : 'tree';
      silhouettes.push(mkSilhouette(cursor, w, h, type));
      cursor += w + 20 + Math.floor(Math.random() * 60);
    }
  }

  initBackground();

  // Responsive canvas sizing and layout
  function resizeCanvasAndLayout() {
    try { canvas.style.width = '100%'; } catch (e) {}
    const displayWidth = Math.max(120, Math.floor(canvas.parentElement ? canvas.parentElement.clientWidth : window.innerWidth * 0.9));
    const DPR = window.devicePixelRatio || 1;
    canvas.width = Math.round(displayWidth * DPR);
    canvas.height = Math.round(displayWidth * DPR);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    WIDTH = displayWidth;
    HEIGHT = displayWidth; // square canvas

    // scale factor relative to legacy 400px canvas so game feel stays familiar
    const scale = WIDTH / 400;

    // load optional tuning from config file `static/anden_config.js`
    const cfg = (window && window.__ANDEN_CONFIG__) ? window.__ANDEN_CONFIG__ : {};

    // geometry (ratios allow easy tuning in the config)
    PLAYER_X = Math.round(WIDTH * (cfg.playerXRatio || 0.18));
    LEAD_OFFSET_X = Math.round(WIDTH * (cfg.leadOffsetXRatio || 0.145));
    SECOND_OFFSET_X = Math.round(WIDTH * (cfg.secondOffsetXRatio || 0.085));
    THIRD_OFFSET_X = Math.max(8, SECOND_OFFSET_X + Math.round(WIDTH * (cfg.thirdOffsetXRatioAdjust || -0.03)));

    // sizes
    bird.w = Math.max(28, Math.round(WIDTH * 0.12));
    bird.h = Math.max(20, Math.round(bird.w * 0.66));
    TRAIL_LENGTH = Math.max(cfg.trailLengthMin || 80, Math.round(2.5 * 60 * scale));

    // physics scaled (tuned values) - config holds base numbers which we scale
    GRAVITY_PER_S = (cfg.gravityPerSecond || 800) * scale;
    FLAP_VY = (cfg.flapVY || -240) * scale;
    BASE_SPEED_PX_S = (cfg.baseSpeedPxPerS || 120) * scale;
    SPEED_PER_SCORE_PX_S = (cfg.speedPerScorePxPerS || 6) * scale;
    GAP = Math.max(cfg.gapMin || 48, Math.round(WIDTH * (cfg.gapRatio || 0.275)));
    SPAWN_INTERVAL_MS = (typeof cfg.spawnIntervalMsBase !== 'undefined') ? cfg.spawnIntervalMsBase : SPAWN_INTERVAL_MS_BASE;

    // initialize trail buffer
    trail.length = 0;
    for (let i = 0; i < TRAIL_LENGTH; i++) trail.push({ x: PLAYER_X, y: bird.y });
  }

  // Audio: try to find a user-supplied audio file in /static
  const AUDIO_CANDIDATES = [
    'sleigh_bell.mp3', 'sleigh-bell.mp3', 'sleigh.mp3', 'jingle.mp3', 'bell.mp3', 'jingle.wav', 'bell.wav'
  ];
  let audioEl = null;
  async function findAndLoadAudio() {
    for (const name of AUDIO_CANDIDATES) {
      try {
        const res = await fetch('/static/' + name, { method: 'HEAD' });
        if (res.ok) {
          audioEl = new Audio('/static/' + name);
          audioEl.preload = 'auto';
          return audioEl;
        }
      } catch (e) {
        // ignore and try next
      }
    }
    return null;
  }

  // Try to locate an audio file in the background (non-blocking)
  findAndLoadAudio().catch(() => {});

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

  // Layout anchors (will be computed on resize)
  let PLAYER_X = 80;
  let LEAD_OFFSET_X = 800;
  let SECOND_OFFSET_X = 50;
  let THIRD_OFFSET_X = 20;

  // The `bird` now represents the front reindeer (the thing player controls)
  let bird = { x: PLAYER_X + LEAD_OFFSET_X, y: HEIGHT / 2, vy: 0, w: 48, h: 32 };
  // Trail for chain-following: record the vertical path (y) of the lead reindeer
  // at the anchor X (PLAYER_X). Trailing parts sample earlier entries so they
  // follow the exact same vertical trajectory but with a frame delay.
  // legacy marker: const TRAIL_LENGTH
  let TRAIL_LENGTH = 300;
  let trail = [];
  // Physics constants will be converted to px/sec and scaled to display size on resize
  // tuned defaults are now pulled from config during resize; initialize reasonable placeholders
  let GRAVITY_PER_S = 1000; // px/s^2 placeholder (will be overwritten on resize)
  let FLAP_VY = -240; // px/s placeholder

  // Speed scaling per second (placeholders)
  let BASE_SPEED_PX_S = 120;
  let SPEED_PER_SCORE_PX_S = 6;

  const chimneys = [];
  let GAP = 110;
  const SPAWN_INTERVAL_MS_BASE = Math.round(90 * (1000 / 60)); // ~1500ms
  let SPAWN_INTERVAL_MS = SPAWN_INTERVAL_MS_BASE;
  let lastSpawnMs = 0;
  let frame = 0;
  let score = 0;
  let running = true;
  // Grace period (ms) at start before falling begins; config may override on resize
  let GRACE_MS = 1200;
  let graceRemainingMs = 0;

  function setStatus(text) { statusEl.textContent = text || ''; }

  function spawnChimney() {
    const topHeight = 30 + Math.random() * (HEIGHT - GAP - 60);
    chimneys.push({ x: WIDTH + 10, top: topHeight, passed: false });
  }

  function reset() {
    bird = { x: PLAYER_X + LEAD_OFFSET_X, y: HEIGHT / 2, vy: 0, w: bird.w, h: bird.h };
    chimneys.length = 0;
    frame = 0;
    score = 0;
    running = true;
    setStatus('');
    // initialize trail so the chain has sensible starting values (anchor X)
    trail.length = 0;
    for (let i = 0; i < TRAIL_LENGTH; i++) trail.push({ x: PLAYER_X, y: bird.y });
    graceRemainingMs = GRACE_MS;
    lastSpawnMs = performance.now() + graceRemainingMs;
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

  // Time-based tick using requestAnimationFrame for consistent timing on mobile
  let lastFrameTs = null;
  function frameLoop(ts) {
    if (!lastFrameTs) lastFrameTs = ts;
    const dtMs = ts - lastFrameTs;
    const dt = dtMs / 1000; // seconds
    lastFrameTs = ts;
    if (!running) {
      requestAnimationFrame(frameLoop);
      return;
    }
    frame += 1;

    // If in grace period: don't apply gravity or move chimneys, but keep clouds moving
    if (graceRemainingMs > 0) {
      graceRemainingMs -= dtMs;
      // Keep the lead position steady in the trail so the chain looks idle
      trail.unshift({ x: PLAYER_X, y: bird.y });
      if (trail.length > TRAIL_LENGTH) trail.pop();
      // Background parallax can still animate a little
      const farSpeed = 0.25 + score * 0.01;
      const nearSpeed = 0.6 + score * 0.02;
      const silSpeed = 0.35 + score * 0.01;
      for (const c of cloudsFar) {
        c.x -= farSpeed * (dt * 60);
        if (c.x + c.w < -40) c.x = WIDTH + Math.random() * 120;
      }
      for (const c of cloudsNear) {
        c.x -= nearSpeed * (dt * 60);
        if (c.x + c.w < -40) c.x = WIDTH + Math.random() * 120;
      }
      for (const s of silhouettes) {
        s.x -= silSpeed * (dt * 60);
        if (s.x + s.w < -100) s.x = WIDTH + Math.random() * 200;
      }
      // Draw state and wait
      draw();
      requestAnimationFrame(frameLoop);
      return;
    }

    // Physics (vy in px/sec, y in px)
    bird.vy += GRAVITY_PER_S * dt;
    bird.y += bird.vy * dt;
    // Record lead position into trail
    trail.unshift({ x: PLAYER_X, y: bird.y });
    if (trail.length > TRAIL_LENGTH) trail.pop();

    // Spawn chimneys by elapsed time
    if (ts - lastSpawnMs > SPAWN_INTERVAL_MS) {
      spawnChimney();
      lastSpawnMs = ts;
    }

    // Move chimneys using px/sec speed
    const timeFactorSpeed = BASE_SPEED_PX_S + score * SPEED_PER_SCORE_PX_S + Math.floor(frame / 600) * 0.02 * 60;
    for (let i = chimneys.length - 1; i >= 0; i--) {
      chimneys[i].x -= timeFactorSpeed * dt;
      const leadX = PLAYER_X + LEAD_OFFSET_X;
      if (!chimneys[i].passed && chimneys[i].x + 40 < leadX) {
        chimneys[i].passed = true;
        score += 1;
        scoreEl.textContent = `Score: ${score}`;
      }
      if (chimneys[i].x < -80) chimneys.splice(i, 1);
    }

    // Background parallax
    const farSpeed = 0.25 + score * 0.01;
    const nearSpeed = 0.6 + score * 0.02;
    const silSpeed = 0.35 + score * 0.01;
    for (const c of cloudsFar) {
      c.x -= farSpeed * (dt * 60);
      if (c.x + c.w < -40) c.x = WIDTH + Math.random() * 120;
    }
    for (const c of cloudsNear) {
      c.x -= nearSpeed * (dt * 60);
      if (c.x + c.w < -40) c.x = WIDTH + Math.random() * 120;
    }
    for (const s of silhouettes) {
      s.x -= silSpeed * (dt * 60);
      if (s.x + s.w < -100) s.x = WIDTH + Math.random() * 200;
    }

  // Collisions
  const leadX = PLAYER_X + LEAD_OFFSET_X;
  const leadY = (trail[0] || { y: bird.y }).y;
    // allow tuning of the hitbox via config to make collisions feel fairer
    const cfgLocal = (window && window.__ANDEN_CONFIG__) ? window.__ANDEN_CONFIG__ : {};
    const hitScale = (typeof cfgLocal.reindeerHitBoxScale !== 'undefined') ? cfgLocal.reindeerHitBoxScale : 0.9;
    const halfW = Math.round((bird.w * hitScale) / 2);
    const halfH = Math.round((bird.h * hitScale) / 2);
    if (leadY + halfH >= HEIGHT || leadY - halfH <= 0) {
      gameOver();
    }
    for (const c of chimneys) {
      const cx = c.x;
      const topH = c.top;
      const bottomY = topH + GAP;
      if (leadX + halfW > cx && leadX - halfW < cx + 40) {
        if (leadY - halfH < topH || leadY + halfH > bottomY) {
          gameOver();
        }
      }
    }

    draw();
    requestAnimationFrame(frameLoop);
  }

  function draw() {
    const cfgLocal = (window && window.__ANDEN_CONFIG__) ? window.__ANDEN_CONFIG__ : {};
    // sky background gradient
    const grad = ctx.createLinearGradient(0, 0, 0, HEIGHT);
    grad.addColorStop(0, '#7ec0ff');
    grad.addColorStop(1, '#5aa0d8');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    // far clouds
    for (const cl of cloudsFar) drawCloud(cl, 'far');

    // near clouds and silhouettes should be in the background behind chimneys
    for (const cl of cloudsNear) drawCloud(cl, 'near');
    // silhouettes (trees/houses)
    drawSilhouettes();

    // chimneys (foreground obstacles)
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

    // santa (bird) + chain-following parts
    // Santa and sleigh follow the lead reindeer's vertical trajectory with a delay
    const santaTrailIndex = Math.min(trail.length - 1, 18);
    const santaPos = trail[santaTrailIndex] || { x: PLAYER_X, y: bird.y };
    const sx = santaPos.x - bird.w / 2;
    const sy = santaPos.y - bird.h / 2;
    // draw sleigh + Santa (prefer sprite, fallback to drawn sleigh + santa.gif)
    const centerX = PLAYER_X;
    const centerY = santaPos.y;
    const sleighW = Math.round(bird.w * 1.8);
    const sleighH = Math.round(bird.h * 1.4);
    if (!drawSpriteCentered(sprites.santaSleigh, centerX, centerY, sleighW, sleighH)) {
      // fallback: draw the simple sleigh and the santa.gif
      drawSleighAndReindeer(sx, sy);
      if (santaImg.complete) {
        // Draw Santa using configurable sprite scale (default keeps previous 0.66)
        const santaScale = (typeof cfgLocal.santaSpriteScale !== 'undefined') ? cfgLocal.santaSpriteScale : 0.66;
        const santaW = Math.round(bird.w * santaScale);
        const santaH = Math.round(bird.h * santaScale);
        ctx.drawImage(santaImg, Math.round(centerX - santaW / 2), Math.round(centerY - santaH / 2), santaW, santaH);
      } else {
        ctx.fillStyle = '#fff';
        ctx.fillRect(sx, sy, bird.w, bird.h);
      }
    }
    // draw the reindeers based on the trail (draw after Santa so they appear on top)
    drawReindeersFromTrail();
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
  }

  function drawReindeerAt(cx, cy, scale = 1) {
    // Draw a small stylized reindeer centered at (cx, cy)
    const s = scale || 1;
    ctx.save();
    ctx.fillStyle = '#7a4d20';
    // body
    const bw = 12 * s;
    const bh = 8 * s;
    const bx = Math.round(cx - bw / 2);
    const by = Math.round(cy - bh / 2 + 2 * s);
    ctx.fillRect(bx, by, bw, bh);
    // head
    const hx = bx - 4 * s;
    const hy = by + 2 * s;
    ctx.beginPath();
    ctx.arc(hx, hy, 3 * s, 0, Math.PI * 2);
    ctx.fill();
    // antlers
    ctx.strokeStyle = '#5b3a12';
    ctx.lineWidth = Math.max(1, s);
    ctx.beginPath();
    ctx.moveTo(hx - 1 * s, hy - 2 * s);
    ctx.lineTo(hx - 6 * s, hy - 8 * s);
    ctx.moveTo(hx + 0 * s, hy - 1 * s);
    ctx.lineTo(hx - 3 * s, hy - 8 * s);
    ctx.stroke();
    ctx.restore();
  }

  function drawSpriteCentered(img, cx, cy, w, h) {
    if (!img) return false;
    if (!img.complete) return false;
    ctx.drawImage(img, Math.round(cx - w / 2), Math.round(cy - h / 2), w, h);
    return true;
  }

  function drawReindeersFromTrail() {
    if (!trail || trail.length === 0) return;
    // Indices into the trail to space parts along the path (frames behind)
    const leadIdx = 0;
    const secondIdx = Math.min(trail.length - 1, 8);
    const thirdIdx = Math.min(trail.length - 1, 16);
    // horizontal positions are fixed offsets from the anchor (PLAYER_X)
    const r1x = PLAYER_X + LEAD_OFFSET_X;
    const r2x = PLAYER_X + SECOND_OFFSET_X;
    const r3x = PLAYER_X + THIRD_OFFSET_X;
    // Use the trail y directly so drawn reindeer align with collision y
    const leadY = (trail[leadIdx] || { y: bird.y }).y;
    const secondY = (trail[secondIdx] || { y: bird.y }).y;
    const thirdY = (trail[thirdIdx] || { y: bird.y }).y;
    // sizes for sprite drawing
    // Allow tuning of sprite scale from the config (default keeps previous behavior)
    const cfgLocal = (window && window.__ANDEN_CONFIG__) ? window.__ANDEN_CONFIG__ : {};
    const reScale = (typeof cfgLocal.reindeerSpriteScale !== 'undefined') ? cfgLocal.reindeerSpriteScale : 1.0;
    // Make reindeers ~55% of bird size and then apply optional scale multiplier
    const reW = Math.round(bird.w * 0.55 * reScale);
    const reH = Math.round(bird.h * 0.55 * reScale);
    // draw leading reindeers (on top) at their fixed X, sampling Y from trail
    if (!drawSpriteCentered(sprites.reindeer1, r1x, leadY, reW, reH)) drawReindeerAt(r1x, leadY, 1);
    if (!drawSpriteCentered(sprites.reindeer2, r2x, secondY, reW, reH)) drawReindeerAt(r2x, secondY, 1);
    if (!drawSpriteCentered(sprites.reindeer3, r3x, thirdY, reW, reH)) drawReindeerAt(r3x, thirdY, 1);
  }

  function drawCloud(cloud, layer) {
    ctx.save();
    ctx.globalAlpha = cloud.opacity || 0.6;
    ctx.fillStyle = '#fff';
    const cx = cloud.x;
    const cy = cloud.y;
    const w = cloud.w;
    const h = cloud.h;
    // draw three overlapping circles for a cloud
    ctx.beginPath();
    ctx.ellipse(cx + w * 0.2, cy + h * 0.2, w * 0.3, h * 0.6, 0, 0, Math.PI * 2);
    ctx.ellipse(cx + w * 0.5, cy + h * 0.1, w * 0.35, h * 0.7, 0, 0, Math.PI * 2);
    ctx.ellipse(cx + w * 0.8, cy + h * 0.25, w * 0.28, h * 0.55, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawSilhouettes() {
    const base = HEIGHT - 20;
    ctx.save();
    ctx.fillStyle = '#0b2b12';
    for (const s of silhouettes) {
      const x = s.x;
      const w = s.w;
      const h = s.h;
      if (s.type === 'house') {
        // box + roof
        ctx.fillRect(x, base - h, w, h);
        ctx.beginPath();
        ctx.moveTo(x - 2, base - h);
        ctx.lineTo(x + w / 2, base - h - 10);
        ctx.lineTo(x + w + 2, base - h);
        ctx.closePath();
        ctx.fill();
      } else {
        // tree: triangle
        ctx.beginPath();
        ctx.moveTo(x + w / 2, base - h - 6);
        ctx.lineTo(x, base - 6);
        ctx.lineTo(x + w, base - 6);
        ctx.closePath();
        ctx.fill();
      }
    }
    ctx.restore();
  }

  function flap() {
    bird.vy = FLAP_VY;
    try {
      if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
    } catch (e) {}
    // Prefer a user-supplied audio file if available, otherwise fallback to synthesized jingle
    if (audioEl) {
      try {
        audioEl.currentTime = 0;
        audioEl.play().catch(() => jingle());
      } catch (e) {
        jingle();
      }
    } else {
      jingle();
    }
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
    // Support Space key for flap, but avoid triggering actions when the
    // high-score overlay is visible (prevent accidental submit/reset).
    if (e.code === 'Space' || e.key === ' ') {
      const overlay = document.getElementById('overlay');
      const overlayVisible = overlay && overlay.style.display !== 'none';
      const active = document.activeElement;
      const activeTag = active && active.tagName && active.tagName.toLowerCase();
      if (overlayVisible) {
        // If the user is typing in an input/textarea, allow spaces to be entered.
        if (activeTag === 'input' || activeTag === 'textarea') return;
        // Otherwise prevent default to avoid activating focused buttons.
        e.preventDefault();
        return;
      }
      if (!running) {
        reset();
        return;
      }
      flap();
    }
  });

  // Canvas interactions: handle mouse and touch. Ignore taps when overlay is visible.
  canvas.addEventListener('mousedown', (e) => {
    const overlay = document.getElementById('overlay');
    if (overlay && overlay.style.display !== 'none') return;
    if (!running) reset();
    flap();
  });
  // Touch support for phones
  canvas.addEventListener('touchstart', (e) => {
    const overlay = document.getElementById('overlay');
    if (overlay && overlay.style.display !== 'none') return;
    e.preventDefault();
    if (!running) reset();
    flap();
  }, { passive: false });

  // Responsive handling and start loop
  window.addEventListener('resize', () => {
    const wasRunning = running;
    running = false;
    resizeCanvasAndLayout();
    reset();
    draw();
    if (wasRunning) {
      running = true;
    }
  });

  // initial setup
  resizeCanvasAndLayout();
  reset();
  draw();
  requestAnimationFrame(frameLoop);
})();
