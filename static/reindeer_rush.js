// Reindeer Rush - canvas-based runner with duck, charge, and collectibles
(function () {
  function el(id) {
    return document.getElementById(id);
  }

  const baseJumpVel = -0.55;
  const maxJumpVel = -0.75 * Math.SQRT2 * 0.66;
  const jumpChargeWindow = 0;
  const coyoteTimeMs = 120;
  const dashDurationMs = 260;
  const dashCooldownMs = 450;
  const dashSpeedBoost = 2.2;
  const dashInvulnMs = 240;
  let dashForwardNudge = 16;
  const dashReturnDurationMs = 520;
  const snowmanMinGapScreens = 1.5;
  const snowmanGapJitter = [180, 780];
  const snowmanBonus = 120;
  const snowmanSize = { w: 259, h: 216 }; // sprite's native size for clean aspect
  const playerStandingHeight = 36;
  const playerDuckHeight = 24;
  const baseGroundOffset = 40;
  const GROUND_SURFACE_ROW = (window.ReindeerGround && window.ReindeerGround.SURFACE_ROW) || 78;
  const playerHomeX = 80;
  const DEATH_OVERLAY_DELAY = 520;
  const DEATH_SCREEN_DURATION = 2500;
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
  const BG_SPRITES = {
    moon: '/static/BG/moon.png',
    star1: '/static/BG/star-1.png',
    star2: '/static/BG/star-2.png',
    cloud1: '/static/BG/cloud-1.png',
    cloud2: '/static/BG/cloud-2.png'
  };
  const SKY_COLOR = '#0d093a';
  const AUDIO_SOURCES = {
    musicIntro: '/static/retro-platform.mp3',
    musicMain: '/static/arcade-kid.mp3',
    jump: '/static/jump.mp3',
    death: '/static/explosion.mp3',
    coin: '/static/coin.mp3'
  };
  const INTRO_JUMPS_RANGE = [2, 2];
  const INTRO_RUNWAY_SCREENS = 1.05;
  const INTRO_EXTRA_STEP_SCREENS = 3.6;
  const INTRO_CLUSTER_RANGE = [3, 5];
  const INTRO_FORCED_STEP_RANGE = [150, 210];
  const INTRO_SINGLE_STEP_RISE = [70, 110];
  const INTRO_DOUBLE_STEP_RISE = [140, 170];
  const INTRO_SURFACE_MIN_FRACTION = 0.12;
  const INTRO_SURFACE_MAX_FRACTION = 0.92;
  const INTRO_SURFACE_MIN_Y = 30;
  const INTRO_SURFACE_MAX_PADDING = 28;
  const INTRO_SNOWMAN_DELAY_MS = 4800;
  const SNOWMAN_UNLOCK_DISTANCE = 450;
  const GAP_INTRO_DISTANCE = 1000;
  const GAP_RAMP_DISTANCE = 1500;
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
  const bgSprites = { moon: null, star1: null, star2: null, cloud1: null, cloud2: null };
  const deathOverlay = { sprite: null, active: false, visible: false, showAt: 0 };
  const snowParticles = [];
  const sparkParticles = [];
  const stars = [];
  const clouds = [];
  let skyPhase = 0;
  let twinkleIndex = 0;
  let activeTwinkle = null;
  let twinkleTimer = 0;
  let twinkleCooldown = 0;
  let platformBufferEnabled = true;
  let uiElapsed = 0;
  let targetFrameMs = 20; // ~50 FPS cap
  let dashTargetX = playerHomeX;
  let currentPlatform = null;
  let suppressDeathsForTest = false;
  let cameraBaselineY = 0;
  let cameraY = 0;
  let cameraTargetY = 0;
  let deathTimerMs = 0;
  let pendingStopReason = null;
  let highScoreFlowInFlight = false;
  let platformClusterId = 0;
  let introClusterPlan = null;
  let introPlanQueue = [];
  let groundScale = 1;
  let snowmanHintEl = null;
  let snowmanHintShown = false;
  let snowmanDashSucceeded = false;
  let snowmanHintHideAt = 0;
  const snowmanMetrics = {
    natural: { w: snowmanSize.w, h: snowmanSize.h },
    drawScale: 0.65,
    aspect: snowmanSize.w / snowmanSize.h,
    bottomPadding: 18,
    topPadding: 0,
    hitbox: { minX: 0, maxX: Math.round(snowmanSize.w * 0.88), minY: 0, maxY: snowmanSize.h - 1 }
  };
  let musicStartedKey = null;
  let currentMusicKey = 'musicIntro';
  const audio = { musicIntro: null, musicMain: null, jump: null, death: null, coin: null };
  let runElapsedMs = 0;
  let gapMode = 'intro';
  let introState = {
    jumpTarget: INTRO_JUMPS_RANGE[0],
    jumpsPlaced: 0,
    jumpCooldown: 0,
    snowmanUnlocked: false,
    introSnowmanPlaced: false
  };

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

  function updateDeathOverlayVisibility() {
    if (deathOverlay.active && !deathOverlay.visible && performance.now() >= deathOverlay.showAt) {
      deathOverlay.visible = true;
    }
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
    ensureSnowmanHint();
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
    const naturalGroundWidth = groundNaturalWidth();
    groundScale = Math.min(1, width / (naturalGroundWidth * 4.5));
    cameraBaselineY = Math.round(height * 0.68);
    dashForwardNudge = Math.max(player.w * 1.2, Math.min(width * 0.2, 100));
    dpr = window.devicePixelRatio || 1;
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    resetSkyDecorations();
    const baseSurface = currentPlatform ? currentPlatform.surfaceY : cameraBaselineY;
    cameraTargetY = cameraBaselineY - baseSurface;
    cameraY = cameraTargetY;
  }

  function clamp(value, min, max) {
    if (Number.isNaN(value)) return min;
    return Math.min(max, Math.max(min, value));
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function seededNoise(seed) {
    const x = Math.sin(seed * 1337.77) * 43758.5453123;
    return x - Math.floor(x);
  }

  function resetSkyDecorations() {
    layoutStars();
    seedCloudField();
    twinkleIndex = 0;
    activeTwinkle = null;
    twinkleTimer = 0;
    twinkleCooldown = 140;
  }

  function layoutStars() {
    stars.length = 0;
    const count = Math.max(12, Math.round(width / 48));
    const padX = Math.max(18, width * 0.05);
    const padY = Math.max(12, height * 0.1);
    for (let i = 0; i < count; i++) {
      const nx = seededNoise(i + 3 + width);
      const ny = seededNoise(i * 2 + height);
      const x = padX + nx * (width - padX * 2);
      const y = padY + ny * (height * 0.55);
      stars.push({ x, y });
    }
  }

  function seedCloudField() {
    clouds.length = 0;
    const count = Math.max(3, Math.round(width / 260));
    const span = width + 240;
    for (let i = 0; i < count; i++) {
      const offset = (span / count) * i;
      clouds.push(createCloud(offset, i + 1));
    }
  }

  function createCloud(baseX, seed = 1) {
    const spriteKey = seededNoise(seed + 1) > 0.5 ? 'cloud2' : 'cloud1';
    const scale = 0.7 + seededNoise(seed + 3) * 0.5;
    const yRatio = clamp(0.06 + seededNoise(seed + 5) * 0.32, 0.04, 0.44);
    const depth = 0.55 + seededNoise(seed + 7) * 0.4;
    return {
      spriteKey,
      x: baseX + seededNoise(seed + 11) * 80,
      yRatio,
      scale,
      depth
    };
  }

  function updateStars(dt) {
    if (!stars.length) return;
    if (activeTwinkle !== null) {
      twinkleTimer = Math.max(0, twinkleTimer - dt);
      if (twinkleTimer === 0) {
        activeTwinkle = null;
        twinkleCooldown = 160 + seededNoise(twinkleIndex + 19) * 240;
      }
    } else {
      twinkleCooldown = Math.max(0, twinkleCooldown - dt);
      if (twinkleCooldown === 0) {
        activeTwinkle = twinkleIndex % stars.length;
        twinkleIndex = (twinkleIndex + 1) % stars.length;
        twinkleTimer = 180 + seededNoise(twinkleIndex + 23) * 200;
        twinkleCooldown = 60;
      }
    }
  }

  function updateClouds(dt, speedPxPerMs) {
    if (!clouds.length) return;
    const baseSpeed = speedPxPerMs > 0 ? speedPxPerMs * 0.18 : 0.08;
    const drift = baseSpeed + 0.02;
    const resetX = width + 220;
    for (let i = 0; i < clouds.length; i++) {
      const cloud = clouds[i];
      const sprite = bgSprites[cloud.spriteKey];
      const ready = spriteReady(sprite);
      const spriteW = ready ? sprite.naturalWidth * cloud.scale : 140 * cloud.scale;
      const travel = drift * cloud.depth * dt;
      cloud.x -= travel;
      if (cloud.x + spriteW < -180) {
        cloud.x = resetX + seededNoise(i + skyPhase) * 120;
        cloud.yRatio = clamp(0.05 + seededNoise(i + skyPhase * 0.1) * 0.34, 0.05, 0.46);
      }
    }
  }

  function drawSkyBackdrop() {
    if (!ctx) return;
    ctx.fillStyle = SKY_COLOR;
    ctx.fillRect(0, 0, width, height);
    drawStars();
    drawMoon();
    drawClouds();
  }

  function drawStars() {
    const twinkleReady = spriteReady(bgSprites.star2);
    for (let i = 0; i < stars.length; i++) {
      const star = stars[i];
      const twinkling = activeTwinkle === i;
      const sprite = twinkling && twinkleReady ? bgSprites.star2 : bgSprites.star1;
      if (spriteReady(sprite)) {
        const w = sprite.naturalWidth;
        const h = sprite.naturalHeight;
        ctx.drawImage(sprite, Math.round(star.x), Math.round(star.y), Math.round(w), Math.round(h));
      } else {
        const size = twinkling ? 3 : 2;
        ctx.fillStyle = twinkling ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.8)';
        ctx.fillRect(Math.round(star.x), Math.round(star.y), size, size);
      }
    }
  }

  function drawMoon() {
    const sprite = bgSprites.moon;
    const ready = spriteReady(sprite);
    const aspect = ready && sprite.naturalHeight ? sprite.naturalWidth / sprite.naturalHeight : 1;
    let drawW = ready ? sprite.naturalWidth * 0.85 : 72;
    let drawH = ready ? sprite.naturalHeight * 0.85 : 72;
    if (ready && aspect > 0) {
      drawH = drawW / aspect;
    }
    const margin = Math.max(18, width * 0.04);
    const x = width - drawW - margin;
    const y = Math.max(12, height * 0.08);
    if (ready) {
      ctx.drawImage(sprite, Math.round(x), Math.round(y), Math.round(drawW), Math.round(drawH));
    } else {
      ctx.fillStyle = 'rgba(255,255,255,0.65)';
      ctx.beginPath();
      ctx.arc(Math.round(x + drawW / 2), Math.round(y + drawH / 2), Math.round(drawW / 2), 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawClouds() {
    for (let i = 0; i < clouds.length; i++) {
      const cloud = clouds[i];
      const sprite = bgSprites[cloud.spriteKey];
      const ready = spriteReady(sprite);
      const baseW = ready ? sprite.naturalWidth : 160;
      const baseH = ready ? sprite.naturalHeight : 90;
      const drawW = baseW * cloud.scale;
      const drawH = baseH * cloud.scale;
      const x = cloud.x;
      const y = cloud.yRatio * height;
      if (ready) {
        ctx.drawImage(sprite, Math.round(x), Math.round(y), Math.round(drawW), Math.round(drawH));
      } else {
        ctx.fillStyle = 'rgba(255,255,255,0.22)';
        ctx.fillRect(Math.round(x), Math.round(y), Math.round(drawW), Math.round(drawH));
      }
    }
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
    bgSprites.moon = primeSprite(BG_SPRITES.moon);
    bgSprites.star1 = primeSprite(BG_SPRITES.star1);
    bgSprites.star2 = primeSprite(BG_SPRITES.star2);
    bgSprites.cloud1 = primeSprite(BG_SPRITES.cloud1);
    bgSprites.cloud2 = primeSprite(BG_SPRITES.cloud2);
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
      if (!ctx || typeof ctx.getImageData !== 'function') {
        return;
      }
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
    const isMusic = key === 'musicIntro' || key === 'musicMain';
    const opts = isMusic ? { loop: true, volume: 0.45 } : { volume: 0.7 };
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
    const music = ensureSound(currentMusicKey);
    if (!music) return;
    music.loop = true;
    if (musicStartedKey === currentMusicKey && music.play && music.paused === false) return;
    musicStartedKey = currentMusicKey;
    try {
      const res = music.play();
      if (res && typeof res.catch === 'function') {
        res.catch(() => {});
      }
    } catch (err) {
      // jsdom does not implement HTMLMediaElement.play; ignore in tests.
    }
  }

  function swapToMainMusic() {
    if (currentMusicKey === 'musicMain') return;
    const introMusic = audio[currentMusicKey];
    if (introMusic && introMusic.pause) {
      introMusic.pause();
    }
    currentMusicKey = 'musicMain';
    musicStartedKey = null;
    ensureMusicPlaying();
  }

  function collapseBufferForRamp() {
    if (!platforms.length) return;
    const footX = player.x + player.w * 0.5;
    const keeper =
      currentPlatform ||
      platforms.find((p) => footX >= p.x && footX <= p.x + p.width) ||
      platforms[0];
    platforms = keeper ? [keeper] : [];
    platformClusterId = keeper ? keeper.clusterId : platformClusterId;
    introClusterPlan = null;
    rebuildPlatformBodies();
  }

  function rebuildRampStart() {
    const baseY = clamp((currentPlatform && currentPlatform.surfaceY) || cameraBaselineY, 120, height - 60);
    platforms.length = 0;
    platformClusterId = 0;
    introClusterPlan = null;
    const anchorCluster = ++platformClusterId;
    const anchor = createPlatformInstance(playerHomeX - getGroundBaseWidth() * 0.15, baseY, 0.9);
    anchor.clusterId = anchorCluster;
    platforms.push(anchor);
    const gap = Math.max(220, getRandomInterval(220, 320));
    spawnIslandCluster(anchor.x + anchor.width + gap, clamp(baseY + getRandomInterval(-40, 40), 120, height - 60));
    ensurePlatformBuffer();
    rebuildPlatformBodies();
    placePlayerOnSafePlatform();
  }

  function seedRampCluster() {
    if (!platforms.length) return;
    const last = platforms[platforms.length - 1];
    const [minGap, maxGap] = getClusterGapRange();
    const gap = Math.max(120, getRandomInterval(minGap, maxGap));
    const start = last.x + last.width + gap;
    const baseY = clamp(last.surfaceY + getRandomInterval(-60, 60), 120, height - 60);
    spawnIslandCluster(start, baseY);
    rebuildPlatformBodies();
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
    runElapsedMs = 0;
    gapMode = 'intro';
    introState = {
      jumpTarget: INTRO_JUMPS_RANGE[0],
      jumpsPlaced: 0,
      jumpCooldown: 0,
      snowmanUnlocked: false,
      introSnowmanPlaced: false,
      firstStepX: null,
      doubleStepX: null,
      snowmanUnlockDistance: SNOWMAN_UNLOCK_DISTANCE,
      gapUnlockDistance: GAP_INTRO_DISTANCE
    };
    introPlanQueue = [];
    currentMusicKey = 'musicIntro';
    musicStartedKey = null;
    cameraBaselineY = Math.round(height * 0.68);
    cameraY = 0;
    cameraTargetY = 0;
    platforms = [];
    platformBodies = [];
    snowmen = [];
    snowmanGapPx = Infinity;
    snowmanHintShown = false;
    snowmanDashSucceeded = false;
    snowmanHintHideAt = 0;
    platformClusterId = 0;
    introClusterPlan = null;
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
    ['musicIntro', 'musicMain'].forEach((k) => {
      if (audio[k] && audio[k].pause) {
        audio[k].pause();
      }
    });
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
    resetSkyDecorations();
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
    if (suppressDeathsForTest) {
      pendingStopReason = null;
      return;
    }
    if (reason === 'hit-snowman' && !snowmanDashSucceeded) {
      showSnowmanHint('Swipe to dash through snowmen');
    }
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

  function getRandomInt(min, max) {
    return Math.floor(getRandomInterval(min, max + 1));
  }

  function introSurfaceMin() {
    return Math.max(INTRO_SURFACE_MIN_Y, height * INTRO_SURFACE_MIN_FRACTION);
  }

  function introSurfaceMax() {
    return Math.min(height - INTRO_SURFACE_MAX_PADDING, height * INTRO_SURFACE_MAX_FRACTION);
  }

  function clampIntroSurface(y) {
    return clamp(y, introSurfaceMin(), introSurfaceMax());
  }

  function buildGroundMaskFromSprite() {
    if (!window.ReindeerGround || !spriteReady(extraSprites.ground)) return;
    const built = window.ReindeerGround.buildSegmentsFromImage(extraSprites.ground, GROUND_SURFACE_ROW);
    if (built && built.length) {
      groundMaskSegments = built;
    }
  }

  function groundNaturalWidth() {
    if (spriteReady(extraSprites.ground)) return extraSprites.ground.naturalWidth;
    return 320;
  }

  function groundNaturalHeight() {
    if (spriteReady(extraSprites.ground)) return extraSprites.ground.naturalHeight;
    return 140;
  }

  function getGroundScale() {
    return groundScale;
  }

  function getGroundBaseWidth() {
    return groundNaturalWidth() * getGroundScale();
  }

  function getGroundBaseHeight() {
    return groundNaturalHeight() * getGroundScale();
  }

  function createPlatformInstance(x, surfaceY, scale = 1) {
    const baseWidth = groundNaturalWidth();
    const baseSegments = groundMaskSegments.length ? groundMaskSegments : [[0, baseWidth - 1]];
    const effectiveScale = scale * getGroundScale();
    const spans = window.ReindeerGround
      ? window.ReindeerGround.scaleSegments(baseSegments, effectiveScale, x)
      : [[x, x + baseWidth * effectiveScale]];
    return {
      x,
      surfaceY,
      width: baseWidth * effectiveScale,
      scale: effectiveScale,
      spans
    };
  }

  function createPlatformBody(plat) {
    if (!Physics) return null;
    const thickness = Math.max(28, 52 * plat.scale);
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

  function spawnSnowmanAt(x, options = {}) {
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
      alive: true,
      ignoreDelay: Boolean(options.ignoreDelay)
    };
    snowmen.push(snowman);
    if (!snowmanHintShown && !snowmanDashSucceeded) {
      showSnowmanHint('Swipe to dash through snowmen');
    }
    if (!introState.introSnowmanPlaced) {
      introState.introSnowmanPlaced = true;
    }
    return snowman;
  }

  function trySpawnSnowman() {
    if (snowmanGapPx > 0) return null;
    if (gapMode === 'intro' && !introState.snowmanUnlocked) return null;
    if (gapMode === 'intro' && runElapsedMs < INTRO_SNOWMAN_DELAY_MS) return null;
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

  function registerIntroJump() {
    introState.jumpsPlaced += 1;
    introState.jumpCooldown = getRandomInt(1, 2);
  }

  function evaluateSnowmanUnlock() {
    if (introState.snowmanUnlocked) return;
    const distanceReady = distance >= introState.snowmanUnlockDistance;
    const jumpsReady = introState.doubleStepX !== null;
    if (distanceReady && jumpsReady) {
      introState.snowmanUnlocked = true;
      snowmanGapPx = 0;
    }
  }

  function planNextIntroCluster(prefilledCount = 0, clusterIdOverride = null, options = {}) {
    const opts = options || {};
    const last = platforms[platforms.length - 1];
    const offsetRange = opts.startXOffsetRange || [-8, 0];
    const startBase =
      typeof opts.startXBase === 'number' ? opts.startXBase : last ? last.x + last.width : width;
    const baseSurface = clampIntroSurface(
      typeof opts.baseSurfaceY === 'number' ? opts.baseSurfaceY : last ? last.surfaceY : cameraBaselineY
    );
    const startX = startBase + getRandomInterval(offsetRange[0], offsetRange[1]);
    const sizeRange = opts.sizeRange || INTRO_CLUSTER_RANGE;
    const size = getRandomInt(sizeRange[0], sizeRange[1]);
    const forcedStepBase = clamp(
      getRandomInt(Math.max(prefilledCount + 1, 2), Math.max(prefilledCount + 1, size)),
      prefilledCount + 1,
      size
    );
    const forcedStepAt = opts.disableForcedStep
      ? Infinity
      : opts.forcedStepAtRange
        ? clamp(getRandomInt(opts.forcedStepAtRange[0], opts.forcedStepAtRange[1]), prefilledCount + 1, size)
        : forcedStepBase;
    const riseRange = opts.forcedRiseRange || INTRO_FORCED_STEP_RANGE;
    const forcedRise = opts.disableForcedStep ? 0 : getRandomInterval(riseRange[0], riseRange[1]);
    const targetHigh = clampIntroSurface(baseSurface - forcedRise);
    introClusterPlan = {
      clusterId: opts.clusterIdOverride || clusterIdOverride || ++platformClusterId,
      targetSize: size,
      placed: prefilledCount,
      nextX: startX,
      lastSurfaceY: baseSurface,
      forcedStepAt,
      forcedRise,
      ensuredRise: Math.abs(baseSurface - targetHigh),
      driftRange: opts.driftRange || [-32, 38]
    };
  }

  function pullIntroPlanOptions(clusterIdOverride = null) {
    if (!introPlanQueue.length) return { prefilledCount: 0, clusterIdOverride };
    const opts = { ...introPlanQueue.shift() };
    if (clusterIdOverride && !opts.clusterIdOverride) {
      opts.clusterIdOverride = clusterIdOverride;
    }
    return opts;
  }

  function appendIntroPlatform(clusterIdOverride = null) {
    if (!introClusterPlan || introClusterPlan.placed >= introClusterPlan.targetSize) {
      const nextPlan = pullIntroPlanOptions(clusterIdOverride);
      const prefilled = typeof nextPlan.prefilledCount === 'number' ? nextPlan.prefilledCount : 0;
      planNextIntroCluster(prefilled, clusterIdOverride || nextPlan.clusterIdOverride || null, nextPlan || {});
    }
    const plan = introClusterPlan;
    const nextIndex = plan.placed + 1;
    let surface = plan.lastSurfaceY;
    if (nextIndex === plan.forcedStepAt) {
      const target = clampIntroSurface(plan.lastSurfaceY - plan.forcedRise);
      plan.ensuredRise = Math.max(plan.ensuredRise, Math.abs(plan.lastSurfaceY - target));
      surface = target;
      registerIntroJump();
      if (introState.firstStepX === null) {
        introState.firstStepX = plan.nextX;
      } else if (introState.doubleStepX === null) {
        introState.doubleStepX = plan.nextX;
      }
    } else {
      const [minDrift, maxDrift] = plan.driftRange || [-32, 38];
      const drift = getRandomInterval(minDrift, maxDrift);
      surface = clampIntroSurface(surface + drift);
    }
    const scale = clamp(0.85 + Math.random() * 0.25, 0.75, 1.15);
    const plat = createPlatformInstance(plan.nextX, surface, scale);
    plat.clusterId = clusterIdOverride || plan.clusterId;
    platforms.push(plat);
    plan.placed += 1;
    plan.lastSurfaceY = surface;
    plan.nextX = plat.x + plat.width + getRandomInterval(-16, -4);
  }

  function buildIntroRunway(anchorCluster, baseline) {
    const anchor = platforms[platforms.length - 1];
    if (!anchor) return;
    introPlanQueue = [
      {
        prefilledCount: 1,
        clusterIdOverride: anchorCluster,
        sizeRange: [6, 7],
        disableForcedStep: true,
        driftRange: [-6, 6],
        startXBase: anchor.x + anchor.width,
        startXOffsetRange: [-10, -2]
      },
      {
        prefilledCount: 0,
        sizeRange: [5, 6],
        forcedStepAtRange: [4, 5],
        forcedRiseRange: INTRO_SINGLE_STEP_RISE,
        startXBase: anchor.x + anchor.width + width * INTRO_RUNWAY_SCREENS,
        startXOffsetRange: [-12, -2]
      },
      {
        prefilledCount: 0,
        sizeRange: [4, 5],
        disableForcedStep: true,
        driftRange: [-4, 4],
        startXOffsetRange: [-10, -2],
        baseSurfaceY: baseline
      },
      {
        prefilledCount: 0,
        sizeRange: [3, 5],
        forcedStepAtRange: [2, 3],
        forcedRiseRange: INTRO_DOUBLE_STEP_RISE,
        startXOffsetRange: [-8, -2],
        baseSurfaceY: baseline + 28
      },
      {
        prefilledCount: 0,
        sizeRange: [3, 4],
        forcedStepAtRange: [2, 2],
        forcedRiseRange: [160, 220],
        startXBase: anchor.x + anchor.width + width * INTRO_EXTRA_STEP_SCREENS,
        startXOffsetRange: [-8, -2],
        baseSurfaceY: baseline + 46
      },
      {
        prefilledCount: 0,
        sizeRange: [3, 4],
        forcedStepAtRange: [2, 2],
        forcedRiseRange: [150, 200],
        startXBase: anchor.x + anchor.width + width * (INTRO_EXTRA_STEP_SCREENS + 1.2),
        startXOffsetRange: [-10, -2],
        baseSurfaceY: baseline + 30
      }
    ];
    introClusterPlan = null;
    let last = anchor;
    let guard = 0;
    while ((last && last.x + last.width < width + getGroundBaseWidth() * 6) || introPlanQueue.length) {
      appendIntroPlatform();
      last = platforms[platforms.length - 1];
      guard += 1;
      if (guard > 112) break;
    }
  }

  function setSinglePlatformForTest(surfaceY = cameraBaselineY, scale = 1) {
    platformBufferEnabled = false;
    platforms.length = 0;
    platformClusterId = 1;
    const plat = createPlatformInstance(playerHomeX - getGroundBaseWidth() * 0.15, surfaceY, scale);
    plat.clusterId = platformClusterId;
    platforms.push(plat);
    rebuildPlatformBodies();
    placePlayerOnSafePlatform();
    cameraTargetY = cameraBaselineY - surfaceY;
    cameraY = cameraTargetY;
  }

  function getClusterGapRange() {
    if (gapMode === 'intro') return [-8, 0];
    if (gapMode === 'ramp') {
      const rampProgress = clamp((distance - GAP_INTRO_DISTANCE) / GAP_RAMP_DISTANCE, 0, 1);
      const minGap = lerp(40, 180, rampProgress);
      const maxGap = lerp(110, 420, rampProgress);
      return [minGap, maxGap];
    }
    return [180, 420];
  }

  function updateGapMode() {
    const prev = gapMode;
    const introJumpsDone = introState.doubleStepX !== null;
    const introPhase = distance < GAP_INTRO_DISTANCE || !introJumpsDone;
    if (introPhase) {
      gapMode = 'intro';
    } else if (distance < GAP_INTRO_DISTANCE + GAP_RAMP_DISTANCE) {
      gapMode = 'ramp';
    } else {
      gapMode = 'chaos';
    }
    if (prev === 'intro' && gapMode === 'ramp') {
      collapseBufferForRamp();
      rebuildRampStart();
      seedRampCluster();
      snowmanGapPx = 0;
      trySpawnSnowman();
    }
  }

  function seedPlatforms() {
    const baseline = Math.round(height * 0.68);
    platforms.length = 0;
    snowmen.length = 0;
    snowmanGapPx = introState.snowmanUnlocked ? calcSnowmanGap(width) : Infinity;
    platformBufferEnabled = true;
    // Anchor platform covering the spawn position to avoid immediate falls.
    const anchorCluster = ++platformClusterId;
    const anchor = createPlatformInstance(playerHomeX - getGroundBaseWidth() * 0.15, baseline, 0.9);
    anchor.clusterId = anchorCluster;
    platforms.push(anchor);
    buildIntroRunway(anchorCluster, baseline);
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
      cameraTargetY = cameraBaselineY - plat.surfaceY;
      cameraY = cameraTargetY;
    }
  }

  function ensurePlatformBuffer() {
    if (!platformBufferEnabled) return;
    const baseWidth = getGroundBaseWidth();
    const bufferDist = gapMode === 'intro' ? baseWidth * 1.5 : baseWidth * 3.2;
    const minClusters = gapMode === 'intro' ? 1 : 2;
    const needs = () => {
      const clusterCount = new Set(platforms.map((p) => p.clusterId)).size;
      if (!platforms.length || clusterCount < minClusters) return true;
      const last = platforms[platforms.length - 1];
      return last.x + last.width < width + bufferDist;
    };
    while (needs()) {
      const last = platforms[platforms.length - 1];
      if (gapMode === 'intro') {
        appendIntroPlatform(last ? last.clusterId : null);
      } else {
        const [minGap, maxGap] = getClusterGapRange();
        const gap = getRandomInterval(minGap, maxGap);
        const start = last ? last.x + last.width + gap : width;
        const baseY = last ? clamp(last.surfaceY + getRandomInterval(-80, 80), 120, height - 60) : Math.round(height * 0.68);
        spawnIslandCluster(start, baseY);
      }
    }
  }

  function compressIntroGaps() {
    if (gapMode !== 'intro' || platforms.length < 2) return;
    const sorted = platforms.slice().sort((a, b) => a.x - b.x);
    let shifted = false;
    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1];
      const curr = sorted[i];
      const gap = curr.x - (prev.x + prev.width);
      if (gap > 0) {
        const newX = prev.x + prev.width + getRandomInterval(-8, -2);
        const delta = curr.x - newX;
        curr.x = newX;
        curr.spans = curr.spans.map(([s, e]) => [s - delta, e - delta]);
        shifted = true;
      }
    }
    if (shifted) {
      platforms.length = 0;
      platforms.push(...sorted);
      rebuildPlatformBodies();
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
    compressIntroGaps();
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
    const singleChance = 0.1;
    const pieces = Math.random() < singleChance ? 1 : Math.floor(getRandomInterval(2, 6));
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
    updateDeathOverlayVisibility();
    if (running) {
      distance += dt * 0.02;
      runElapsedMs += dt;
    }
    evaluateSnowmanUnlock();
    if (runElapsedMs < INTRO_SNOWMAN_DELAY_MS) {
      const keepers = snowmen.filter((s) => s.ignoreDelay);
      snowmen.length = 0;
      snowmen.push(...keepers);
      snowmanGapPx = Math.max(snowmanGapPx, calcSnowmanGap(width));
    }
    updateGapMode();
    animationClock += dt;
    skyPhase += dt * 0.001;
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

    updateStars(dt);
    updateClouds(dt, speedPxPerMs);
    if (running) {
      movePlatforms(dt, speedPxPerMs);
      rebuildPlatformBodies();
      moveSnowmen(dt, speedPxPerMs);
      trySpawnSnowman();
      if (distance >= GAP_INTRO_DISTANCE) {
        swapToMainMusic();
      }
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
      cameraTargetY = cameraBaselineY - currentPlatform.surfaceY;
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
        cameraTargetY = cameraBaselineY - surface.platform.surfaceY;
        doubleJumpAvailable = true;
        coyoteTimer = coyoteTimeMs;
        if (!wasGrounded && gestureInterpreter) gestureInterpreter.setGrounded(true);
      } else if (wasGrounded && Math.abs(surfY - prevFoot) <= 20) {
        // Maintain contact while running on platform
        player.y = surfY - player.h;
        player.vy = 0;
        player.grounded = true;
        currentPlatform = surface.platform;
        cameraTargetY = cameraBaselineY - surface.platform.surfaceY;
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

    const cameraFollowT = clamp(dt / 240, 0, 0.4);
    cameraY = lerp(cameraY, cameraTargetY, cameraFollowT);

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
            snowmanDashSucceeded = true;
            hideSnowmanHint();
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

    drawSkyBackdrop();
    ctx.save();
    if (ctx.translate) {
      ctx.translate(0, cameraY);
    } else if (ctx.setTransform) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, cameraY * dpr);
    }
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
    ctx.restore();

    ctx.fillStyle = 'rgba(248, 250, 252, 0.9)';
    ctx.font = '13px "Press Start 2P", system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial';
    ctx.fillText(`${Math.floor(distance + bonusScore)} pts`, 12, 20);

    if (!running && deathOverlay.active && deathOverlay.visible) {
      drawDeathOverlay();
    }
    drawSnowmanHint();
  }

  function drawPlatformsLayer() {
    const sprite = extraSprites.ground;
    const ready = spriteReady(sprite) || Boolean(groundCache.canvas);
    const baseW = groundNaturalWidth();
    const baseH = groundNaturalHeight();
    for (const plat of platforms) {
      const drawW = ready ? baseW * plat.scale : plat.width;
      const drawH = ready ? baseH * plat.scale : Math.max(64, 90 * plat.scale);
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

  function drawSnowmanHint() {
    if (!snowmanHintEl) return;
    if (snowmanHintHideAt && performance.now() >= snowmanHintHideAt) {
      hideSnowmanHint(true);
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
      scoreEl.textContent = `${gameState.distance + gameState.bonus} pts`;
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

  function summarizeIntroClusters() {
    if (!platforms.length && !running) {
      seedPlatforms();
      placePlayerOnSafePlatform();
    }
    const map = new Map();
    platforms.forEach((p) => {
      if (!map.has(p.clusterId)) {
        map.set(p.clusterId, []);
      }
      map.get(p.clusterId).push(p);
    });
    const summaries = [];
    map.forEach((list, clusterId) => {
      const sorted = list.slice().sort((a, b) => a.x - b.x);
      let biggestStep = 0;
      for (let i = 1; i < sorted.length; i++) {
        const step = sorted[i - 1].surfaceY - sorted[i].surfaceY;
        if (step > biggestStep) biggestStep = step;
      }
      summaries.push({ clusterId, count: sorted.length, biggestStep });
    });
    return summaries.sort((a, b) => a.clusterId - b.clusterId);
  }

  function describeIntroStepsForTest(threshold = 20, maxSteps = 4) {
    if (!platforms.length && !running) {
      seedPlatforms();
      placePlayerOnSafePlatform();
    }
    const sorted = platforms.slice().sort((a, b) => a.x - b.x);
    const steps = [];
    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1];
      const curr = sorted[i];
      const rise = prev.surfaceY - curr.surfaceY;
      if (rise > threshold) {
        steps.push({
          startX: curr.x,
          fromY: prev.surfaceY,
          toY: curr.surfaceY,
          height: rise,
          clusterId: curr.clusterId
        });
      }
      if (steps.length >= maxSteps) break;
    }
    return steps;
  }

  function measureJumpArcForTest() {
    const gravity = 0.0018;
    const dt = 16;
    const startY = player.y;
    let vy = maxJumpVel;
    let y = 0;
    let minY = 0;
    let elapsed = 0;
    while (elapsed < 2000) {
      vy += gravity * dt;
      y += vy * dt;
      if (y < minY) minY = y;
      if (vy >= 0) break;
      elapsed += dt;
    }
    return { rise: -minY, startY, peakY: startY + minY };
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

  function ensureSnowmanHint() {
    snowmanHintEl = el('reindeer-snowman-hint');
    if (!snowmanHintEl) return;
    snowmanHintEl.setAttribute('aria-live', 'polite');
    snowmanHintEl.setAttribute('role', 'status');
    snowmanHintEl.style.opacity = '0';
  }

  function showSnowmanHint(text) {
    if (!snowmanHintEl) return;
    if (snowmanDashSucceeded) return;
    snowmanHintShown = true;
    snowmanHintEl.textContent = text;
    snowmanHintEl.style.opacity = '1';
    snowmanHintEl.setAttribute('data-visible', '1');
    snowmanHintHideAt = performance.now() + 3200;
  }

  function hideSnowmanHint(force = false) {
    if (!snowmanHintEl) return;
    if (!force && performance.now() < snowmanHintHideAt) return;
    snowmanHintEl.style.opacity = '0';
    snowmanHintEl.removeAttribute('data-visible');
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
    getCamera: () => ({ y: cameraY, target: cameraTargetY, baseline: cameraBaselineY }),
    getIntroStatus: () => ({
      gapMode,
      runElapsedMs,
      distance,
      ...introState
    }),
    getIntroClusters: () => summarizeIntroClusters(),
    describeIntroSteps: (threshold, maxSteps) => describeIntroStepsForTest(threshold, maxSteps),
    measureJumpArcForTest: () => measureJumpArcForTest(),
    getGroundMetrics: () => ({
      naturalWidth: groundNaturalWidth(),
      naturalHeight: groundNaturalHeight(),
      scale: getGroundScale(),
      baseWidth: getGroundBaseWidth()
    }),
    triggerDash: () => triggerDash(),
    getSnowmen: () => snowmen.map((s) => ({ x: s.x, y: s.y, w: s.w, h: s.h })),
    spawnSnowmanForTest: (offset = 160) => {
      const x = player.x + player.w + offset;
      const placed = spawnSnowmanAt(x, { ignoreDelay: true });
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
    isDeathScreenVisible: () => deathOverlay.active && deathOverlay.visible,
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
      introClusterPlan = null;
      introPlanQueue = [];
      ensurePlatformBuffer();
    },
    dropAllPlatforms: () => {
      platforms.length = 0;
      platformBufferEnabled = false;
    },
    setSinglePlatformForTest: (surfaceY, scale = 1) => setSinglePlatformForTest(surfaceY, scale),
    enablePlatformBuffer: () => {
      platformBufferEnabled = true;
      ensurePlatformBuffer();
    },
    start: () => startGame(),
    isImmersiveActive: () => immersiveActive,
    stepForTest: (dt = 16) => {
      suppressDeathsForTest = true;
      pendingStopReason = null;
      deathOverlay.active = false;
      deathOverlay.visible = false;
      deathTimerMs = 0;
      running = true;
      gameState.running = true;
      placePlayerOnSafePlatform();
      if (dt <= 2000) {
        updateScene(dt);
        suppressDeathsForTest = false;
        return;
      }
      let remaining = dt;
      const slice = 32;
      while (remaining > 0) {
        const step = Math.min(slice, remaining);
        updateScene(step);
        remaining -= step;
      }
      suppressDeathsForTest = false;
    },
    triggerDeathForTest: () => handlePlayerDeath('test-invoked')
  };
})();
