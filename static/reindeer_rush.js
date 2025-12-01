// Reindeer Rush - canvas-based runner with duck, charge, and collectibles
(function () {
  function el(id) {
    return document.getElementById(id);
  }

  const collectibleTypes = [
    { key: 'carrot', label: 'Carrot', points: 10, color: '#fb923c', size: 12, weight: 60 },
    { key: 'candy', label: 'Candy cane', points: 50, color: '#f472b6', size: 14, weight: 30 },
    { key: 'star', label: 'Star', points: 100, color: '#fde047', size: 16, weight: 10 }
  ];

  const baseJumpVel = -0.55;
  const maxJumpVel = -0.75;
  const jumpChargeWindow = 420;
  const playerStandingHeight = 36;
  const playerDuckHeight = 24;
  const groundOffset = 40;

  let canvas, ctx, width = 600, height = 260, dpr = window.devicePixelRatio || 1;
  let canvasHolder = null;
  let running = false;
  let lastTs = 0;
  let distance = 0;
  let bonusScore = 0;
  let spawnTimer = 0;
  let spawnInterval = 1400;
  let collectibleTimer = 0;
  let obstacles = [];
  let collectibles = [];
  let nextCollectible = null;
  let fpsTracker = { frameCount: 0, totalTime: 0 };
  let lastCollisionTs = null;
  let lastCollisionReason = null;
  let pointerState = { active: false, startY: 0, startTs: 0, swiped: false, pointerId: null };
  let spaceHeld = false;
  let spaceStart = 0;

  const player = {
    x: 80,
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
    spawnInterval,
    fps: 0,
    totalScore: 0,
    nextItem: '—',
    lastCollisionAt: null,
    lastCollisionReason: null
  };

  function initCanvas() {
    const holder = el('reindeer-canvas');
    if (!holder) return;
    canvasHolder = holder;
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
    holder.style.touchAction = 'none';
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
    bonusScore = 0;
    player.h = playerStandingHeight;
    player.ducking = false;
    player.y = height - groundOffset - player.h;
    player.vy = 0;
    player.grounded = true;
    obstacles = [];
    collectibles = [];
    spawnTimer = 0;
    spawnInterval = 1400;
    collectibleTimer = 0;
    scheduleNextCollectible();
    lastTs = 0;
    fpsTracker.frameCount = 0;
    fpsTracker.totalTime = 0;
    lastCollisionTs = null;
    lastCollisionReason = null;
    gameState.running = false;
    gameState.distance = 0;
    gameState.bonus = 0;
    gameState.totalScore = 0;
    gameState.obstacleCount = 0;
    gameState.collectibleCount = 0;
    gameState.baseSpeed = 0;
    gameState.spawnInterval = spawnInterval;
    gameState.fps = 0;
    gameState.nextItem = nextCollectible?.label || '—';
    gameState.lastCollisionAt = null;
    gameState.lastCollisionReason = null;
  }

  function startGame() {
    if (running) return;
    initCanvas();
    resetGame();
    running = true;
    gameState.running = true;
    requestAnimationFrame(loop);
  }

  async function stopGame(reason = 'collision-with-obstacle') {
    if (!running) return;
    running = false;
    lastCollisionTs = Date.now();
    lastCollisionReason = reason;
    gameState.running = false;
    gameState.lastCollisionAt = lastCollisionTs;
    gameState.lastCollisionReason = lastCollisionReason;
    spaceHeld = false;
    pointerState.active = false;

    const totalScore = Math.floor(gameState.distance + gameState.bonus);
    if (window.arcadeOverlay && window.arcadeOverlay.handleHighScoreFlow) {
      try {
        await window.arcadeOverlay.handleHighScoreFlow({
          gameId: 'tredje-advent',
          score: totalScore,
          allowSkip: true,
          title: 'Reindeer Rush',
          message: `Du fløj ${Math.floor(gameState.distance)}m og fik ${gameState.bonus} bonus.`,
        });
      } catch (e) {
        console.error('Arcade high score flow failed', e);
      }
    } else {
      console.warn('Arcade overlay not available; high score entry skipped.');
    }
    refreshLeaderboard();
  }

  function ensureGameRunning() {
    if (!running) {
      startGame();
    }
  }

  function getRandomInterval(min, max) {
    return min + Math.random() * (max - min);
  }

  function pickCollectibleType() {
    const totalWeight = collectibleTypes.reduce((sum, type) => sum + type.weight, 0);
    let r = Math.random() * totalWeight;
    for (const type of collectibleTypes) {
      r -= type.weight;
      if (r <= 0) {
        return type;
      }
    }
    return collectibleTypes[0];
  }

  function scheduleNextCollectible() {
    nextCollectible = pickCollectibleType();
    collectibleTimer = getRandomInterval(2200, 4200);
    gameState.nextItem = nextCollectible?.label || '—';
  }

  function spawnObstacle() {
    const isDuck = Math.random() < 0.28;
    const baseX = width + 10;
    if (isDuck) {
      const h = 28 + Math.random() * 18;
      const y = Math.max(12, height - groundOffset - playerStandingHeight - h - 10);
      const w = 28 + Math.random() * 18;
      obstacles.push({ x: baseX, y, w, h, type: 'duck', color: '#38bdf8' });
    } else {
      const h = 20 + Math.random() * 36;
      const y = height - groundOffset - h;
      const w = 26 + Math.random() * 32;
      obstacles.push({ x: baseX, y, w, h, type: 'jump', color: '#ef4444' });
    }
  }

  function spawnCollectible() {
    if (!nextCollectible) {
      scheduleNextCollectible();
    }
    const type = nextCollectible;
    const size = type.size;
    const y = Math.max(12, height - groundOffset - size - getRandomInterval(8, 60));
    collectibles.push({ x: width + 10, y, w: size, h: size, type });
    scheduleNextCollectible();
  }

  function updateCollectibles(dt, speedPxPerMs) {
    collectibleTimer -= dt;
    if (collectibleTimer <= 0) {
      spawnCollectible();
    }
    for (let i = collectibles.length - 1; i >= 0; i--) {
      const item = collectibles[i];
      item.x -= speedPxPerMs * dt;
      if (item.x + item.w < -10) {
        collectibles.splice(i, 1);
        continue;
      }
      if (rectsOverlap(player.x, player.y, player.w, player.h, item.x, item.y, item.w, item.h)) {
        bonusScore += item.type.points;
        gameState.bonus = bonusScore;
        collectibles.splice(i, 1);
      }
    }
  }

  function syncGameState(dt, baseSpeed) {
    fpsTracker.frameCount += 1;
    fpsTracker.totalTime += dt;
    gameState.running = running;
    gameState.distance = Math.floor(distance);
    gameState.bonus = bonusScore;
    gameState.totalScore = gameState.distance + gameState.bonus;
    gameState.obstacleCount = obstacles.length;
    gameState.collectibleCount = collectibles.length;
    gameState.baseSpeed = Math.round(baseSpeed);
    gameState.spawnInterval = Math.round(spawnInterval);
    gameState.fps = fpsTracker.totalTime
      ? Math.round((fpsTracker.frameCount * 1000) / fpsTracker.totalTime)
      : 0;
    gameState.nextItem = nextCollectible?.label || '—';
    gameState.lastCollisionAt = lastCollisionTs;
    gameState.lastCollisionReason = lastCollisionReason;
    if (canvasHolder) {
      canvasHolder.dataset.obstacles = `${obstacles.length}`;
      canvasHolder.dataset.collectibles = `${collectibles.length}`;
    }
  }

  function rectsOverlap(x1, y1, w1, h1, x2, y2, w2, h2) {
    return !(x1 + w1 < x2 || x1 > x2 + w2 || y1 + h1 < y2 || y1 > y2 + h2);
  }

  function doJump(heldMs = 0) {
    ensureGameRunning();
    if (!player.grounded) return;
    if (player.ducking) {
      endDuck();
    }
    const charge = Math.min(1, Math.max(0, heldMs / jumpChargeWindow));
    player.vy = baseJumpVel + (maxJumpVel - baseJumpVel) * charge;
    player.grounded = false;
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
    if (pointerState.active && pointerState.pointerId !== null && event.pointerId !== pointerState.pointerId) {
      return;
    }
    pointerState.active = true;
    pointerState.pointerId = event.pointerId;
    pointerState.startY = event.clientY;
    pointerState.startTs = performance.now();
    pointerState.swiped = false;
    event.preventDefault();
  }

  function handlePointerMove(event) {
    if (!pointerState.active || event.pointerId !== pointerState.pointerId) return;
    const deltaY = event.clientY - pointerState.startY;
    if (!pointerState.swiped && deltaY > 30) {
      pointerState.swiped = true;
      beginDuck();
    }
    if (pointerState.swiped) {
      event.preventDefault();
    }
  }

  function handlePointerEnd(event) {
    if (!pointerState.active) return;
    if (event && event.cancelable) {
      event.preventDefault();
    }
    if (pointerState.swiped) {
      endDuck();
      pointerState.active = false;
      pointerState.pointerId = null;
      return;
    }
    const heldMs = performance.now() - pointerState.startTs;
    doJump(heldMs);
    pointerState.active = false;
    pointerState.pointerId = null;
  }

  function handlePointerCancel() {
    if (pointerState.swiped) {
      endDuck();
    }
    pointerState.active = false;
    pointerState.pointerId = null;
  }

  function handleKeyDown(ev) {
    if (ev.code === 'Space' && !spaceHeld) {
      ev.preventDefault();
      spaceHeld = true;
      spaceStart = performance.now();
    }
    if (ev.code === 'ArrowDown') {
      ev.preventDefault();
      beginDuck();
    }
  }

  function handleKeyUp(ev) {
    if (ev.code === 'Space' && spaceHeld) {
      const heldMs = performance.now() - spaceStart;
      doJump(heldMs);
      spaceHeld = false;
    }
    if (ev.code === 'ArrowDown') {
      endDuck();
    }
  }

  function setupInput() {
    const holder = el('reindeer-canvas');
    if (!holder) return;
    holder.addEventListener('pointerdown', handlePointerDown, { passive: false });
    holder.addEventListener('pointermove', handlePointerMove, { passive: false });
    holder.addEventListener('pointerup', handlePointerEnd, { passive: false });
    holder.addEventListener('pointercancel', handlePointerCancel);
    holder.addEventListener('pointerleave', handlePointerCancel);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
  }

  function updateScene(dt) {
    distance += dt * 0.02;
    const baseSpeed = 180 + Math.min(650, distance * 0.18);
    const speedPxPerMs = baseSpeed / 1000;

    spawnTimer += dt;
    if (spawnTimer >= spawnInterval) {
      spawnTimer = 0;
      spawnObstacle();
      spawnInterval = Math.max(750, spawnInterval - 6);
    }

    for (let i = obstacles.length - 1; i >= 0; i--) {
      const obstacle = obstacles[i];
      obstacle.x -= speedPxPerMs * dt;
      if (obstacle.x + obstacle.w < -10) {
        obstacles.splice(i, 1);
      }
    }

    updateCollectibles(dt, speedPxPerMs);

    if (!player.grounded) {
      player.vy += 0.0018 * dt;
      player.y += player.vy * dt;
      const groundY = height - groundOffset - player.h;
      if (player.y >= groundY) {
        player.y = groundY;
        player.vy = 0;
        player.grounded = true;
      }
    }

    for (const obstacle of obstacles) {
      if (rectsOverlap(player.x, player.y, player.w, player.h, obstacle.x, obstacle.y, obstacle.w, obstacle.h)) {
        if (obstacle.type === 'duck' && player.ducking) {
          continue;
        }
        stopGame('collision-with-obstacle');
        break;
      }
    }

    syncGameState(dt, baseSpeed);
    drawScene();
    updateUI();
    if (running) {
      requestAnimationFrame(loop);
    }
  }

  function loop(ts) {
    if (!running) return;
    if (!lastTs) lastTs = ts;
    const dt = ts - lastTs;
    lastTs = ts;
    updateScene(dt);
  }

  function drawScene() {
    if (!ctx) return;
    ctx.clearRect(0, 0, width, height);

    ctx.fillStyle = '#e6f2ff';
    ctx.fillRect(0, 0, width, height - groundOffset);

    ctx.fillStyle = '#4f46e5';
    ctx.fillRect(0, height - groundOffset, width, groundOffset);
    ctx.strokeStyle = '#c7d2fe';
    ctx.beginPath();
    ctx.moveTo(0, height - groundOffset + 0.5);
    ctx.lineTo(width, height - groundOffset + 0.5);
    ctx.stroke();

    for (const obstacle of obstacles) {
      ctx.fillStyle = obstacle.color;
      ctx.fillRect(Math.round(obstacle.x), Math.round(obstacle.y), obstacle.w, obstacle.h);
    }

    for (const item of collectibles) {
      ctx.fillStyle = item.type.color;
      ctx.beginPath();
      ctx.ellipse(item.x + item.w / 2, item.y + item.h / 2, item.w / 2, item.h / 2, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = '#8b5cf6';
    ctx.fillRect(Math.round(player.x), Math.round(player.y), player.w, player.h);

    const holdTime = pointerState.active
      ? performance.now() - pointerState.startTs
      : spaceHeld
        ? performance.now() - spaceStart
        : 0;
    if (holdTime > 40 && !pointerState.swiped) {
      const progress = Math.min(1, holdTime / jumpChargeWindow);
      const arcRadius = player.w + 6;
      ctx.strokeStyle = '#facc15';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(player.x + player.w / 2, player.y - 4, arcRadius, Math.PI, Math.PI + Math.PI * progress);
      ctx.stroke();
    }

    ctx.fillStyle = '#0f172a';
    ctx.font = '13px system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial';
    ctx.fillText(`${Math.floor(distance)} m`, 12, 20);
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

  async function fetchLeaderboard() {
    return fetch('/api/scores/tredje-advent').then((r) => r.json()).catch(() => ({ scores: [] }));
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

  document.addEventListener('DOMContentLoaded', () => {
    initCanvas();
    setupInput();
    refreshLeaderboard();
    updateUI();
  });

  window.__reindeerRush__ = {
    startGame,
    stopGame,
    refreshLeaderboard,
    resetGame,
    getState: () => ({ ...gameState }),
    _state: gameState
  };
})();
