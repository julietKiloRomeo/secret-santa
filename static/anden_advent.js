// Simple Flappy-Santa implementation: press space or click to flap
(function () {
  const canvas = document.getElementById("santa-canvas");
  if (!canvas) {
    return;
  }
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return;
  }
  const scoreEl = document.getElementById("santa-score");
  const statusEl = document.getElementById("santa-status");

  try {
    canvas.style.touchAction = "none";
    canvas.setAttribute("touch-action", "none");
  } catch (e) {}

  const canvasWrap = canvas.parentElement;

  // Logical drawing width/height in CSS pixels (canvas is tall: height ~= 2 * width)
  let WIDTH = canvas.clientWidth || 400;
  let HEIGHT = WIDTH * 2;

  // Santa sprite (use existing santa.gif as a simple image)
  const santaImg = new Image();
  santaImg.src = "/static/santa.gif";

  // Sprite assets (PNG) placed in static/sprites/
  const SPRITE_DIR = "/static/sprites";
  const SPRITE_PATHS = {
    reindeer1: `${SPRITE_DIR}/reindeer1.png`,
    reindeer2: `${SPRITE_DIR}/reindeer2.png`,
    reindeer3: `${SPRITE_DIR}/reindeer3.png`,
    santaSleigh: `${SPRITE_DIR}/santa_sleigh.png`,
  };
  const sprites = {};
  const DEFAULT_REINDEER_ASPECT = 148 / 109; // natural sprite ratio (height / width)
  function loadSprite(name, path) {
    const img = new Image();
    img.src = path;
    img.onload = () => {
      sprites[name] = img;
    };
    img.onerror = () => {
      sprites[name] = null;
    };
    sprites[name] = img; // store object immediately so callers can check .complete
    return img;
  }
  // Start loading (non-blocking)
  loadSprite("reindeer1", SPRITE_PATHS.reindeer1);
  loadSprite("reindeer2", SPRITE_PATHS.reindeer2);
  loadSprite("reindeer3", SPRITE_PATHS.reindeer3);
  loadSprite("santaSleigh", SPRITE_PATHS.santaSleigh);

  function getReindeerAspectRatio() {
    const cfg = window && window.__ANDEN_CONFIG__ ? window.__ANDEN_CONFIG__ : {};
    if (
      typeof cfg.reindeerSpriteAspect === "number" &&
      cfg.reindeerSpriteAspect > 0
    ) {
      return cfg.reindeerSpriteAspect;
    }
    const candidate =
      (sprites.reindeer1 && sprites.reindeer1.naturalWidth
        ? sprites.reindeer1
        : null) ||
      (sprites.reindeer2 && sprites.reindeer2.naturalWidth
        ? sprites.reindeer2
        : null) ||
      (sprites.reindeer3 && sprites.reindeer3.naturalWidth
        ? sprites.reindeer3
        : null);
    if (
      candidate &&
      candidate.naturalWidth > 0 &&
      candidate.naturalHeight > 0
    ) {
      return candidate.naturalHeight / candidate.naturalWidth;
    }
    return DEFAULT_REINDEER_ASPECT;
  }

  function pushDebugEvent(key, payload) {
    try {
      if (typeof window === "undefined") return;
      const w = window;
      const bag = (w.__ANDEN_DEBUG__ = w.__ANDEN_DEBUG__ || {});
      if (!bag) return;
      if (!Array.isArray(bag[key])) bag[key] = [];
      bag[key].push(payload);
    } catch (e) {}
  }

  // Background parallax: clouds and silhouettes
  const cloudsFar = [];
  const cloudsNear = [];
  const silhouettes = [];
  const CLOUD_COUNTS = { far: 4, near: 3 };

  function mkCloud(x, y, w, h, opacity) {
    return { x, y, w, h, opacity };
  }

  function mkSilhouette(x, w, h, type) {
    const ground = HEIGHT - Math.max(28, HEIGHT * 0.18);
    const jitter = Math.random() * Math.max(6, HEIGHT * 0.02);
    return { x, w, h, type, base: ground + jitter };
  }

  function initBackground() {
    cloudsFar.length = 0;
    cloudsNear.length = 0;
    silhouettes.length = 0;
    for (let i = 0; i < CLOUD_COUNTS.far; i++) {
      cloudsFar.push(
        mkCloud(
          Math.random() * WIDTH,
          Math.random() * (HEIGHT * 0.35),
          90 + Math.random() * 140,
          30 + Math.random() * 20,
          0.35 + Math.random() * 0.25,
        ),
      );
    }
    for (let i = 0; i < CLOUD_COUNTS.near; i++) {
      cloudsNear.push(
        mkCloud(
          Math.random() * WIDTH,
          Math.random() * (HEIGHT * 0.45),
          120 + Math.random() * 180,
          40 + Math.random() * 30,
          0.55 + Math.random() * 0.3,
        ),
      );
    }
    // silhouettes (trees/houses) at various x positions
    const baseY = HEIGHT - 28;
    let cursor = -40;
    while (cursor < WIDTH * 2) {
      const w = 40 + Math.floor(Math.random() * 80);
      const h = 20 + Math.floor(Math.random() * 60);
      const type = Math.random() > 0.6 ? "house" : "tree";
      silhouettes.push(mkSilhouette(cursor, w, h, type));
      cursor += w + 20 + Math.floor(Math.random() * 60);
    }
  }

  initBackground();

  let arcadeLayoutActive = false;

  function ensureArcadeBackButton() {
    const body = document.body;
    if (!body) return null;
    let btn = document.querySelector("[data-arcade-back-button]");
    if (!btn) {
      btn = document.createElement("button");
      btn.type = "button";
      btn.className = "arcade-back-button";
      btn.setAttribute("data-arcade-back-button", "1");
      btn.setAttribute("aria-label", "Tilbage til start");
      btn.textContent = "Tilbage";
      btn.addEventListener("click", () => {
        const target =
          (document.body && document.body.dataset.arcadeBackTarget) || "/";
        if (target === "history-back") {
          if (window.history.length > 1) {
            window.history.back();
          } else {
            window.location.assign("/");
          }
          return;
        }
        window.location.assign(target);
      });
      body.appendChild(btn);
    }
    return btn;
  }

  function shouldActivateArcadeLayout() {
    const body = document.body;
    if (body && body.dataset.arcadeFullscreenOptOut === "1") {
      return false;
    }
    return true;
  }

  function activateArcadeLayout() {
    const body = document.body;
    if (!body) return;
    if (arcadeLayoutActive && body.dataset.arcadeGame === "anden-advent")
      return;
    body.classList.add("arcade-fullscreen");
    body.dataset.arcadeGame = "anden-advent";
    body.dataset.arcadeBack = "1";
    if (!body.dataset.arcadeBackTarget) {
      body.dataset.arcadeBackTarget = "/";
    }
    ensureArcadeBackButton();
    arcadeLayoutActive = true;
  }

  function deactivateArcadeLayout() {
    const body = document.body;
    if (!body || body.dataset.arcadeGame !== "anden-advent") {
      arcadeLayoutActive = false;
      return;
    }
    body.classList.remove("arcade-fullscreen");
    delete body.dataset.arcadeGame;
    body.dataset.arcadeBack = "0";
    arcadeLayoutActive = false;
  }

  function syncArcadeLayout() {
    if (shouldActivateArcadeLayout()) {
      activateArcadeLayout();
    } else if (arcadeLayoutActive) {
      deactivateArcadeLayout();
    }
  }

  syncArcadeLayout();

  // Responsive canvas sizing and layout
  function resizeCanvasAndLayout() {
    const wrap = canvasWrap;
    const wrapParentWidth = wrap && wrap.clientWidth
      ? wrap.clientWidth
      : wrap && wrap.parentElement
        ? wrap.parentElement.clientWidth
        : window.innerWidth * 0.9;
    const viewportHeight =
      window.innerHeight ||
      (document.documentElement ? document.documentElement.clientHeight : wrapParentWidth) ||
      wrapParentWidth;
    const body = document.body;
    const paddingY = body && body.classList.contains("arcade-fullscreen")
      ? 40
      : Math.max(100, Math.min(160, viewportHeight * 0.18));
    const HEIGHT_RATIO = 2;
    const rawHeightAllowance = Math.max(0, viewportHeight - paddingY);
    let displayWidth = Math.min(
      wrapParentWidth,
      Math.floor(rawHeightAllowance / HEIGHT_RATIO),
    );
    if (!isFinite(displayWidth) || displayWidth <= 0) {
      displayWidth = wrapParentWidth > 0 ? wrapParentWidth : 320;
    }
    const MIN_WIDTH = 200;
    if (
      rawHeightAllowance >= MIN_WIDTH * HEIGHT_RATIO &&
      wrapParentWidth >= MIN_WIDTH
    ) {
      displayWidth = Math.min(wrapParentWidth, Math.max(displayWidth, MIN_WIDTH));
    }
    let displayHeight = Math.max(1, Math.round(displayWidth * HEIGHT_RATIO));
    const maxHeight = Math.max(120, rawHeightAllowance - 20);
    if (displayHeight > maxHeight) {
      displayHeight = maxHeight;
      displayWidth = Math.max(120, Math.round(displayHeight / HEIGHT_RATIO));
    }
    const DPR = window.devicePixelRatio || 1;
    if (wrap) {
      wrap.style.maxWidth = `${displayWidth}px`;
      wrap.style.width = "100%";
      wrap.style.marginLeft = "auto";
      wrap.style.marginRight = "auto";
    }
    try {
      canvas.style.width = "100%";
      canvas.style.height = `${displayHeight}px`;
    } catch (e) {}
    canvas.width = Math.round(displayWidth * DPR);
    canvas.height = Math.round(displayHeight * DPR);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    WIDTH = displayWidth;
    HEIGHT = displayHeight; // height intentionally 2x width for tall layout

    // scale factor relative to legacy 400px canvas so game feel stays familiar
    const scale = WIDTH / 400;

    // load optional tuning from config file `static/anden_config.js`
    const cfg =
      window && window.__ANDEN_CONFIG__ ? window.__ANDEN_CONFIG__ : {};

    // geometry (ratios allow easy tuning in the config)
    PLAYER_X = Math.round(WIDTH * (cfg.playerXRatio || 0.18));
    LEAD_OFFSET_X = Math.round(WIDTH * (cfg.leadOffsetXRatio || 0.145));
    SECOND_OFFSET_X = Math.round(WIDTH * (cfg.secondOffsetXRatio || 0.085));
    THIRD_OFFSET_X = Math.max(
      8,
      SECOND_OFFSET_X +
        Math.round(WIDTH * (cfg.thirdOffsetXRatioAdjust || -0.03)),
    );

    // sizes
    const spriteAspect = Math.max(1, getReindeerAspectRatio());
    bird.w = Math.max(28, Math.round(WIDTH * 0.12));
    bird.h = Math.max(28, Math.round(bird.w * spriteAspect));
    TRAIL_LENGTH = Math.max(
      cfg.trailLengthMin || 80,
      Math.round(2.5 * 60 * scale),
    );

    // physics scaled (tuned values) - config holds base numbers which we scale
    GRAVITY_PER_S = (cfg.gravityPerSecond || 800) * scale;
    const baseFlapVY =
      typeof cfg.flapVY !== "undefined" ? cfg.flapVY : -260;
    FLAP_VY = baseFlapVY * scale;
    BASE_SPEED_PX_S = (cfg.baseSpeedPxPerS || 120) * scale;
    SPEED_PER_SCORE_PX_S = (cfg.speedPerScorePxPerS || 6) * scale;
    const defaultGapRatio = 0.275 * 1.5;
    const gapRatio =
      typeof cfg.gapRatio !== "undefined" ? cfg.gapRatio : defaultGapRatio;
    GAP = Math.max(cfg.gapMin || 48, Math.round(WIDTH * gapRatio));
    const verticalSpan = Math.max(60, HEIGHT - GAP - 60);
    const adjustedSpan = verticalSpan * 0.9;
    MAX_TOP = Math.max(30, adjustedSpan);
    SPAWN_INTERVAL_MS =
      typeof cfg.spawnIntervalMsBase !== "undefined"
        ? cfg.spawnIntervalMsBase
        : SPAWN_INTERVAL_MS_BASE;

    // initialize trail buffer
    trail.length = 0;
    for (let i = 0; i < TRAIL_LENGTH; i++)
      trail.push({ x: PLAYER_X, y: bird.y });

    initBackground();
  }

  // Audio: try to find a user-supplied audio file in /static
  const AUDIO_CANDIDATES = [
    "sleigh_bell.mp3",
    "sleigh-bell.mp3",
    "sleigh.mp3",
    "jingle.mp3",
    "bell.mp3",
    "jingle.wav",
    "bell.wav",
  ];
  let audioEl = null;
  async function findAndLoadAudio() {
    for (const name of AUDIO_CANDIDATES) {
      try {
        const res = await fetch("/static/" + name, { method: "HEAD" });
        if (res.ok) {
          audioEl = new Audio("/static/" + name);
          audioEl.preload = "auto";
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
      o1.type = "sine";
      o2.type = "sine";
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
      console.warn("Audio jingle failed", e);
    }
  }

  // Layout anchors (will be computed on resize)
  let PLAYER_X = 80;
  let LEAD_OFFSET_X = 800;
  let SECOND_OFFSET_X = 50;
  let THIRD_OFFSET_X = 20;

  // The `bird` now represents the front reindeer (the thing player controls)
  let bird = {
    x: PLAYER_X + LEAD_OFFSET_X,
    y: HEIGHT / 2,
    vy: 0,
    w: 48,
    h: Math.round(48 * DEFAULT_REINDEER_ASPECT),
  };
  // Trail for chain-following: record the vertical path (y) of the lead reindeer
  // at the anchor X (PLAYER_X). Trailing parts sample earlier entries so they
  // follow the exact same vertical trajectory but with a frame delay.
  // legacy marker: const TRAIL_LENGTH
  let TRAIL_LENGTH = 300;
  let trail = [];
  // Physics constants will be converted to px/sec and scaled to display size on resize
  // tuned defaults are now pulled from config during resize; initialize reasonable placeholders
  let GRAVITY_PER_S = 1000; // px/s^2 placeholder (will be overwritten on resize)
  let FLAP_VY = -260; // px/s placeholder (negative = upward)

  // Speed scaling per second (placeholders)
  let BASE_SPEED_PX_S = 120;
  let SPEED_PER_SCORE_PX_S = 6;

  const chimneys = [];
  const chimneySpawnLog = [];
  let GAP = 110;
  let MAX_TOP = 0;
  const SPAWN_INTERVAL_MS_BASE = Math.round(180 * (1000 / 60)); // ~3000ms
  let SPAWN_INTERVAL_MS = SPAWN_INTERVAL_MS_BASE;
  let lastSpawnMs = 0;
  let frame = 0;
  let score = 0;
  let running = true;
  // Grace period (ms) at start before falling begins; config may override on resize
  let GRACE_MS = 1200;
  let graceRemainingMs = 0;

  function setStatus(text) {
    statusEl.textContent = text || "";
  }

  function isOverlayActive() {
    const neon = document.getElementById("arcade-overlay");
    if (neon && neon.classList.contains("visible")) return true;
    const legacy = document.getElementById("overlay");
    return legacy && legacy.style.display !== "none";
  }

  function spawnChimney() {
    const span = Math.max(30, MAX_TOP);
    const topHeight = 30 + Math.random() * span;
    chimneys.push({ x: WIDTH + 10, top: topHeight, passed: false });
    const timestamp =
      typeof performance !== "undefined" && performance.now
        ? performance.now()
        : Date.now();
    pushDebugEvent("chimneySpawns", { timestamp });
    chimneySpawnLog.push(timestamp);
    if (chimneySpawnLog.length > 32) chimneySpawnLog.shift();
  }

  function reset() {
    bird = {
      x: PLAYER_X + LEAD_OFFSET_X,
      y: HEIGHT / 2,
      vy: 0,
      w: bird.w,
      h: bird.h,
    };
    chimneys.length = 0;
    frame = 0;
    score = 0;
    running = true;
    setStatus("");
    // initialize trail so the chain has sensible starting values (anchor X)
    trail.length = 0;
    for (let i = 0; i < TRAIL_LENGTH; i++)
      trail.push({ x: PLAYER_X, y: bird.y });
    graceRemainingMs = GRACE_MS;
    lastSpawnMs = performance.now() + graceRemainingMs;
    try {
      if (window.arcadeOverlay && window.arcadeOverlay.hideOverlay) {
        window.arcadeOverlay.hideOverlay();
      }
    } catch (e) {}
  }

  async function gameOver() {
    running = false;
    setStatus("Game Over! Try igen 🎅");
    deathPauseUntil = Date.now() + 1000;
    try {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    } catch (e) {}
    if (window.arcadeOverlay) {
      try {
        await window.arcadeOverlay.handleHighScoreFlow({
          gameId: "anden-advent",
          score,
          allowSkip: true,
          title: "Ny high score!",
        });
      } catch (e) {
        console.error("Arcade high score flow failed", e);
      }
    }
  }

  function consumeGracePeriod() {
    if (graceRemainingMs <= 0) return;
    graceRemainingMs = 0;
    try {
      const now =
        typeof performance !== "undefined" && performance.now
          ? performance.now()
          : Date.now();
      lastSpawnMs = now;
    } catch (e) {
      lastSpawnMs = Date.now();
    }
  }

  // --- Refactored helpers for clearer game loop ---
  function updatePhysics(dt) {
    // Physics (vy in px/sec, y in px)
    bird.vy += GRAVITY_PER_S * dt;
    bird.y += bird.vy * dt;
    // Record lead position into trail
    trail.unshift({ x: PLAYER_X, y: bird.y });
    if (trail.length > TRAIL_LENGTH) trail.pop();
  }

  function updateObstacles(dt, ts) {
    // Spawn chimneys by elapsed time
    if (ts - lastSpawnMs > SPAWN_INTERVAL_MS) {
      spawnChimney();
      lastSpawnMs = ts;
    }

    // Move chimneys using px/sec speed
    const timeFactorSpeed =
      BASE_SPEED_PX_S +
      score * SPEED_PER_SCORE_PX_S +
      Math.floor(frame / 600) * 0.02 * 60;
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
  }

  function updateBackground(dt) {
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
      if (s.x + s.w < -100) {
        s.x = WIDTH + Math.random() * 200;
        s.base = HEIGHT - Math.max(28, HEIGHT * 0.18) + Math.random() * Math.max(6, HEIGHT * 0.02);
      }
    }
  }

  function checkCollisions() {
    const leadX = PLAYER_X + LEAD_OFFSET_X;
    const leadY = (trail[0] || { y: bird.y }).y;
    // allow tuning of the hitbox via config to make collisions feel fairer
    const cfgLocal =
      window && window.__ANDEN_CONFIG__ ? window.__ANDEN_CONFIG__ : {};
    const hitScale =
      typeof cfgLocal.reindeerHitBoxScale !== "undefined"
        ? cfgLocal.reindeerHitBoxScale
        : 0.72;
    const halfW = Math.round((bird.w * hitScale) / 2);
    const halfH = Math.round((bird.h * hitScale) / 2);
    if (leadY + halfH >= HEIGHT || leadY - halfH <= 0) {
      gameOver();
      return;
    }
    for (const c of chimneys) {
      const cx = c.x;
      const topH = c.top;
      const bottomY = topH + GAP;
      if (leadX + halfW > cx && leadX - halfW < cx + 40) {
        if (leadY - halfH < topH || leadY + halfH > bottomY) {
          gameOver();
          return;
        }
      }
    }
  }

  function render() {
    draw();
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
      updateBackground(dt);
      // Draw state and wait
      render();
      requestAnimationFrame(frameLoop);
      return;
    }
    // Step physics, obstacles and background via dedicated helpers for clarity and testability
    updatePhysics(dt);
    updateObstacles(dt, ts);
    updateBackground(dt);

    // Collision detection handled separately to keep updates focused
    checkCollisions();

    render();
    requestAnimationFrame(frameLoop);
  }

  function draw() {
    const cfgLocal =
      window && window.__ANDEN_CONFIG__ ? window.__ANDEN_CONFIG__ : {};
    // sky background gradient
    const grad = ctx.createLinearGradient(0, 0, 0, HEIGHT);
    grad.addColorStop(0, "#7ec0ff");
    grad.addColorStop(1, "#5aa0d8");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    // far clouds
    for (const cl of cloudsFar) drawCloud(cl, "far");

    // near clouds and silhouettes should be in the background behind chimneys
    for (const cl of cloudsNear) drawCloud(cl, "near");
    // silhouettes (trees/houses)
    drawSilhouettes();

    // chimneys (foreground obstacles)
    for (const c of chimneys) {
      ctx.fillStyle = "#8b3";
      // top
      ctx.fillRect(c.x, 0, 40, c.top);
      // bottom
      ctx.fillRect(c.x, c.top + GAP, 40, HEIGHT - (c.top + GAP));
      // cap
      ctx.fillStyle = "#a33";
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
    if (
      !drawSpriteCentered(
        sprites.santaSleigh,
        centerX,
        centerY,
        sleighW,
        sleighH,
      )
    ) {
      // fallback: draw the simple sleigh and the santa.gif
      drawSleighAndReindeer(sx, sy);
      if (santaImg.complete) {
        // Draw Santa using configurable sprite scale (default keeps previous 0.66)
        const santaScale =
          typeof cfgLocal.santaSpriteScale !== "undefined"
            ? cfgLocal.santaSpriteScale
            : 0.66;
        const santaW = Math.round(bird.w * santaScale);
        const santaH = Math.round(bird.h * santaScale);
        ctx.drawImage(
          santaImg,
          Math.round(centerX - santaW / 2),
          Math.round(centerY - santaH / 2),
          santaW,
          santaH,
        );
      } else {
        ctx.fillStyle = "#fff";
        ctx.fillRect(sx, sy, bird.w, bird.h);
      }
    }
    // draw the reindeers based on the trail (draw after Santa so they appear on top)
    drawReindeersFromTrail();

    drawScoreBadge();
  }

  function drawSleighAndReindeer(sx, sy) {
    // Sleigh behind Santa
    ctx.save();
    // sleigh body
    ctx.fillStyle = "#8b0000";
    ctx.fillRect(sx - 28, sy + 8, bird.w + 36, 14);
    // sleigh runner
    ctx.strokeStyle = "#222";
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
    ctx.fillStyle = "#7a4d20";
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
    ctx.strokeStyle = "#5b3a12";
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
    const cfgLocal =
      window && window.__ANDEN_CONFIG__ ? window.__ANDEN_CONFIG__ : {};
    const reScale =
      typeof cfgLocal.reindeerSpriteScale !== "undefined"
        ? cfgLocal.reindeerSpriteScale
        : 1.0;
    // Make reindeers ~55% of bird width and preserve sprite aspect ratio
    const spriteAspect = Math.max(1, getReindeerAspectRatio());
    const reW = Math.round(bird.w * 0.55 * reScale);
    const reH = Math.round(reW * spriteAspect);
    // draw leading reindeers (on top) at their fixed X, sampling Y from trail
    if (!drawSpriteCentered(sprites.reindeer1, r1x, leadY, reW, reH))
      drawReindeerAt(r1x, leadY, 1);
    if (!drawSpriteCentered(sprites.reindeer2, r2x, secondY, reW, reH))
      drawReindeerAt(r2x, secondY, 1);
    if (!drawSpriteCentered(sprites.reindeer3, r3x, thirdY, reW, reH))
      drawReindeerAt(r3x, thirdY, 1);
  }

  function drawScoreBadge() {
    ctx.save();
    const padding = Math.round(WIDTH * 0.04);
    const boxWidth = Math.round(WIDTH * 0.36);
    const boxHeight = Math.round(WIDTH * 0.12);
    const x = WIDTH - boxWidth - padding;
    const y = padding;
    const gradient = ctx.createLinearGradient(x, y, x + boxWidth, y + boxHeight);
    gradient.addColorStop(0, "rgba(10, 34, 64, 0.8)");
    gradient.addColorStop(1, "rgba(12, 64, 92, 0.9)");
    ctx.fillStyle = gradient;
    ctx.strokeStyle = "rgba(255, 255, 255, 0.3)";
    ctx.lineWidth = 2;
    if (typeof ctx.roundRect === "function") {
      ctx.beginPath();
      ctx.roundRect(x, y, boxWidth, boxHeight, 10);
      ctx.fill();
      ctx.stroke();
    } else {
      ctx.fillRect(x, y, boxWidth, boxHeight);
      ctx.strokeRect(x, y, boxWidth, boxHeight);
    }
    ctx.font = `${Math.max(16, Math.round(WIDTH * 0.05))}px 'Press Start 2P', 'Space Mono', monospace`;
    ctx.fillStyle = "#f0f8ff";
    ctx.textAlign = "right";
    ctx.fillText(`Score ${score}`, x + boxWidth - 12, y + boxHeight - 12);
    ctx.restore();
  }

  function drawCloud(cloud, layer) {
    ctx.save();
    const opacity = cloud.opacity || 0.6;
    ctx.globalAlpha = opacity;
    ctx.fillStyle = layer === "far" ? "rgba(255,255,255,0.65)" : "rgba(255,255,255,0.9)";
    const cx = cloud.x;
    const cy = cloud.y;
    const w = cloud.w;
    const h = cloud.h;
    // draw three overlapping circles for a cloud
    ctx.beginPath();
    ctx.ellipse(
      cx + w * 0.2,
      cy + h * 0.2,
      w * 0.3,
      h * 0.6,
      0,
      0,
      Math.PI * 2,
    );
    ctx.ellipse(
      cx + w * 0.5,
      cy + h * 0.1,
      w * 0.35,
      h * 0.7,
      0,
      0,
      Math.PI * 2,
    );
    ctx.ellipse(
      cx + w * 0.8,
      cy + h * 0.25,
      w * 0.28,
      h * 0.55,
      0,
      0,
      Math.PI * 2,
    );
    ctx.fill();
    ctx.restore();
  }

  function drawSilhouettes() {
    const horizon = HEIGHT - Math.max(48, HEIGHT * 0.28);
    const ground = HEIGHT - Math.max(18, HEIGHT * 0.08);
    ctx.save();
    const groundGradient = ctx.createLinearGradient(0, horizon, 0, HEIGHT);
    groundGradient.addColorStop(0, "#042816");
    groundGradient.addColorStop(1, "#010904");
    ctx.fillStyle = groundGradient;
    ctx.fillRect(0, horizon, WIDTH, HEIGHT - horizon);

    ctx.fillStyle = "#0b2b12";
    ctx.strokeStyle = "rgba(5, 20, 12, 0.6)";
    ctx.lineWidth = 2;
    for (const s of silhouettes) {
      const baseY = Math.min(ground, s.base || ground);
      const x = s.x;
      const w = s.w;
      const h = s.h;
      if (s.type === "house") {
        ctx.fillRect(x, baseY - h, w, h);
        ctx.beginPath();
        ctx.moveTo(x - 4, baseY - h);
        ctx.lineTo(x + w / 2, baseY - h - Math.max(12, h * 0.3));
        ctx.lineTo(x + w + 4, baseY - h);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = "rgba(18, 52, 28, 0.45)";
        ctx.stroke();
        // windows glow
        const windowCount = Math.max(1, Math.floor(w / 28));
        for (let i = 0; i < windowCount; i++) {
          const wx = x + 6 + i * (w / windowCount);
          const wy = baseY - h + 8;
          ctx.fillStyle = "rgba(255, 236, 150, 0.4)";
          ctx.fillRect(wx, wy, 8, 12);
        }
        ctx.fillStyle = "#0b2b12";
      } else {
        ctx.beginPath();
        ctx.moveTo(x + w / 2, baseY - h - 6);
        ctx.lineTo(x - 6, baseY - 6);
        ctx.lineTo(x + w + 6, baseY - 6);
        ctx.closePath();
        ctx.fill();
        ctx.fillRect(x + w / 2 - 2, baseY - 6, 4, ground + 6 - (baseY - 6));
      }
      if (s.type === "house") {
        ctx.fillRect(x - 6, baseY - 4, w + 12, 6);
      }
    }
    ctx.restore();
  }

  function flap() {
    consumeGracePeriod();
    bird.vy = FLAP_VY;
    try {
      if (audioCtx && audioCtx.state === "suspended") audioCtx.resume();
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


  function isDeathPaused() {
    return deathPauseUntil && Date.now() < deathPauseUntil;
  }

  document.addEventListener("keydown", (e) => {
    if (e.code === "Space" || e.key === " ") {
      const active = document.activeElement;
      const activeTag = active?.tagName?.toLowerCase();
      const typingTarget =
        activeTag === "input" ||
        activeTag === "textarea" ||
        activeTag === "select" ||
        (active && active.isContentEditable);
      if (isOverlayActive()) {
        if (typingTarget) return;
        e.preventDefault();
        return;
      }
      if (typingTarget) return;
      e.preventDefault();
      if (isDeathPaused()) return;
      if (!running) {
        reset();
        return;
      }
      flap();
    }
  });

  function handleCanvasTap(e) {
    if (isOverlayActive()) return;
    if (e && typeof e.preventDefault === "function") e.preventDefault();
    if (isDeathPaused()) return;
    if (!running) reset();
    flap();
  }

  if (window.PointerEvent) {
    canvas.addEventListener("pointerdown", handleCanvasTap, { passive: false });
  } else {
    canvas.addEventListener("mousedown", handleCanvasTap);
    canvas.addEventListener("touchstart", handleCanvasTap, {
      passive: false,
    });
  }

  // Responsive handling and start loop
  window.addEventListener("resize", () => {
    syncArcadeLayout();
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

  // Expose minimal test hooks when running in a browser environment so
  // automated tests can sample internal state without relying on unstable
  // instrumentation. These are intentionally small and optional.
  try {
    if (typeof window !== "undefined") {
      window.__ANDEN_TEST__ = window.__ANDEN_TEST__ || {};
      window.__ANDEN_TEST__.getLeadY = function () {
        return (trail[0] || { y: bird.y }).y;
      };
      window.__ANDEN_TEST__.getScore = function () {
        return score;
      };
      window.__ANDEN_TEST__.stepPhysics = function (ms) {
        return updatePhysics((ms || 0) / 1000);
      };
      window.__ANDEN_TEST__.getTrail = function (n) {
        return trail.slice(0, n || 32);
      };
      window.__ANDEN_TEST__.getGraceMs = function () {
        return graceRemainingMs;
      };
      window.__ANDEN_TEST__.forceStop = function () {
        running = false;
        return running;
      };
      window.__ANDEN_TEST__.getLeadAnchorX = function () {
        return PLAYER_X + LEAD_OFFSET_X;
      };
      window.__ANDEN_TEST__.getChimneySpawns = function () {
        return chimneySpawnLog.slice();
      };
      window.__ANDEN_TEST__.getSpawnIntervalMs = function () {
        return SPAWN_INTERVAL_MS;
      };
      window.__ANDEN_TEST__.getGapInfo = function () {
        return { gap: GAP, width: WIDTH, height: HEIGHT };
      };
      window.__ANDEN_TEST__.getLeadState = function () {
        return { y: bird.y, vy: bird.vy };
      };
      window.__ANDEN_TEST__.setLeadState = function (y, vy) {
        if (typeof y !== "number") return;
        const clampedY = Math.max(12, Math.min(HEIGHT - 12, y));
        bird.y = clampedY;
        bird.vy = typeof vy === "number" ? vy : 0;
        trail.length = 0;
        for (let i = 0; i < TRAIL_LENGTH; i++) {
          trail.push({ x: PLAYER_X, y: bird.y });
        }
      };
      window.__ANDEN_TEST__.flapNow = function () {
        flap();
      };
      window.__ANDEN_TEST__.setRunning = function (flag) {
        running = !!flag;
        if (running) {
          lastFrameTs = null;
          requestAnimationFrame(frameLoop);
        }
      };
    }
  } catch (e) {
    // ignore errors in exotic runtimes
  }
})();
