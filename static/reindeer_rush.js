// Reindeer Rush - canvas-based runner with duck, charge, and collectibles
(function () {
  function el(id) {
    return document.getElementById(id);
  }

  const baseJumpVel = -0.55;
  const maxJumpVel = -0.75;
  const jumpChargeWindow = 0;
  const coyoteTimeMs = 120;
  const dashDurationMs = 260;
  const dashCooldownMs = 450;
  const dashSpeedBoost = 2.2;
  const dashInvulnMs = 240;
  let dashForwardNudge = 16;
  const dashReturnDurationMs = 520;
  const snowmanMinGapScreens = 1.0;
  const snowmanGapJitter = [120, 260];
  const snowmanBonus = 120;
  const snowmanSize = { w: 259, h: 216 }; // sprite's native size for clean aspect
  const playerStandingHeight = 36;
  const playerDuckHeight = 24;
  const baseGroundOffset = 40;
  const GROUND_SURFACE_ROW = (window.ReindeerGround && window.ReindeerGround.SURFACE_ROW) || 78;
  const playerHomeX = 80;
  const DEATH_OVERLAY_DELAY = 520;
  const DEATH_SCREEN_DURATION = 1500;
  const RIP_SCREEN_PATH = '/static/rip.png';
  const RUDOLPH_SET = {
    run: [
      '/static/sprites/rudolph/run-1.png',
      '/static/sprites/rudolph/run-2.png',
      '/static/sprites/rudolph/run-3.png',
      '/static/sprites/rudolph/run-4.png',
      '/static/sprites/rudolph/run-5.png',
      '/static/sprites/rudolph/run-6.png'
    ],
    jump: [
      '/static/sprites/rudolph/jump-1.png',
      '/static/sprites/rudolph/jump-2.png',
      '/static/sprites/rudolph/jump-3.png'
    ],
    slide: '/static/sprites/rudolph/slide.png'
  };
  const EXTRA_SPRITES = {
    candy: '/static/sprites/candycane.jpg',
    snowman: '/static/sprites/snowman.png',
    ground: '/static/sprites/ground.png'
  };
  const AUDIO_SOURCES = {
    music: '/static/arcade-kid.mp3',
    jump: '/static/jump.mp3',
    death: '/static/explosion.mp3',
    coin: '/static/coin.mp3'
  };
  const groundCache = { canvas: null };
  const Physics = typeof Matter !== 'undefined' ? Matter : null;

  let canvas, ctx, width = 600, height = 260, dpr = window.devicePixelRatio || 1;
  let canvasHolder = null;
  let running = false;
  let lastTs = 0;
  let distance = 0;
  let bonusScore = 0;
  let platforms = [];
  let platformBodies = [];
  let snowmen = [];
  let snowmanGapPx = 0;
  let groundMaskSegments = [];
  let fpsTracker = { frameCount: 0, totalTime: 0 };
  let lastCollisionTs = null;
  let lastCollisionReason = null;
  let pointerState = { active: false, startX: 0, startY: 0, startTs: 0, swiped: false, pointerId: null };
  let gestureInterpreter = null;
  let doubleJumpAvailable = true;
  let dashTimer = 0;
  let dashCooldown = 0;
  let dashInvulnTimer = 0;
  let dashReturnTimer = 0;
  let coyoteTimer = 0;
  let spaceHeld = false;
  let spaceStart = 0;
  let immersiveStage = null;
  let immersiveHint = null;
  let immersiveActive = false;
  let animationClock = 0;
  let spriteLoadStarted = false;
  const rudolphSprites = { run: [], jump: [], slide: null };
  const extraSprites = { candy: null, snowman: null, ground: null };
  const deathOverlay = { sprite: null, active: false, visible: false, showAt: 0 };
  const snowParticles = [];
  const sparkParticles = [];
  let parallaxPhase = 0;
  let platformBufferEnabled = true;
  let uiElapsed = 0;
  let targetFrameMs = 20; // ~50 FPS cap
  let dashTargetX = playerHomeX;
  let currentPlatform = null;
  let deathTimerMs = 0;
  let pendingStopReason = null;
  let highScoreFlowInFlight = false;
  let platformClusterId = 0;
  const snowmanMetrics = {
    natural: { w: snowmanSize.w, h: snowmanSize.h },
    drawScale: 0.65,
    aspect: snowmanSize.w / snowmanSize.h,
    bottomPadding: 18,
    topPadding: 0,
    hitbox: { minX: 0, maxX: Math.round(snowmanSize.w * 0.88), minY: 0, maxY: snowmanSize.h - 1 }
  };
  let musicStarted = false;
  const audio = { music: null, jump: null, death: null, coin: null };

  const player = {
    x: playerHomeX,
    y: 0,
    w: 48,
    h: playerStandingHeight,
    vy: 0,
    grounded: true,
    ducking: false
  };

  const gameState = {
    running: false,
    distance: 0,
    bonus: 0,
    obstacleCount: 0,
    collectibleCount: 0,
    baseSpeed: 0,
    spawnInterval: 0,
    fps: 0,
    totalScore: 0,
    nextItem: '—',
    lastCollisionAt: null,
    lastCollisionReason: null,
    ravineCount: 0,
    calmWindow: 0
  };

  function canStartNewRun() {
    return !running && !highScoreFlowInFlight && !pendingStopReason && !deathOverlay.active;
  }

  function initCanvas() {
    const holder = el('reindeer-canvas');
    if (!holder) return;
    canvasHolder = holder;
    if (!canvasHolder.hasAttribute('tabindex')) {
      canvasHolder.setAttribute('tabindex', '0');
    }
    canvas = holder.querySelector('canvas');
    if (!canvas) {
      canvas = document.createElement('canvas');
      canvas.style.width = '100%';
      canvas.style.height = '100%';
      canvas.style.touchAction = 'none';
      canvas.style.userSelect = 'none';
      holder.innerHTML = '';
      holder.appendChild(canvas);
    }
    canvas.style.touchAction = 'none';
    canvas.style.userSelect = 'none';
    holder.style.userSelect = 'none';
    ctx = canvas.getContext('2d');
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    holder.style.touchAction = 'none';
    refocusCanvas();
  }

  function refocusCanvas() {
    if (!shouldLockCanvasFocus()) return;
    if (canvasHolder && document.activeElement !== canvasHolder) {
      canvasHolder.focus({ preventScroll: true });
    }
    if (deathOverlay.active && !deathOverlay.visible && performance.now() >= deathOverlay.showAt) {
      deathOverlay.visible = true;
    }
  }

  function shouldLockCanvasFocus() {
    return running && !deathOverlay.active && !highScoreFlowInFlight;
  }

  function resizeCanvas() {
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    width = Math.max(300, Math.floor(rect.width));
    height = Math.max(120, Math.floor(rect.height));
    dashForwardNudge = Math.max(player.w * 1.2, Math.min(width * 0.2, 100));
    dpr = window.devicePixelRatio || 1;
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function clamp(value, min, max) {
    if (Number.isNaN(value)) return min;
    return Math.min(max, Math.max(min, value));
  }

  function preloadRudolphSprites() {
    if (spriteLoadStarted || typeof Image === 'undefined') return;
    spriteLoadStarted = true;
    RUDOLPH_SET.run.forEach((src, idx) => {
      rudolphSprites.run[idx] = primeSprite(src);
    });
    RUDOLPH_SET.jump.forEach((src, idx) => {
      rudolphSprites.jump[idx] = primeSprite(src);
    });
    rudolphSprites.slide = primeSprite(RUDOLPH_SET.slide);
    extraSprites.candy = primeSprite(EXTRA_SPRITES.candy);
    extraSprites.snowman = primeSprite(EXTRA_SPRITES.snowman);
    if (extraSprites.snowman) {
      extraSprites.snowman.onload = () => computeSnowmanMetrics(extraSprites.snowman);
      if (extraSprites.snowman.complete) {
        computeSnowmanMetrics(extraSprites.snowman);
      }
    }
    extraSprites.ground = primeSprite(EXTRA_SPRITES.ground);
    deathOverlay.sprite = deathOverlay.sprite || primeSprite(RIP_SCREEN_PATH);
    if (extraSprites.ground) {
      extraSprites.ground.onload = () => {
        buildGroundMaskFromSprite();
      };
      if (extraSprites.ground.complete) {
        buildGroundMaskFromSprite();
      }
    }
  }

  function primeSprite(src) {
    const img = new Image();
    img.decoding = 'async';
    img.src = src;
    return img;
  }

  function spriteReady(img) {
    return Boolean(img && img.complete && img.naturalWidth > 0 && img.naturalHeight > 0);
  }

  function computeSnowmanMetrics(img) {
    try {
      if (typeof document === 'undefined') return;
      const w = img.naturalWidth || snowmanSize.w;
      const h = img.naturalHeight || snowmanSize.h;
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('canvas context unavailable');
      ctx.drawImage(img, 0, 0);
      const data = ctx.getImageData(0, 0, w, h).data;
      const cols = new Array(w).fill(0);
      const rows = new Array(h).fill(0);
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const alpha = data[(y * w + x) * 4 + 3];
          cols[x] += alpha;
          rows[y] += alpha;
        }
      }
      const xs = cols.map((v, i) => (v > 0 ? i : null)).filter((v) => v !== null);
      const ys = rows.map((v, i) => (v > 0 ? i : null)).filter((v) => v !== null);
      const minX = xs.length ? Math.min(...xs) : 0;
      const maxX = xs.length ? Math.max(...xs) : w - 1;
      const minY = ys.length ? Math.min(...ys) : 0;
      const maxY = ys.length ? Math.max(...ys) : h - 1;
      const totalAlpha = cols.reduce((sum, v) => sum + v, 0) || 1;
      const cutoffTarget = totalAlpha * 0.88;
      let running = 0;
      let cutoffX = maxX;
      for (let i = 0; i < cols.length; i++) {
        running += cols[i];
        if (running >= cutoffTarget) {
          cutoffX = i;
          break;
        }
      }
      const trimmedMaxX = Math.min(maxX, cutoffX);
      const hitboxMaxX =
        trimmedMaxX - minX < (maxX - minX) * 0.65
          ? maxX
          : trimmedMaxX;
      snowmanMetrics.natural = { w, h };
      snowmanMetrics.aspect = w / h;
      snowmanMetrics.bottomPadding = Math.max(0, h - (maxY + 1));
      snowmanMetrics.topPadding = Math.max(0, minY);
      snowmanMetrics.hitbox = { minX, maxX: hitboxMaxX, minY, maxY };
    } catch (err) {
      console.warn('Unable to compute snowman metrics', err);
    }
  }

  function createAudio(src, options = {}) {
    if (typeof Audio === 'undefined') return null;
    const el = new Audio(src);
    el.preload = 'auto';
    el.loop = Boolean(options.loop);
    if (typeof options.volume === 'number') {
      el.volume = options.volume;
    }
    return el;
  }

  function ensureSound(key) {
    if (audio[key]) return audio[key];
    const opts = key === 'music' ? { loop: true, volume: 0.45 } : { volume: 0.7 };
    audio[key] = createAudio(AUDIO_SOURCES[key], opts);
    return audio[key];
  }

  function playSound(key) {
    const sound = ensureSound(key);
    if (!sound) return;
    try {
      sound.currentTime = 0;
      const res = sound.play();
      if (res && typeof res.catch === 'function') {
        res.catch(() => {});
      }
    } catch (err) {
      console.warn('Audio playback blocked', err);
    }
  }

  function ensureMusicPlaying() {
    const music = ensureSound('music');
    if (!music) return;
    music.loop = true;
    if (musicStarted && music.play && music.paused === false) return;
    musicStarted = true;
    try {
      const res = music.play();
      if (res && typeof res.catch === 'function') {
        res.catch(() => {});
      }
    } catch (err) {
      console.warn('Music playback blocked', err);
    }
  }

  function resetGame() {
    distance = 0;
    bonusScore = 0;
    player.h = playerStandingHeight;
    player.ducking = false;
    player.x = playerHomeX;
    player.y = height - baseGroundOffset - player.h;
    player.vy = 0;
    player.grounded = true;
    dashReturnTimer = 0;
    platformBufferEnabled = true;
    currentPlatform = null;
    platforms = [];
    platformBodies = [];
    snowmen = [];
    snowmanGapPx = calcSnowmanGap(width);
    snowParticles.length = 0;
    sparkParticles.length = 0;
    deathTimerMs = 0;
    deathOverlay.active = false;
    deathOverlay.visible = false;
    deathOverlay.showAt = 0;
    pendingStopReason = null;
    highScoreFlowInFlight = false;
    seedPlatforms();
    placePlayerOnSafePlatform();
    lastTs = 0;
    fpsTracker.frameCount = 0;
    fpsTracker.totalTime = 0;
    lastCollisionTs = null;
    lastCollisionReason = null;
    doubleJumpAvailable = true;
    dashTimer = 0;
    dashCooldown = 0;
    dashInvulnTimer = 0;
    coyoteTimer = 0;
    dashReturnTimer = 0;
    if (gestureInterpreter) {
      gestureInterpreter.setGrounded(true);
    }
    gameState.running = false;
    gameState.distance = 0;
    gameState.bonus = 0;
    gameState.totalScore = 0;
    gameState.obstacleCount = 0;
    gameState.collectibleCount = 0;
    gameState.baseSpeed = 0;
    gameState.spawnInterval = 0;
    gameState.fps = 0;
    gameState.nextItem = '—';
    gameState.lastCollisionAt = null;
    gameState.lastCollisionReason = null;
    gameState.ravineCount = 0;
    gameState.calmWindow = 0;
    animationClock = 0;
    platformClusterId = 0;
  }

  function startGame() {
    if (!canStartNewRun()) return;
    initCanvas();
    resetGame();
    ensureMusicPlaying();
    running = true;
    gameState.running = true;
    refocusCanvas();
    requestAnimationFrame(loop);
  }

  async function stopGame(reason = 'collision-with-obstacle', options = {}) {
    if (!running) return;
    const { delayHighScoreMs = 0 } = options;
    running = false;
    lastCollisionTs = Date.now();
    lastCollisionReason = reason;
    gameState.running = false;
    gameState.lastCollisionAt = lastCollisionTs;
    gameState.lastCollisionReason = lastCollisionReason;
    spaceHeld = false;
    pointerState.active = false;
    refocusCanvas();

    const totalScore = Math.floor(gameState.distance + gameState.bonus);
    const shouldSubmitScore = reason !== 'exited-immersive';
    if (delayHighScoreMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, delayHighScoreMs));
    }
    if (shouldSubmitScore && window.arcadeOverlay && window.arcadeOverlay.handleHighScoreFlow) {
      try {
        highScoreFlowInFlight = true;
        await window.arcadeOverlay.handleHighScoreFlow({
          gameId: 'tredje-advent',
          score: totalScore,
          allowSkip: true,
          title: 'Reindeer Rush',
          message: `Du fløj ${Math.floor(gameState.distance)}m og fik ${gameState.bonus} bonus.`,
        });
      } catch (e) {
        console.error('Arcade high score flow failed', e);
      } finally {
        highScoreFlowInFlight = false;
      }
    } else if (shouldSubmitScore) {
      console.warn('Arcade overlay not available; high score entry skipped.');
    }
  }
  
  function handlePlayerDeath(reason = 'collision-with-obstacle') {
    deathTimerMs = Math.max(deathTimerMs, DEATH_SCREEN_DURATION);
    deathOverlay.active = true;
    deathOverlay.visible = false;
    deathOverlay.showAt = performance.now() + DEATH_OVERLAY_DELAY;
    pendingStopReason = reason;
    playSound('death');
    spawnSparkBurst(player.x + player.w * 0.5, player.y + player.h * 0.5, 42);
    stopGame(reason, { delayHighScoreMs: DEATH_SCREEN_DURATION }).finally(() => {
      pendingStopReason = null;
      deathOverlay.active = false;
      deathOverlay.visible = false;
    });
    requestAnimationFrame(loop);
  }

  function ensureGameRunning() {
    if (!running) {
      startGame();
    }
  }

  function getRandomInterval(min, max) {
    return min + Math.random() * (max - min);
  }

  function buildGroundMaskFromSprite() {
    if (!window.ReindeerGround || !spriteReady(extraSprites.ground)) return;
    const built = window.ReindeerGround.buildSegmentsFromImage(extraSprites.ground, GROUND_SURFACE_ROW);
    if (built && built.length) {
      groundMaskSegments = built;
    }
  }

  function getGroundBaseWidth() {
    if (spriteReady(extraSprites.ground)) return extraSprites.ground.naturalWidth;
    return 320;
  }

  function getGroundBaseHeight() {
    if (spriteReady(extraSprites.ground)) return extraSprites.ground.naturalHeight;
    return 140;
  }

  function createPlatformInstance(x, surfaceY, scale = 1) {
    const baseWidth = getGroundBaseWidth();
    const baseSegments = groundMaskSegments.length ? groundMaskSegments : [[0, baseWidth - 1]];
    const spans = window.ReindeerGround
      ? window.ReindeerGround.scaleSegments(baseSegments, scale, x)
      : [[x, x + baseWidth * scale]];
    return {
      x,
      surfaceY,
      width: baseWidth * scale,
      scale,
      spans
    };
  }

  function createPlatformBody(plat) {
    if (!Physics) return null;
    const thickness = Math.max(36, 52 * plat.scale);
    const body = Physics.Bodies.rectangle(
      plat.x + plat.width / 2,
      plat.surfaceY + thickness / 2,
      plat.width,
      thickness,
      { isStatic: true, label: 'platform' }
    );
    body._platform = plat;
    return body;
  }

  function rebuildPlatformBodies() {
    if (!Physics) return;
    platformBodies.length = 0;
    for (let i = 0; i < platforms.length; i++) {
      const body = createPlatformBody(platforms[i]);
      if (body) platformBodies.push(body);
    }
  }

  function calcSnowmanGap(screenW) {
    const jitter = getRandomInterval(snowmanGapJitter[0], snowmanGapJitter[1]);
    return Math.max(screenW * snowmanMinGapScreens, screenW) + jitter;
  }

  function spawnSnowmanAt(x) {
    const drawW = snowmanMetrics.natural.w * snowmanMetrics.drawScale;
    const drawH = snowmanMetrics.natural.h * snowmanMetrics.drawScale;
    const surface = platformSurfaceAt(x + drawW * 0.5);
    if (!surface) return null;
    const y = surface.y - drawH + snowmanMetrics.bottomPadding * snowmanMetrics.drawScale;
    const hitbox = {
      x: snowmanMetrics.hitbox.minX * snowmanMetrics.drawScale,
      y: snowmanMetrics.hitbox.minY * snowmanMetrics.drawScale,
      w: (snowmanMetrics.hitbox.maxX - snowmanMetrics.hitbox.minX + 1) * snowmanMetrics.drawScale,
      h: (snowmanMetrics.hitbox.maxY - snowmanMetrics.hitbox.minY + 1) * snowmanMetrics.drawScale
    };
    const snowman = {
      x,
      y,
      w: drawW,
      h: drawH,
      hitbox,
      alive: true
    };
    snowmen.push(snowman);
    return snowman;
  }

  function trySpawnSnowman() {
    if (snowmanGapPx > 0) return null;
    const spawnX = width + getRandomInterval(40, 120);
    const placed = spawnSnowmanAt(spawnX);
    if (placed) {
      snowmanGapPx = calcSnowmanGap(width);
    }
    return placed;
  }

  function moveSnowmen(dt, speedPxPerMs) {
    for (let i = snowmen.length - 1; i >= 0; i--) {
      const s = snowmen[i];
      s.x -= speedPxPerMs * dt;
      if (s.x + s.w < -160 || !s.alive) {
        snowmen.splice(i, 1);
      }
    }
    snowmanGapPx -= speedPxPerMs * dt;
    if (snowmanGapPx < 0) snowmanGapPx = 0;
  }

  function seedPlatforms() {
    const baseline = Math.round(height * 0.68);
    platforms.length = 0;
    snowmen.length = 0;
    snowmanGapPx = calcSnowmanGap(width);
    platformBufferEnabled = true;
    // Anchor platform covering the spawn position to avoid immediate falls.
    const anchorCluster = ++platformClusterId;
    const anchor = createPlatformInstance(playerHomeX - getGroundBaseWidth() * 0.15, baseline, 0.9);
    anchor.clusterId = anchorCluster;
    platforms.push(anchor);
    const firstClusterStart = anchor.x + anchor.width - 12;
    spawnIslandCluster(firstClusterStart, baseline, anchorCluster);
    ensurePlatformBuffer();
    rebuildPlatformBodies();
  }

  function placePlayerOnSafePlatform() {
    const footX = playerHomeX + player.w * 0.5;
    let plat = platforms.find((p) => footX >= p.x && footX <= p.x + p.width);
    if (!plat && platforms.length) {
      plat = platforms[0];
    }
    if (plat) {
      player.x = Math.max(playerHomeX, plat.x + Math.min(plat.width * 0.25, 40));
      player.y = plat.surfaceY - player.h;
      player.vy = 0;
      player.grounded = true;
      currentPlatform = plat;
      if (gestureInterpreter) gestureInterpreter.setGrounded(true);
    }
  }

  function ensurePlatformBuffer() {
    if (!platformBufferEnabled) return;
    const baseWidth = getGroundBaseWidth();
    const needs = () => {
      if (!platforms.length) return true;
      const last = platforms[platforms.length - 1];
      return last.x + last.width < width + baseWidth * 1.5;
    };
    while (needs()) {
      const last = platforms[platforms.length - 1];
      const start = last ? last.x + last.width + getRandomInterval(240, 520) : width;
      const baseY = last ? clamp(last.surfaceY + getRandomInterval(-80, 80), 120, height - 60) : Math.round(height * 0.68);
      spawnIslandCluster(start, baseY);
    }
  }

  function movePlatforms(dt, speedPxPerMs) {
    for (let i = platforms.length - 1; i >= 0; i--) {
      const plat = platforms[i];
      plat.x -= speedPxPerMs * dt;
      plat.spans = plat.spans.map(([s, e]) => [s - speedPxPerMs * dt, e - speedPxPerMs * dt]);
      if (plat.x + plat.width < -160) {
        platforms.splice(i, 1);
      }
    }
    ensurePlatformBuffer();
  }

  function platformSurfaceAt(x) {
    for (let i = platforms.length - 1; i >= 0; i--) {
      const plat = platforms[i];
      const y = window.ReindeerGround
        ? window.ReindeerGround.surfaceYAt(plat.spans, plat.surfaceY, x)
        : x >= plat.x && x <= plat.x + plat.width
          ? plat.surfaceY
          : null;
      if (y !== null) {
        return { y, platform: plat };
      }
    }
    return null;
  }

  function spawnIslandCluster(startX, baseSurfaceY, clusterIdOverride = null) {
    const minY = 120;
    const maxY = height - 60;
    const pieces = Math.floor(getRandomInterval(1, 6));
    const clusterId = clusterIdOverride || ++platformClusterId;
    let cursor = startX;
    let surface = clamp(baseSurfaceY, minY, maxY);
    for (let i = 0; i < pieces; i++) {
      const scale = 0.75 + Math.random() * 0.3;
      const y = clamp(surface + getRandomInterval(-12, 12), minY, maxY);
      const plat = createPlatformInstance(cursor, y, scale);
      plat.clusterId = clusterId;
      platforms.push(plat);
      const connector = getRandomInterval(-14, 0);
      cursor += plat.width + connector;
      surface = y;
    }
  }

  function snapPlayerToGround() {
    const footX = player.x + player.w * 0.5;
    const surface = platformSurfaceAt(footX);
    if (surface !== null) {
      player.y = surface - player.h;
    } else {
      player.y = height - baseGroundOffset - player.h;
    }
  }

  function syncGameState(dt, baseSpeed) {
    fpsTracker.frameCount += 1;
    fpsTracker.totalTime += dt;
    gameState.running = running;
    gameState.distance = Math.floor(distance);
    gameState.bonus = bonusScore;
    gameState.totalScore = gameState.distance + gameState.bonus;
    gameState.obstacleCount = platforms.length + snowmen.length;
    gameState.collectibleCount = 0;
    gameState.ravineCount = 0;
    gameState.baseSpeed = Math.round(baseSpeed);
    gameState.spawnInterval = 0;
    gameState.fps = fpsTracker.totalTime
      ? Math.round((fpsTracker.frameCount * 1000) / fpsTracker.totalTime)
      : 0;
    gameState.nextItem = '—';
    gameState.lastCollisionAt = lastCollisionTs;
    gameState.lastCollisionReason = lastCollisionReason;
    gameState.calmWindow = 0;
    if (canvasHolder) {
      canvasHolder.dataset.obstacles = `${platforms.length + snowmen.length}`;
      canvasHolder.dataset.collectibles = `0`;
    }
  }

  function rectsOverlap(x1, y1, w1, h1, x2, y2, w2, h2) {
    return !(x1 + w1 < x2 || x1 > x2 + w2 || y1 + h1 < y2 || y1 > y2 + h2);
  }

  function spawnSnowBurst(cx, cy, count = 12) {
    for (let i = 0; i < count; i++) {
      snowParticles.push({
        x: cx,
        y: cy,
        vx: (Math.random() - 0.5) * 0.48,
        vy: -0.24 - Math.random() * 0.16,
        life: 640 + Math.random() * 320,
        radius: 3 + Math.random() * 3
      });
    }
  }

  function updateSnowParticles(dt, speedPxPerMs) {
    for (let i = snowParticles.length - 1; i >= 0; i--) {
      const p = snowParticles[i];
      p.life -= dt;
      if (p.life <= 0) {
        snowParticles.splice(i, 1);
        continue;
      }
      p.x -= speedPxPerMs * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 0.00065 * dt;
    }
  }

  function spawnSparkBurst(cx, cy, count = 22) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 0.18 + Math.random() * 0.32;
      sparkParticles.push({
        x: cx,
        y: cy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 0.08,
        life: 520 + Math.random() * 320,
        radius: 2 + Math.random() * 2.2
      });
    }
  }

  function updateSparkParticles(dt, speedPxPerMs) {
    for (let i = sparkParticles.length - 1; i >= 0; i--) {
      const p = sparkParticles[i];
      p.life -= dt;
      if (p.life <= 0) {
        sparkParticles.splice(i, 1);
        continue;
      }
      p.x -= speedPxPerMs * dt * 0.6;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 0.0004 * dt;
    }
  }

  function performJump() {
    if (player.ducking) {
      endDuck();
    }
    const jumpVel = maxJumpVel;
    player.vy = jumpVel;
    player.grounded = false;
    coyoteTimer = 0;
    playSound('jump');
    if (gestureInterpreter) {
      gestureInterpreter.setGrounded(false);
    }
  }

  function triggerGroundJump(heldMs = 0) {
    ensureGameRunning();
    doubleJumpAvailable = true;
    performJump();
  }

  function triggerDoubleJump(heldMs = 0) {
    ensureGameRunning();
    if (!doubleJumpAvailable || player.grounded) return;
    doubleJumpAvailable = false;
    performJump();
  }

  function triggerJumpAction(heldMs = 0) {
    if (player.grounded || coyoteTimer > 0) {
      triggerGroundJump(heldMs);
    } else {
      triggerDoubleJump(heldMs);
    }
  }

  function triggerDash() {
    ensureGameRunning();
    if (dashCooldown > 0) return;
    dashTimer = dashDurationMs;
    dashInvulnTimer = dashInvulnMs;
    dashCooldown = dashCooldownMs;
    dashReturnTimer = dashReturnDurationMs;
    dashTargetX = clamp(playerHomeX + dashForwardNudge, playerHomeX, width - 60);
    if (player.ducking) {
      endDuck();
    }
  }

  function beginDuck() {
    ensureGameRunning();
    if (player.ducking || !player.grounded) return;
    player.ducking = true;
    const bottom = player.y + player.h;
    player.h = playerDuckHeight;
    player.y = bottom - player.h;
  }

  function endDuck() {
    if (!player.ducking) return;
    const bottom = player.y + player.h;
    player.h = playerStandingHeight;
    player.y = bottom - player.h;
    player.ducking = false;
  }

  function handlePointerDown(event) {
    if (pointerState.active && pointerState.pointerId !== null && event.pointerId !== pointerState.pointerId) return;
    ensureGameRunning();
    pointerState.active = true;
    pointerState.pointerId = event.pointerId;
    pointerState.startY = event.clientY;
    pointerState.startX = event.clientX;
    pointerState.startTs = performance.now();
    pointerState.swiped = false;
    if (gestureInterpreter) {
      gestureInterpreter.pointerDown(event);
    } else if (event.preventDefault) {
      event.preventDefault();
    }
  }

  function handlePointerMove(event) {
    if (!pointerState.active || event.pointerId !== pointerState.pointerId) return;
    if (gestureInterpreter) {
      gestureInterpreter.pointerMove(event);
      const gs = gestureInterpreter.getState ? gestureInterpreter.getState() : null;
      if (gs && gs.swipeType) {
        pointerState.swiped = true;
      }
    }
  }

  function handlePointerEnd(event) {
    if (!pointerState.active) return;
    if (event && event.cancelable) {
      event.preventDefault();
    }
    if (gestureInterpreter) {
      gestureInterpreter.pointerUp(event);
    } else {
      triggerJumpAction(0);
    }
    pointerState.active = false;
    pointerState.pointerId = null;
    pointerState.swiped = false;
  }

  function handlePointerCancel() {
    if (gestureInterpreter) {
      gestureInterpreter.pointerCancel();
    }
    pointerState.active = false;
    pointerState.pointerId = null;
    pointerState.swiped = false;
  }

  function handleKeyDown(ev) {
    refocusCanvas();
    if (ev.code === 'Space') {
      ev.preventDefault();
      ensureGameRunning();
      triggerJumpAction(0);
      return;
    }
    if (ev.code === 'ArrowRight') {
      ev.preventDefault();
      ensureGameRunning();
      triggerDash();
      return;
    }
    if (ev.code === 'ArrowDown') {
      ev.preventDefault();
      beginDuck();
    }
  }

  function handleKeyUp(ev) {
    if (ev.code === 'Space') {
      ev.preventDefault();
      return;
    }
    if (ev.code === 'ArrowDown') {
      endDuck();
    }
  }

  function setupInput() {
    const holder = el('reindeer-canvas');
    if (!holder) return;
    if (window.ReindeerRushGestures && window.ReindeerRushGestures.createGestureInterpreter) {
      gestureInterpreter = window.ReindeerRushGestures.createGestureInterpreter({
        onJump: (heldMs) => triggerGroundJump(heldMs),
        onDoubleJump: (heldMs) => triggerDoubleJump(heldMs),
        onDash: () => triggerDash(),
        onDuckStart: () => beginDuck(),
        onDuckEnd: () => endDuck(),
        now: () => performance.now()
      });
      gestureInterpreter.setGrounded(true);
    }
    holder.addEventListener('pointerdown', handlePointerDown, { passive: false });
    holder.addEventListener('pointermove', handlePointerMove, { passive: false });
    holder.addEventListener('pointerup', handlePointerEnd, { passive: false });
    holder.addEventListener('pointercancel', handlePointerCancel);
    holder.addEventListener('pointerleave', handlePointerCancel);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    holder.addEventListener('blur', () => refocusCanvas());
    holder.addEventListener('click', () => refocusCanvas());
  }

  function updateScene(dt) {
    if (!running && deathTimerMs <= 0 && !pendingStopReason) {
      return;
    }
    if (running) {
      distance += dt * 0.02;
    }
    animationClock += dt;
    parallaxPhase += dt * 0.0012;
    dashTimer = Math.max(0, dashTimer - dt);
    dashCooldown = Math.max(0, dashCooldown - dt);
    dashInvulnTimer = Math.max(0, dashInvulnTimer - dt);
    dashReturnTimer = Math.max(0, dashReturnTimer - dt);
    if (deathTimerMs > 0) {
      deathTimerMs = Math.max(0, deathTimerMs - dt);
    } else {
      deathOverlay.active = false;
    }
    const baseSpeed = running ? 440 + Math.min(620, distance * 0.15) : 0;
    const dashActive = running && dashTimer > 0;
    const travelSpeed = baseSpeed * (dashActive ? dashSpeedBoost : 1);
    const speedPxPerMs = travelSpeed / 1000;

    if (running) {
      movePlatforms(dt, speedPxPerMs);
      rebuildPlatformBodies();
      moveSnowmen(dt, speedPxPerMs);
      trySpawnSnowman();
    } else if (pendingStopReason) {
      // Keep scene static while showing death overlay
      moveSnowmen(0, 0);
    }
    updateSnowParticles(dt, speedPxPerMs);
    updateSparkParticles(dt, speedPxPerMs);
    uiElapsed += dt;

    const gravity = 0.0018;
    const wasGrounded = player.grounded;
    const prevY = player.y;
    const prevVy = player.vy;
    const footX = player.x + player.w * 0.55;
    const surface = platformSurfaceAt(footX);
    const prevFoot = prevY + player.h;
    const nextVy = prevVy + gravity * dt;
    const nextY = prevY + nextVy * dt;

    let landingPlatform = null;
    if (Physics && platformBodies.length) {
      const predictedBody = Physics.Bodies.rectangle(
        player.x + player.w / 2,
        nextY + player.h / 2,
        player.w,
        player.h,
        { isStatic: true }
      );
      const hits = Physics.Query.collides(predictedBody, platformBodies) || [];
      if (hits.length && nextVy >= 0) {
        const nextFoot = nextY + player.h;
        const candidates = hits
          .map((hit) => (hit.bodyA === predictedBody ? hit.bodyB : hit.bodyA))
          .filter(Boolean)
          .map((body) => ({ top: body.bounds.min.y, platform: body._platform }))
          .filter((hit) => prevFoot <= hit.top + 6 && nextFoot >= hit.top - 2);
        if (candidates.length) {
          landingPlatform = candidates.reduce((best, hit) => (!best || hit.top < best.top ? hit : best), null);
        }
      }
    }

    if (landingPlatform) {
      player.y = landingPlatform.top - player.h;
      player.vy = 0;
      player.grounded = true;
      currentPlatform = landingPlatform.platform || currentPlatform;
      doubleJumpAvailable = true;
      coyoteTimer = coyoteTimeMs;
      if (!wasGrounded && gestureInterpreter) gestureInterpreter.setGrounded(true);
    } else if (surface) {
      const surfY = surface.y;
      const nextFoot = nextY + player.h;
      // Coming down onto the platform
      if (nextVy >= 0 && prevFoot <= surfY && nextFoot >= surfY) {
        player.y = surfY - player.h;
        player.vy = 0;
        player.grounded = true;
        currentPlatform = surface.platform;
        doubleJumpAvailable = true;
        coyoteTimer = coyoteTimeMs;
        if (!wasGrounded && gestureInterpreter) gestureInterpreter.setGrounded(true);
      } else if (wasGrounded && Math.abs(surfY - prevFoot) <= 20) {
        // Maintain contact while running on platform
        player.y = surfY - player.h;
        player.vy = 0;
        player.grounded = true;
        currentPlatform = surface.platform;
        doubleJumpAvailable = true;
        coyoteTimer = coyoteTimeMs;
      } else {
        // Not colliding this frame; continue motion.
        player.y = nextY;
        player.vy = nextVy;
        player.grounded = false;
        coyoteTimer = Math.max(0, coyoteTimer - dt);
        if (wasGrounded && gestureInterpreter) gestureInterpreter.setGrounded(false);
      }
    } else {
      player.y = nextY;
      player.vy = nextVy;
      if (player.grounded && gestureInterpreter) gestureInterpreter.setGrounded(false);
      player.grounded = false;
      coyoteTimer = Math.max(0, coyoteTimer - dt);
    }

    if (running) {
      for (let i = snowmen.length - 1; i >= 0; i--) {
        const s = snowmen[i];
        if (!s || !s.alive) continue;
        const hb = s.hitbox || { x: 0, y: 0, w: s.w, h: s.h };
        const hx = s.x + hb.x;
        const hy = s.y + hb.y;
        if (rectsOverlap(player.x, player.y, player.w, player.h, hx, hy, hb.w, hb.h)) {
          const smashing = dashActive || dashInvulnTimer > 0;
          if (smashing) {
            snowmen.splice(i, 1);
            spawnSnowBurst(s.x + s.w * 0.5, s.y + s.h * 0.5, 42);
            bonusScore += snowmanBonus;
            playSound('coin');
            continue;
          }
          handlePlayerDeath('hit-snowman');
          return;
        }
      }
    }

    if (running && player.y > height + 200) {
      handlePlayerDeath('fell-off-island');
      return;
    }

    // Horizontal easing during and after dash to create a lunge then settle.
    const dashEase = (t) => 1 - Math.pow(1 - t, 2);
    if (dashTimer > 0) {
      const t = 1 - dashTimer / dashDurationMs;
      player.x = clamp(playerHomeX + dashEase(t) * dashForwardNudge, playerHomeX, width - 60);
    } else if (dashReturnTimer > 0) {
      const t = 1 - dashReturnTimer / dashReturnDurationMs;
      player.x = clamp(dashTargetX - dashEase(t) * (dashTargetX - playerHomeX), playerHomeX, width - 60);
    } else {
      player.x = playerHomeX;
    }

    syncGameState(dt, travelSpeed);
    drawScene();
    if (uiElapsed >= 120) {
      updateUI();
      uiElapsed = 0;
    }
    if (running) {
      requestAnimationFrame(loop);
    }
  }

  function loop(ts) {
    if (!running && deathTimerMs <= 0 && !pendingStopReason) return;
    if (!lastTs) lastTs = ts;
    const dt = ts - lastTs;
    if (dt >= targetFrameMs * 0.6) {
      lastTs = ts;
      updateScene(dt);
    } else {
      requestAnimationFrame(loop);
      return;
    }
    if (running || deathTimerMs > 0 || pendingStopReason) {
      requestAnimationFrame(loop);
    }
  }

  function drawScene() {
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, width, height);

    const sky = ctx.createLinearGradient(0, 0, 0, height);
    sky.addColorStop(0, '#0f172a');
    sky.addColorStop(0.6, '#1d4ed8');
    sky.addColorStop(1, '#0f172a');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, width, height);

    drawParallaxRidges();
    drawPlatformsLayer();
    drawSnowmen();

    if (sparkParticles.length) {
      ctx.fillStyle = 'rgba(251,191,36,0.9)';
      for (const p of sparkParticles) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    if (snowParticles.length) {
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      for (const p of snowParticles) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    drawReindeerCharacter();

    ctx.fillStyle = 'rgba(248, 250, 252, 0.9)';
    ctx.font = '13px "Press Start 2P", system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial';
    ctx.fillText(`${Math.floor(distance)} m`, 12, 20);

    if (!running && deathOverlay.active && deathOverlay.visible) {
      drawDeathOverlay();
    }
  }

  function drawPlatformsLayer() {
    const sprite = extraSprites.ground;
    const ready = spriteReady(sprite) || Boolean(groundCache.canvas);
    for (const plat of platforms) {
      const drawW = ready ? getGroundBaseWidth() * plat.scale : plat.width;
      const drawH = ready ? getGroundBaseHeight() * plat.scale : Math.max(64, 90 * plat.scale);
      const drawX = plat.x;
      const drawY = ready ? plat.surfaceY - GROUND_SURFACE_ROW * plat.scale : plat.surfaceY - drawH * 0.35;
      if (ready) {
        ctx.drawImage(sprite, Math.round(drawX), Math.round(drawY), Math.round(drawW), Math.round(drawH));
      } else {
        ctx.fillStyle = '#475569';
        ctx.fillRect(Math.round(drawX), Math.round(drawY), Math.round(drawW), Math.round(drawH));
      }
    }
  }

  function drawSnowmen() {
    if (!ctx) return;
    const sprite = extraSprites.snowman;
    const ready = spriteReady(sprite);
    for (const s of snowmen) {
      if (!s.alive) continue;
      const drawW = ready ? s.w * 1 : s.w;
      const drawH = ready ? s.h * 1 : s.h;
      const x = Math.round(s.x);
      const y = Math.round(s.y);
      if (ready) {
        ctx.drawImage(sprite, x, y, drawW, drawH);
      } else {
        ctx.fillStyle = '#e0f2fe';
        ctx.fillRect(x, y, drawW, drawH);
      }
    }
  }

  function drawReindeerCharacter() {
    const sprite = selectRudolphFrame();
    if (dashTimer > 0) {
      const trailLen = Math.max(20, dashForwardNudge * 0.6);
      const alpha = 0.18 + 0.3 * (dashTimer / dashDurationMs);
      ctx.fillStyle = `rgba(255,0,0,${alpha.toFixed(3)})`;
      ctx.fillRect(player.x - trailLen * 0.8, player.y + player.h * 0.2, trailLen, player.h * 0.6);
    }
    if (sprite && spriteReady(sprite)) {
      const aspect = sprite.naturalWidth / sprite.naturalHeight || 1;
      const poseBase = player.ducking && player.grounded ? playerDuckHeight + 12 : playerStandingHeight + 18;
      const spriteHeight = poseBase * 1.35;
      const spriteWidth = spriteHeight * aspect;
      const drawX = player.x + player.w / 2 - spriteWidth / 2;
      const groundLine = player.y + player.h;
      const drawY = groundLine - spriteHeight + (player.grounded ? 0 : 4);
      ctx.drawImage(sprite, Math.round(drawX), Math.round(drawY), Math.round(spriteWidth), Math.round(spriteHeight));
      return;
    }
    ctx.fillStyle = '#fef3c7';
    ctx.fillRect(Math.round(player.x), Math.round(player.y), player.w, player.h);
  }

  function drawDeathOverlay() {
    ctx.save();
    ctx.fillStyle = 'rgba(15, 23, 42, 0.75)';
    ctx.fillRect(0, 0, width, height);
    const sprite = deathOverlay.sprite;
    if (spriteReady(sprite)) {
      const aspect = sprite.naturalWidth / sprite.naturalHeight || 1;
      let drawW = width * 0.68;
      let drawH = drawW / aspect;
      if (drawH > height * 0.72) {
        drawH = height * 0.72;
        drawW = drawH * aspect;
      }
      const x = (width - drawW) / 2;
      const y = (height - drawH) / 2;
      ctx.drawImage(sprite, Math.round(x), Math.round(y), Math.round(drawW), Math.round(drawH));
    } else {
      ctx.fillStyle = '#f8fafc';
      ctx.font = '18px \"Press Start 2P\", system-ui, sans-serif';
      ctx.fillText('Rudolph faldt!', Math.round(width * 0.22), Math.round(height * 0.5));
    }
    ctx.restore();
  }

  function selectRudolphFrame() {
    if (player.ducking && player.grounded) {
      return spriteReady(rudolphSprites.slide) ? rudolphSprites.slide : null;
    }
    if (!player.grounded) {
      const jumpFrames = rudolphSprites.jump;
      if (jumpFrames.length) {
        let idx = 1;
        if (player.vy < -0.2) {
          idx = 0;
        } else if (player.vy > 0.2) {
          idx = Math.min(jumpFrames.length - 1, 2);
        }
        const frame = jumpFrames[idx] || jumpFrames[jumpFrames.length - 1];
        if (spriteReady(frame)) {
          return frame;
        }
      }
    }
    const runFrames = rudolphSprites.run;
    if (runFrames.length) {
      const idx = Math.floor((animationClock / 90) % runFrames.length);
      const primary = runFrames[idx];
      if (spriteReady(primary)) {
        return primary;
      }
      for (const frame of runFrames) {
        if (spriteReady(frame)) {
          return frame;
        }
      }
    }
    return null;
  }

  function drawParallaxRidges() {
    if (!ctx) return;
    const surfaceMin = platforms.length ? Math.min(...platforms.map((p) => p.surfaceY)) : height * 0.65;
    const baseY = clamp(surfaceMin + 60, 80, height - 40);
    const layers = [
      { color: 'rgba(59, 7, 100, 0.45)', amp: 18, height: baseY - 90, scale: 0.006 },
      { color: 'rgba(79, 70, 229, 0.35)', amp: 26, height: baseY - 40, scale: 0.01 }
    ];
    layers.forEach((layer, idx) => {
      ctx.fillStyle = layer.color;
      ctx.beginPath();
      ctx.moveTo(0, height);
      for (let x = 0; x <= width; x += 24) {
        const wave = Math.sin(parallaxPhase * (idx + 1) + x * layer.scale) * layer.amp;
        ctx.lineTo(x, layer.height + wave);
      }
      ctx.lineTo(width, height);
      ctx.closePath();
      ctx.fill();
    });
  }

  function updateUI() {
    const scoreEl = el('reindeer-score');
    if (scoreEl) {
      scoreEl.textContent = `${gameState.distance} m`;
    }
    const bonusEl = el('reindeer-bonus');
    if (bonusEl) {
      bonusEl.textContent = `${gameState.bonus} pts`;
    }
    const totalScoreEl = el('reindeer-total-score');
    if (totalScoreEl) {
      totalScoreEl.textContent = `${gameState.totalScore} pts`;
    }
    const speedEl = el('reindeer-speed');
    if (speedEl) {
      speedEl.textContent = `${gameState.baseSpeed}`;
    }
    const obstaclesEl = el('reindeer-obstacles');
    if (obstaclesEl) {
      obstaclesEl.textContent = `${gameState.obstacleCount}`;
    }
    const nextEl = el('reindeer-next-item');
    if (nextEl) {
      nextEl.textContent = `${gameState.nextItem}`;
    }
  }

  function updateOrientationHint() {
    if (!immersiveHint) return;
    const needsLandscape = window.innerWidth < window.innerHeight;
    immersiveHint.setAttribute('data-visible', immersiveActive && needsLandscape ? '1' : '0');
  }

  async function enterImmersiveStage(options = {}) {
    const { auto = false } = options;
    if (immersiveActive) return;
    immersiveStage = immersiveStage || el('reindeer-immersive-stage');
    immersiveHint = immersiveHint || el('reindeer-immersive-hint');
    const stage = immersiveStage;
    immersiveActive = true;
    if (stage) {
      stage.setAttribute('data-active', '1');
      stage.setAttribute('aria-hidden', 'false');
    }
    if (document.body) {
      document.body.setAttribute('data-immersive-active', '1');
    }
    updateOrientationHint();
    if (!auto) {
      try {
        if (stage && stage.requestFullscreen && !document.fullscreenElement) {
          await stage.requestFullscreen({ navigationUI: 'hide' });
        }
      } catch (err) {
        console.warn('Fullscreen request rejected', err);
      }
      if (screen.orientation && screen.orientation.lock) {
        screen.orientation.lock('landscape').catch(() => {});
      }
    }
  }

  function exitImmersiveStage(options = {}) {
    const { passive = false } = options;
    if (!immersiveActive && !document.fullscreenElement) return;
    immersiveActive = false;
    if (document.body) {
      document.body.setAttribute('data-immersive-active', '0');
    }
    if (immersiveStage) {
      immersiveStage.removeAttribute('data-active');
      immersiveStage.setAttribute('aria-hidden', 'true');
    }
    updateOrientationHint();
    if (!passive) {
      stopGame('exited-immersive');
    }
    if (document.fullscreenElement && document.exitFullscreen) {
      document.exitFullscreen().catch(() => {});
    }
  }

  function setupImmersiveControls() {
    immersiveStage = el('reindeer-immersive-stage');
    immersiveHint = el('reindeer-immersive-hint');
    const exitBtn = el('reindeer-exit-immersive');
    if (exitBtn) {
      exitBtn.addEventListener('click', () => exitImmersiveStage({ passive: false }));
    }
    document.addEventListener('fullscreenchange', () => {
      if (!document.fullscreenElement && immersiveActive) {
        exitImmersiveStage({ passive: false });
      }
    });
    window.addEventListener('resize', updateOrientationHint);
    window.addEventListener('orientationchange', updateOrientationHint);
    updateOrientationHint();
  }

  document.addEventListener('DOMContentLoaded', () => {
    initCanvas();
    setupInput();
    preloadRudolphSprites();
    setupImmersiveControls();
    updateUI();
    enterImmersiveStage({ auto: true });
  });

  window.__reindeerRush__ = {
    startGame,
    stopGame,
    enterImmersiveStage,
    exitImmersiveStage,
    resetGame,
    getState: () => ({ ...gameState }),
    _state: gameState
  };

  window.__reindeerRushDebug__ = {
    getObstacles: () => platforms.map((p) => ({ width: p.width, surfaceY: p.surfaceY })),
    getPlatforms: () =>
      platforms.map((p) => ({ x: p.x, width: p.width, surfaceY: p.surfaceY, clusterId: p.clusterId })),
    getPlayer: () => ({ x: player.x, y: player.y, grounded: player.grounded }),
    triggerDash: () => triggerDash(),
    getSnowmen: () => snowmen.map((s) => ({ x: s.x, y: s.y, w: s.w, h: s.h })),
    spawnSnowmanForTest: (offset = 160) => {
      const x = player.x + player.w + offset;
      const placed = spawnSnowmanAt(x);
      if (placed) snowmanGapPx = calcSnowmanGap(width);
      return placed;
    },
    getSnowmanMetrics: () => {
      const drawWidth = snowmanMetrics.natural.w * snowmanMetrics.drawScale;
      const drawHeight = snowmanMetrics.natural.h * snowmanMetrics.drawScale;
      return {
        drawWidth,
        drawHeight,
        aspect: snowmanMetrics.aspect,
        bottomPadding: snowmanMetrics.bottomPadding,
        hitbox: {
          x: snowmanMetrics.hitbox.minX * snowmanMetrics.drawScale,
          y: snowmanMetrics.hitbox.minY * snowmanMetrics.drawScale,
          w: (snowmanMetrics.hitbox.maxX - snowmanMetrics.hitbox.minX + 1) * snowmanMetrics.drawScale,
          h: (snowmanMetrics.hitbox.maxY - snowmanMetrics.hitbox.minY + 1) * snowmanMetrics.drawScale
        }
      };
    },
    setSnowmanMetricsForTest: (metrics) => {
      Object.assign(snowmanMetrics, metrics || {});
    },
    isDeathScreenActive: () => deathOverlay.active,
    testSnowmanSpacing: (count = 3) => {
      const screenWidth = width;
      let cursor = 0;
      let minGap = Infinity;
      for (let i = 0; i < count; i++) {
        const gap = calcSnowmanGap(screenWidth);
        minGap = Math.min(minGap, gap);
        cursor += gap;
      }
      return { minGap, screenWidth, count };
    },
    clearPlatforms: () => {
      platforms.length = 0;
      platformClusterId = 0;
      ensurePlatformBuffer();
    },
    dropAllPlatforms: () => {
      platforms.length = 0;
      platformBufferEnabled = false;
    },
    enablePlatformBuffer: () => {
      platformBufferEnabled = true;
      ensurePlatformBuffer();
    },
    start: () => startGame(),
    isImmersiveActive: () => immersiveActive,
    stepForTest: (dt = 16) => updateScene(dt),
    triggerDeathForTest: () => handlePlayerDeath('test-invoked')
  };
})();
