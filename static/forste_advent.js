// Christmas-themed Snake Game for Første Advent
(function () {
  const canvas = document.getElementById('snake-canvas');
  const ctx = canvas.getContext('2d');
  const scoreEl = document.getElementById('score');
  const statusEl = document.getElementById('status');

  const CELL = 20; // pixels per grid cell
  const GRID = { cols: canvas.width / CELL, rows: canvas.height / CELL };
  const SPEED_MS = 150; // tick speed

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

  // Snake represented as segments, each with x,y and optional skin (emoji)
  // Start length 5
  let snake = [
    { x: 7, y: 10 },
    { x: 6, y: 10 },
    { x: 5, y: 10 },
    { x: 4, y: 10 },
    { x: 3, y: 10 },
  ];
  let gift = placeGift();

  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function nextGiftSkin() {
    if (giftCycle.length === 0) giftCycle = shuffle([...PRESENT_EMOJI]);
    return giftCycle.pop();
  }

  function placeGift() {
    let gx, gy;
    do {
      gx = randInt(GRID.cols);
      gy = randInt(GRID.rows);
    } while (snake.some(seg => seg.x === gx && seg.y === gy));
    const skin = nextGiftSkin();
    return { x: gx, y: gy, skin };
  }

  function setStatus(text) {
    statusEl.textContent = text || '';
  }

  function drawGrid() {
    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = COLORS.grid;
    ctx.lineWidth = 1;
    for (let x = 0; x <= canvas.width; x += CELL) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
    }
    for (let y = 0; y <= canvas.height; y += CELL) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
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
    const px = gift.x * CELL;
    const py = gift.y * CELL;
    ctx.font = `${CELL - 4}px serif`;
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

    const head = { ...snake[0] };
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
    if (head.x === gift.x && head.y === gift.y) {
      // Grow: keep tail and mark new segment with gift skin
      snake[0].skin = gift.skin;
      score += 1;
      scoreEl.textContent = `Score: ${score}`;
      playEat();
      gift = placeGift();
    } else {
      // normal move: remove last segment
      snake.pop();
    }

    // Draw
    drawGrid();
    drawGift();
    drawSnake();
  }

  let timer = setInterval(tick, SPEED_MS);

  function gameOver() {
    running = false;
    clearInterval(timer);
    setStatus('Game Over! Try again 🎅');
    playDeath();
    // Submit score
    const nameInput = document.getElementById('player-name');
    const name = (nameInput && nameInput.value || 'Guest');
    submitScore('forste-advent', name, score).then(fetchScores);
  }

  window.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') pendingDirection = 'left';
    else if (e.key === 'ArrowRight') pendingDirection = 'right';
    else if (e.key === 'ArrowUp') pendingDirection = 'up';
    else if (e.key === 'ArrowDown') pendingDirection = 'down';
    playMove();
  });

  // Initial draw so the page isn't blank
  drawGrid();
  drawGift();
  drawSnake();

  // Debug hooks for Playwright tests
  window.__snakeDebug__ = {
    placeGiftNextToHead(dx = 1, dy = 0) {
      const h = snake[0];
      let nx = h.x + dx;
      let ny = h.y + dy;
      // clamp to grid
      nx = Math.max(0, Math.min(GRID.cols - 1, nx));
      ny = Math.max(0, Math.min(GRID.rows - 1, ny));
      gift = { x: nx, y: ny, skin: PRESENT_EMOJI[0] };
    },
    setDirection(dir) {
      pendingDirection = dir;
    },
    getSnakeLength() {
      return snake.length;
    },
  };
  // High score helpers
  async function fetchScores() {
    try {
      const resp = await fetch('/api/scores/forste-advent');
      const data = await resp.json();
      const list = document.getElementById('high-scores');
      if (!list) return;
      list.innerHTML = '';
      for (const item of data.scores) {
        const li = document.createElement('li');
        li.textContent = `${item.name} — ${item.score}`;
        list.appendChild(li);
      }
    } catch (e) {
      console.error('Failed to fetch scores', e);
    }
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

  fetchScores();

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
