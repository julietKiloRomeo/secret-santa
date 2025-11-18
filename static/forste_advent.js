// Christmas-themed Snake Game for Første Advent
(function () {
  const canvas = document.getElementById('snake-canvas');
  const ctx = canvas.getContext('2d');
  const scoreEl = document.getElementById('score');
  const statusEl = document.getElementById('status');
  const defaultPlayerName = window.__defaultPlayerName__ || 'Guest';

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

  // Responsive resize: set canvas pixel size and compute CELL/GRID
  function resizeCanvasAndGrid() {
    // Ensure the canvas fills its container width
    try { canvas.style.width = '100%'; } catch (e) {}
    const displayWidth = Math.max(64, Math.floor(canvas.parentElement ? canvas.parentElement.clientWidth : window.innerWidth * 0.9));
    const DPR = window.devicePixelRatio || 1;
    canvas.width = Math.round(displayWidth * DPR);
    canvas.height = Math.round(displayWidth * DPR);
    // Make drawing units match CSS pixels by applying transform
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);

    CELL = Math.max(6, Math.floor(displayWidth / NUM_COLS));
    GRID = { cols: NUM_COLS, rows: Math.floor(displayWidth / CELL) };
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
    statusEl.textContent = text || '';
  }

  function drawGrid() {
    // Background / grid drawn in CSS pixels (ctx is transformed)
    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, canvas.clientWidth, canvas.clientHeight);

    ctx.strokeStyle = COLORS.grid;
    ctx.lineWidth = 1;
    for (let x = 0; x <= canvas.clientWidth; x += CELL) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.clientHeight);
      ctx.stroke();
    }
    for (let y = 0; y <= canvas.clientHeight; y += CELL) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.clientWidth, y);
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
      scoreEl.textContent = `Score: ${score}`;
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

  async function gameOver() {
    running = false;
    clearInterval(timer);
    setStatus('Game Over! Try igen 🎅');
    playDeath();
    // Determine if high score and prompt for name if so, then show list
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
          await submitScore('forste-advent', name, score);
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

  window.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') pendingDirection = 'left';
    else if (e.key === 'ArrowRight') pendingDirection = 'right';
    else if (e.key === 'ArrowUp') pendingDirection = 'up';
    else if (e.key === 'ArrowDown') pendingDirection = 'down';
    playMove();
  });

  // Mobile controls: touch arrows and swipe
  function createMobileControls() {
    const container = canvas.parentElement || document.body;
    try { container.style.position = container.style.position || 'relative'; } catch (e) {}
    // Avoid duplicate
    if (document.getElementById('snake-controls')) return;
    const controls = document.createElement('div');
    controls.id = 'snake-controls';
    controls.style.position = 'absolute';
    controls.style.left = '50%';
    controls.style.bottom = '8px';
    controls.style.transform = 'translateX(-50%)';
    controls.style.zIndex = 1200;
    // Cross layout: 3x3 grid with empty center
    controls.style.display = 'grid';
    controls.style.gridTemplateColumns = '48px 48px 48px';
    controls.style.gridTemplateRows = '48px 48px 48px';
    controls.style.gap = '8px';
    controls.style.justifyItems = 'center';
    controls.style.alignItems = 'center';

    const mkCell = (content) => {
      const cell = document.createElement('div');
      cell.style.width = '48px';
      cell.style.height = '48px';
      cell.style.display = 'flex';
      cell.style.justifyContent = 'center';
      cell.style.alignItems = 'center';
      if (!content) return cell;
      const b = document.createElement('button');
      b.textContent = content.glyph;
      b.setAttribute('data-dir', content.dir);
      b.style.fontSize = '20px';
      b.style.width = '44px';
      b.style.height = '44px';
      b.style.borderRadius = '8px';
      b.style.border = 'none';
      b.style.background = 'rgba(255,255,255,0.06)';
      b.style.color = '#fff';
      b.addEventListener('touchstart', (ev) => { ev.preventDefault(); pendingDirection = b.getAttribute('data-dir'); playMove(); });
      b.addEventListener('mousedown', (ev) => { ev.preventDefault(); pendingDirection = b.getAttribute('data-dir'); playMove(); });
      cell.appendChild(b);
      return cell;
    };

    // Row 1: placeholder, up, placeholder
    controls.appendChild(mkCell(null));
    controls.appendChild(mkCell({ dir: 'up', glyph: '⬆' }));
    controls.appendChild(mkCell(null));
    // Row 2: left, center(empty), right
    controls.appendChild(mkCell({ dir: 'left', glyph: '⬅' }));
    controls.appendChild(mkCell(null));
    controls.appendChild(mkCell({ dir: 'right', glyph: '➡' }));
    // Row 3: placeholder, down, placeholder
    controls.appendChild(mkCell(null));
    controls.appendChild(mkCell({ dir: 'down', glyph: '⬇' }));
    controls.appendChild(mkCell(null));

    container.appendChild(controls);
  }

  // Swipe support
  let touchStart = null;
  canvas.addEventListener('touchstart', (ev) => {
    if (!ev.touches || ev.touches.length !== 1) return;
    const t = ev.touches[0];
    touchStart = { x: t.clientX, y: t.clientY, t: Date.now() };
  }, { passive: true });
  canvas.addEventListener('touchend', (ev) => {
    if (!touchStart) return;
    const t = ev.changedTouches[0];
    const dx = t.clientX - touchStart.x;
    const dy = t.clientY - touchStart.y;
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 20) {
      pendingDirection = dx > 0 ? 'right' : 'left';
    } else if (Math.abs(dy) > 20) {
      pendingDirection = dy > 0 ? 'down' : 'up';
    }
    playMove();
    touchStart = null;
  }, { passive: true });

  // Recompute sizes on resize
  window.addEventListener('resize', () => {
    const wasRunning = running;
    running = false;
    if (timer) clearInterval(timer);
    resizeCanvasAndGrid();
    initSnakeAndGift();
    drawGrid();
    drawGift();
    drawSnake();
    createMobileControls();
    if (wasRunning) {
      running = true;
      startTimer();
    }
  });

  // Initial draw so the page isn't blank
  // Initial setup: resize, init snake/gift, controls and start timer
  resizeCanvasAndGrid();
  initSnakeAndGift();
  drawGrid();
  drawGift();
  drawSnake();
  createMobileControls();
  startTimer();

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
    tickOnce() { tick(); },
    getSkinsFiltered() { return snake.slice(1).map(s => s.skin).filter(Boolean); },
    setNextGiftSkin(skin) { forcedNextSkin = skin; },
  };
  // Overlay + High score helpers
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
    const resp = await fetch('/api/scores/forste-advent');
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
})();
