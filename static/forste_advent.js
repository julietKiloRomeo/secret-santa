// Christmas-themed Snake Game for Første Advent
(function () {
  const canvas = document.getElementById('snake-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const scoreEl = document.getElementById('score');
  const statusEl = document.getElementById('status');
  const stageEl = document.getElementById('snake-stage');

  // Responsive grid: keep number of columns consistent and compute cell size
  const NUM_COLS = 20;
  let CELL = 20; // computed per-resize (CSS pixels)
  let GRID = { cols: NUM_COLS, rows: 20 };
  const SPEED_MS = 150; // tick speed (ms) -- unchanged for gameplay feel

  const COLORS = {
    bg: '#002',
    grid: '#114',
    snake: '#2c8a2c',
    snakeEdge: '#1e5e1e',
  };

  const PRESENT_EMOJI = ['🎁', '🍬', '🧦', '🍪', '🍫', '🧸'];
  const RESTART_KEYS = new Set(['Space', 'Enter', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);
  let giftCycle = shuffle([...PRESENT_EMOJI]);

  function randInt(n) { return Math.floor(Math.random() * n); }

  let direction = 'right';
  let pendingDirection = direction;
  let score = 0;
  let running = true;
  let skinQueue = [];

  // Snake represented as segments, each with x,y and optional skin (emoji)
  // Start length 5
  let snake = [];
  let forcedNextSkin = null;
  let gift = null;
  const swipeState = { pointerId: null, startX: 0, startY: 0 };

  activateArcadeMode();

  // Responsive resize: set canvas pixel size and compute CELL/GRID
  function resizeCanvasAndGrid() {
    // Ensure the canvas fills its container width and prefer the canvas's
    // actual rendered width (clientWidth) when computing the grid so that
    // CELL/GRID match what is actually visible on screen.
    try { canvas.style.width = '100%'; } catch (e) {}
    const computedClientWidth = canvas.clientWidth || (canvas.parentElement ? canvas.parentElement.clientWidth : Math.floor(window.innerWidth * 0.9));
    const displayWidth = Math.max(64, Math.floor(computedClientWidth));
    const DPR = window.devicePixelRatio || 1;
    canvas.width = Math.round(displayWidth * DPR);
    canvas.height = Math.round(displayWidth * DPR);
    // Make drawing units match CSS pixels by applying transform
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);

    CELL = Math.max(6, Math.floor(displayWidth / NUM_COLS));
    // Use floor so we never advertise rows that extend beyond the rendered
    // playfield; this keeps the bottom edge aligned with the visible grid.
    GRID = { cols: NUM_COLS, rows: Math.max(10, Math.floor(displayWidth / CELL)) };
  }

  function initSnakeAndGift() {
    // centre the snake in the grid
    const cx = Math.floor(GRID.cols / 2);
    const cy = Math.floor(GRID.rows / 2);
    snake = [];
    for (let i = 0; i < 5; i++) {
      snake.push({ x: cx - i, y: cy, skin: null });
    }
    gift = placeGift();
  }

  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function nextGiftSkin() {
    if (forcedNextSkin) {
      const s = forcedNextSkin;
      forcedNextSkin = null;
      return s;
    }
    if (giftCycle.length === 0) giftCycle = shuffle([...PRESENT_EMOJI]);
    return giftCycle.pop();
  }

  function placeGift() {
    let gx, gy;
    // Ensure GRID has been computed
    const cols = GRID.cols || NUM_COLS;
    const rows = GRID.rows || NUM_COLS;
    do {
      gx = randInt(cols);
      gy = randInt(rows);
    } while (snake.some(seg => seg.x === gx && seg.y === gy));
    const skin = nextGiftSkin();
    return { x: gx, y: gy, skin };
  }

  function setStatus(text) {
    if (statusEl) {
      statusEl.textContent = text || '';
    }
  }

  function drawGrid() {
    // Clear the entire surface and draw the background so no stale pixels
    // remain (previously some areas outside the computed grid were left
    // untouched causing colored squares to stick around).
    const totalWidth = GRID.cols * CELL;
    const totalHeight = GRID.rows * CELL;

    // Clear using device-pixel coordinates to ensure nothing is left in the
    // backing store. We temporarily reset the transform so clearRect clears
    // the full canvas buffer (which is in device pixels via canvas.width/height),
    // then restore the transform used for drawing in CSS pixels.
    try {
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    } finally {
      ctx.restore();
    }

    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, canvas.clientWidth, canvas.clientHeight);

    ctx.strokeStyle = COLORS.grid;
    ctx.lineWidth = 1;
    // Draw vertical lines across the computed grid area
    for (let x = 0; x <= totalWidth; x += CELL) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, totalHeight);
      ctx.stroke();
    }
    // Draw horizontal lines across the computed grid area
    for (let y = 0; y <= totalHeight; y += CELL) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(totalWidth, y);
      ctx.stroke();
    }
  }

  function drawSnake() {
    snake.forEach((seg, idx) => {
      const px = seg.x * CELL;
      const py = seg.y * CELL;
      // base body
      ctx.fillStyle = COLORS.snake;
      ctx.fillRect(px + 2, py + 2, CELL - 4, CELL - 4);
      ctx.strokeStyle = COLORS.snakeEdge;
      ctx.strokeRect(px + 2, py + 2, CELL - 4, CELL - 4);
      // Draw present skin if this segment was grown from a gift
      if (seg.skin && idx !== 0) { // never draw skin on head
        ctx.font = `${CELL - 4}px serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(seg.skin, px + CELL / 2, py + CELL / 2);
      }
    });
  }

  function drawGift() {
    if (!gift) return;
    const px = gift.x * CELL;
    const py = gift.y * CELL;
    ctx.font = `${Math.max(8, CELL - 4)}px serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(gift.skin, px + CELL / 2, py + CELL / 2);
  }

  function tick() {
    if (!running) return;
    // Update direction if a new one is pending and not reversing
    const opposites = { left: 'right', right: 'left', up: 'down', down: 'up' };
    if (pendingDirection && opposites[pendingDirection] !== direction) {
      direction = pendingDirection;
    }

    // Create a fresh head without inheriting body skins
    const head = { x: snake[0].x, y: snake[0].y, skin: null };
    if (direction === 'left') head.x -= 1;
    else if (direction === 'right') head.x += 1;
    else if (direction === 'up') head.y -= 1;
    else if (direction === 'down') head.y += 1;

    // Collisions: walls
    if (head.x < 0 || head.x >= GRID.cols || head.y < 0 || head.y >= GRID.rows) {
      return gameOver();
    }
    // Collisions: self
    if (snake.some(seg => seg.x === head.x && seg.y === head.y)) {
      return gameOver();
    }

    // Move
    snake.unshift(head);
    if (gift && head.x === gift.x && head.y === gift.y) {
      // Grow: keep tail and record gift in queue preserving order
      skinQueue.push(gift.skin);
      score += 1;
      if (scoreEl) {
        scoreEl.textContent = `Score: ${score}`;
      }
      playEat();
      gift = placeGift();
    } else {
      // normal move: remove last segment
      snake.pop();
    }

    // Draw
    applySkinsFromQueue();
    drawGrid();
    drawGift();
    drawSnake();
  }

  // Start the ticker
  let timer = null;
  function startTimer() {
    if (timer) clearInterval(timer);
    timer = setInterval(tick, SPEED_MS);
  }

  function resetSwipeState() {
    swipeState.pointerId = null;
    swipeState.startX = 0;
    swipeState.startY = 0;
  }

  function prepareBoard(statusMessage) {
    direction = 'right';
    pendingDirection = direction;
    score = 0;
    skinQueue = [];
    forcedNextSkin = null;
    gift = null;
    if (scoreEl) {
      scoreEl.textContent = 'Score: 0';
    }
    if (typeof statusMessage === 'string') {
      setStatus(statusMessage);
    }
    initSnakeAndGift();
    drawGrid();
    drawGift();
    drawSnake();
    resetSwipeState();
  }

  function restartGame() {
    prepareBoard('Klar! Tap eller brug piletasterne.');
    running = true;
    if (timer) clearInterval(timer);
    startTimer();
  }

  function debugStop(message = 'Pause') {
    running = false;
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
    setStatus(message);
  }

  async function gameOver() {
    running = false;
    clearInterval(timer);
    setStatus('Game Over! Tryk Space, pil eller tap for at prøve igen 🎅');
    playDeath();
    if (window.arcadeOverlay) {
      try {
        await window.arcadeOverlay.handleHighScoreFlow({
          gameId: 'forste-advent',
          score,
          allowSkip: true,
          title: 'Ny high score!',
        });
      } catch (e) {
        console.error('Arcade high score flow failed', e);
      }
    }
  }

  window.addEventListener('keydown', (e) => {
    if (!running && RESTART_KEYS.has(e.code)) {
      restartGame();
    }
    if (e.code === 'Space') {
      e.preventDefault();
      return;
    }
    if (e.key === 'ArrowLeft') pendingDirection = 'left';
    else if (e.key === 'ArrowRight') pendingDirection = 'right';
    else if (e.key === 'ArrowUp') pendingDirection = 'up';
    else if (e.key === 'ArrowDown') pendingDirection = 'down';
    playMove();
  });

  // Pointer-based swipe support
  canvas.style.touchAction = 'none';
  function handlePointerDown(ev) {
    if (swipeState.pointerId !== null && swipeState.pointerId !== ev.pointerId) return;
    if (ev.pointerType === 'mouse' && ev.button !== 0) return;
    if (!running) {
      restartGame();
    }
    swipeState.pointerId = ev.pointerId;
    swipeState.startX = ev.clientX;
    swipeState.startY = ev.clientY;
    if (ev.cancelable) ev.preventDefault();
  }

  function handlePointerMove(ev) {
    if (swipeState.pointerId !== ev.pointerId) return;
    if (ev.cancelable) ev.preventDefault();
  }

  function handlePointerUp(ev) {
    if (swipeState.pointerId !== ev.pointerId) return;
    if (ev.cancelable) ev.preventDefault();
    const dx = ev.clientX - swipeState.startX;
    const dy = ev.clientY - swipeState.startY;
    applySwipe(dx, dy);
    resetSwipe();
  }

  function handlePointerCancel(ev) {
    if (swipeState.pointerId !== ev.pointerId) return;
    resetSwipe();
  }

  function resetSwipe() {
    resetSwipeState();
  }

  function applySwipe(dx, dy) {
    const absX = Math.abs(dx);
    const absY = Math.abs(dy);
    const threshold = 24;
    if (absX < threshold && absY < threshold) return;
    const next = absX > absY ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
    pendingDirection = next;
    playMove();
  }

  canvas.addEventListener('pointerdown', handlePointerDown, { passive: false });
  canvas.addEventListener('pointermove', handlePointerMove, { passive: false });
  canvas.addEventListener('pointerup', handlePointerUp, { passive: false });
  canvas.addEventListener('pointerleave', handlePointerCancel);
  canvas.addEventListener('pointercancel', handlePointerCancel);

  // Recompute sizes on resize
  window.addEventListener('resize', () => {
    const wasRunning = running;
    running = false;
    if (timer) clearInterval(timer);
    resizeCanvasAndGrid();
    prepareBoard(wasRunning ? 'Klar! Tap eller brug piletasterne.' : undefined);
    if (wasRunning) {
      running = true;
      startTimer();
    }
  });

  // Initial draw so the page isn't blank
  // Initial setup: resize, init snake/gift, controls and start timer
  resizeCanvasAndGrid();
  restartGame();

  function applySkinsFromQueue() {
    // Clear all skins first
    for (let i = 0; i < snake.length; i++) {
      snake[i].skin = null;
    }
    const max = Math.min(skinQueue.length, snake.length - 1);
    for (let j = 0; j < max; j++) {
      snake[j + 1].skin = skinQueue[j];
    }
  }

  // Debug hooks for Playwright tests
  window.__snakeDebug__ = {
    placeGiftNextToHead(dx = 1, dy = 0) {
      const h = snake[0];
      let nx = h.x + dx;
      let ny = h.y + dy;
      // clamp to grid
      nx = Math.max(0, Math.min(GRID.cols - 1, nx));
      ny = Math.max(0, Math.min(GRID.rows - 1, ny));
      gift = { x: nx, y: ny, skin: nextGiftSkin() };
    },
    setDirection(dir) {
      pendingDirection = dir;
    },
    getSnakeLength() {
      return snake.length;
    },
    getSnakeCoords() { return snake.map(s => ({ x: s.x, y: s.y })); },
    tickOnce() { tick(); },
    getSkinsFiltered() { return snake.slice(1).map(s => s.skin).filter(Boolean); },
    setNextGiftSkin(skin) { forcedNextSkin = skin; },
    getDirection() { return direction; },
    getPendingDirection() { return pendingDirection; },
    getGrid() { return { cols: GRID.cols, rows: GRID.rows, cell: CELL }; },
    rerollGift() { gift = placeGift(); return gift ? { x: gift.x, y: gift.y } : null; },
    debugStop(message) { debugStop(message); },
    isRunning() { return running; },
    restartGame() { restartGame(); },
  };

  // No initial high score list; shown after game over.

  // Sound effects via WebAudio
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  const audioCtx = AudioCtx ? new AudioCtx() : null;
  function beep(freq, durationMs, type = 'sine', gain = 0.02) {
    if (!audioCtx) return;
    const osc = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gainNode.gain.value = gain;
    osc.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    osc.start();
    setTimeout(() => {
      osc.stop();
      osc.disconnect();
      gainNode.disconnect();
    }, durationMs);
  }
  function playMove() { beep(440, 40, 'square', 0.01); }
  function playEat() { beep(880, 120, 'sine', 0.03); setTimeout(() => beep(1320, 120, 'sine', 0.02), 120); }
  function playDeath() { beep(220, 400, 'sawtooth', 0.03); }

  function activateArcadeMode() {
    const body = document.body;
    if (!body) return;
    body.classList.add('arcade-fullscreen');
    body.dataset.arcadeGame = 'forste-advent';
    if (stageEl) {
      stageEl.dataset.arcadeGame = 'forste-advent';
      stageEl.style.touchAction = 'none';
    }
    const cleanup = () => {
      body.classList.remove('arcade-fullscreen');
      if (body.dataset.arcadeGame === 'forste-advent') {
        delete body.dataset.arcadeGame;
      }
    };
    window.addEventListener('pagehide', cleanup, { once: true });
    window.addEventListener('beforeunload', cleanup);
  }
})();
