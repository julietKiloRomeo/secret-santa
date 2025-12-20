(function () {
  if (typeof window === 'undefined') return;
  if (window.arcadeOverlay) return;

  const STYLE_ID = 'arcade-overlay-styles';
  const OVERLAY_ID = 'arcade-overlay';
  const LEADERBOARD_LIMIT = 10;
  const DEFAULT_GAMES = ['forste-advent', 'anden-advent', 'tredje-advent', 'fjerde-advent'];
  const GAME_LABELS = {
    'forste-advent': 'Første Advent — Snake',
    'anden-advent': 'Anden Advent — Flappy Santa',
    'tredje-advent': 'Tredje Advent — Jingle Bell Hero',
    'fjerde-advent': 'Fjerde Advent — Reindeer Rush',
    'reindeer-rush': 'Reindeer Rush',
  };
  let overlayEl = null;
  let keyHandler = null;
  let activeResolver = null;
  let overlayLocked = false;
  let overlayPointerHandler = null;
  let overlayPointerHost = null;
  const OVERLAY_GUARD_KEYS = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);

  function swallowGameNavigationKeys(event) {
    if (!event) return false;
    if (!OVERLAY_GUARD_KEYS.has(event.key)) return false;
    if (typeof event.stopPropagation === 'function') {
      event.stopPropagation();
    }
    if (typeof event.stopImmediatePropagation === 'function') {
      event.stopImmediatePropagation();
    }
    return true;
  }

  function normalizeGameId(value) {
    if (!value) return '';
    const raw = String(value).trim().toLowerCase();
    if (raw === 'reindeer-rush') return 'fjerde-advent';
    return raw;
  }

  function friendlyGameName(gameId) {
    const key = normalizeGameId(gameId);
    return GAME_LABELS[key] || key.replace(/-/g, ' ');
  }

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      body.arcade-overlay-open {
        overflow: hidden;
      }
      #${OVERLAY_ID} {
        position: fixed;
        inset: 0;
        display: none;
        align-items: center;
        justify-content: center;
        background: radial-gradient(circle at top, rgba(10, 15, 40, 0.95), rgba(2, 4, 12, 0.92));
        z-index: 2000;
        backdrop-filter: blur(3px);
        touch-action: none;
      }
      #${OVERLAY_ID}.visible { display: flex; }
      .arcade-panel {
        background: linear-gradient(180deg, rgba(0, 0, 0, 0.95), rgba(4, 10, 20, 0.98));
        border: 3px solid #25ffe0;
        box-shadow: 0 0 20px rgba(37, 255, 224, 0.55), inset 0 0 10px rgba(0, 255, 170, 0.3);
        padding: 1.5rem;
        font-family: 'Press Start 2P', 'VT323', 'Space Mono', monospace;
        color: #defef7;
        text-shadow: 0 0 6px rgba(37, 255, 224, 0.8);
        max-width: min(90vw, 520px);
        width: 100%;
        border-radius: 12px;
      }
      .arcade-panel h2 {
        margin: 0 0 1rem;
        text-align: center;
        font-size: clamp(1.1rem, 3vw, 1.5rem);
        letter-spacing: 1px;
      }
      .arcade-panel p {
        margin: 0.25rem 0;
        font-size: 0.85rem;
        opacity: 0.85;
      }
      .arcade-panel button {
        background: #25ffe0;
        color: #021012;
        border: none;
        border-radius: 8px;
        font-weight: 700;
        padding: 0.75rem 1rem;
        font-size: 0.9rem;
        cursor: pointer;
        width: 100%;
        margin-top: 1rem;
        box-shadow: 0 0 12px rgba(37, 255, 224, 0.8);
        touch-action: manipulation;
      }
      .arcade-panel button:hover {
        background: #2dffe9;
      }
      .arcade-input-wrapper {
        position: relative;
        margin-top: 0.75rem;
      }
      .arcade-inline-input-wrapper {
        position: relative;
        flex: 1;
        margin-top: 0;
      }
      .arcade-input {
        width: 100%;
        padding: 0.75rem 1rem;
        border-radius: 8px;
        border: 2px solid rgba(37, 255, 224, 0.6);
        background: rgba(0, 6, 12, 0.85);
        color: #defef7;
        font-size: 1rem;
        font-family: 'Press Start 2P', 'VT323', 'Space Mono', monospace;
        letter-spacing: 1px;
        caret-color: #25ffe0;
        box-shadow: inset 0 0 12px rgba(37, 255, 224, 0.25);
        touch-action: manipulation;
      }
      .arcade-input:focus {
        outline: none;
        border-color: #25ffe0;
        box-shadow: 0 0 14px rgba(37, 255, 224, 0.6), inset 0 0 14px rgba(37, 255, 224, 0.25);
      }
      .arcade-caret {
        position: absolute;
        right: 1rem;
        top: 50%;
        transform: translateY(-50%);
        width: 2px;
        height: 1.3rem;
        background: #25ffe0;
        animation: arcadeCaretBlink 1s step-start infinite;
        pointer-events: none;
      }
      .arcade-inline-input-wrapper .arcade-caret {
        right: 0.65rem;
        height: 1rem;
      }
      @keyframes arcadeCaretBlink {
        0%, 50% { opacity: 1; }
        50.1%, 100% { opacity: 0; }
      }
      .arcade-scores {
        margin: 1rem 0 0.5rem;
        padding: 0;
        list-style: none;
      }
      .arcade-scores li {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 0.5rem;
        padding: 0.35rem 0;
        border-bottom: 1px solid rgba(37, 255, 224, 0.15);
        font-size: 0.85rem;
      }
      .arcade-score-left {
        display: flex;
        align-items: center;
        gap: 0.35rem;
        flex: 1;
        min-width: 0;
      }
      .arcade-score-rank {
        font-weight: 700;
        white-space: nowrap;
      }
      .arcade-score-name {
        flex: 1;
        min-width: 0;
        display: flex;
        align-items: center;
        gap: 0.25rem;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .arcade-score-points {
        font-weight: 700;
        white-space: nowrap;
      }
      .arcade-pending-entry {
        background: rgba(37, 255, 224, 0.08);
      }
      .arcade-highlight-entry {
        background: rgba(37, 255, 224, 0.18);
        box-shadow: inset 0 0 0 1px rgba(37, 255, 224, 0.4);
      }
      .arcade-carousel-nav {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.75rem;
        margin-top: 0.75rem;
      }
      .arcade-carousel-btn {
        flex: none;
        min-width: 2.5rem;
        padding: 0.35rem 0.5rem;
        border-radius: 8px;
        background: rgba(37, 255, 224, 0.15);
        border: 1px solid rgba(37, 255, 224, 0.4);
        color: #defef7;
        font-weight: 600;
        cursor: pointer;
      }
      .arcade-carousel-btn:hover {
        background: rgba(37, 255, 224, 0.25);
      }
      .arcade-carousel-label {
        flex: 1;
        text-align: center;
        font-size: 0.85rem;
        letter-spacing: 0.02em;
        color: #defef7;
      }
    `;
    document.head.appendChild(style);
  }

  function ensureOverlay() {
    if (overlayEl) return overlayEl;
    injectStyles();
    overlayEl = document.createElement('div');
    overlayEl.id = OVERLAY_ID;
    document.body.appendChild(overlayEl);
    return overlayEl;
  }

  function showOverlay(content) {
    const host = ensureOverlay();
    host.innerHTML = '';
    host.appendChild(content);
    host.classList.add('visible');
    if (document.body) {
      document.body.classList.add('arcade-overlay-open');
    }
  }

  function hideOverlay(force = false) {
    if (overlayLocked && !force) {
      return false;
    }
    if (overlayEl) overlayEl.classList.remove('visible');
    if (overlayEl) overlayEl.innerHTML = '';
    if (document.body) {
      document.body.classList.remove('arcade-overlay-open');
    }
    if (overlayPointerHandler && overlayPointerHost) {
      overlayPointerHost.removeEventListener('pointerdown', overlayPointerHandler);
      overlayPointerHandler = null;
      overlayPointerHost = null;
    }
    if (keyHandler) {
      window.removeEventListener('keydown', keyHandler, true);
      keyHandler = null;
    }
    if (activeResolver) {
      activeResolver(null);
      activeResolver = null;
    }
    overlayLocked = false;
    return true;
  }

  function arcadePanel() {
    const panel = document.createElement('div');
    panel.className = 'arcade-panel';
    return panel;
  }

  function arcadeTitle(text) {
    const h = document.createElement('h2');
    h.textContent = text;
    return h;
  }

  async function fetchScores(gameId) {
    const resp = await fetch(`/api/scores/${gameId}`);
    if (!resp.ok) throw new Error('Failed to fetch scores');
    return resp.json();
  }

  async function submitScore(gameId, name, score) {
    const resp = await fetch(`/api/scores/${gameId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, score }),
    });
    return resp.ok;
  }

  function renderScoresList(scores, options = {}) {
    const limit =
      typeof options.limit === 'number' && options.limit > 0 ? options.limit : LEADERBOARD_LIMIT;
    const pendingIndex =
      typeof options.pendingIndex === 'number' && options.pendingIndex >= 0
        ? options.pendingIndex
        : null;
    const pendingScore =
      typeof options.pendingScore === 'number' ? options.pendingScore : null;
    const pendingLabel =
      typeof options.pendingLabel === 'string' && options.pendingLabel.trim()
        ? options.pendingLabel.trim()
        : 'Din score';
    const highlightMatcher =
      typeof options.highlightMatcher === 'function' ? options.highlightMatcher : null;
    const rows = Array.isArray(scores) ? scores.slice() : [];
    let pendingRendered = false;
    if (pendingIndex !== null) {
      const pendingEntry = {
        name: '',
        score: pendingScore,
        pending: true,
      };
      if (pendingIndex >= rows.length) {
        rows.push(pendingEntry);
      } else {
        rows.splice(pendingIndex, 0, pendingEntry);
      }
    }
    const ol = document.createElement('ol');
    ol.className = 'arcade-scores';
    rows.slice(0, limit).forEach((entry, idx) => {
      const li = document.createElement('li');
      li.className = 'arcade-score-row';
      const rankLabel = String(idx + 1).padStart(2, '0');
      const left = document.createElement('div');
      left.className = 'arcade-score-left';
      const rank = document.createElement('span');
      rank.className = 'arcade-score-rank';
      rank.textContent = `${rankLabel} — `;
      left.appendChild(rank);
      const nameSpan = document.createElement('span');
      nameSpan.className = 'arcade-score-name';
      if (entry && entry.pending) {
        pendingRendered = true;
        li.classList.add('arcade-pending-entry');
        if (options.pendingWrapper) {
          nameSpan.appendChild(options.pendingWrapper);
        } else {
          nameSpan.textContent = '';
        }
      } else {
        nameSpan.textContent = entry && entry.name ? entry.name : '???';
      }
      left.appendChild(nameSpan);
      if (highlightMatcher && !entry?.pending && highlightMatcher(entry, idx)) {
        li.classList.add('arcade-highlight-entry');
      }
      const right = document.createElement('span');
      right.className = 'arcade-score-points';
      right.textContent =
        entry && typeof entry.score === 'number' && Number.isFinite(entry.score)
          ? entry.score
          : '-';
      li.appendChild(left);
      li.appendChild(right);
      ol.appendChild(li);
    });
    if (options.pendingWrapper && !pendingRendered) {
      const li = document.createElement('li');
      li.className = 'arcade-score-row arcade-pending-entry';
      const left = document.createElement('div');
      left.className = 'arcade-score-left';
      const rank = document.createElement('span');
      rank.className = 'arcade-score-rank';
      rank.textContent = `${pendingLabel}: `;
      left.appendChild(rank);
      const nameSpan = document.createElement('span');
      nameSpan.className = 'arcade-score-name';
      nameSpan.appendChild(options.pendingWrapper);
      left.appendChild(nameSpan);
      const right = document.createElement('span');
      right.className = 'arcade-score-points';
      right.textContent =
        typeof pendingScore === 'number' && Number.isFinite(pendingScore) ? pendingScore : '-';
      li.appendChild(left);
      li.appendChild(right);
      ol.appendChild(li);
    }
    return ol;
  }

  function scoreInsertIndex(scores, score, limit = LEADERBOARD_LIMIT) {
    const list = Array.isArray(scores) ? scores : [];
    const cappedLimit = typeof limit === 'number' && limit > 0 ? limit : LEADERBOARD_LIMIT;
    if (!list.length) return 0;
    const value = typeof score === 'number' && Number.isFinite(score) ? score : 0;
    const upperBound = Math.min(list.length, cappedLimit);
    for (let i = 0; i < upperBound; i += 1) {
      const entryScore =
        list[i] && typeof list[i].score === 'number' ? list[i].score : -Infinity;
      if (value > entryScore) {
        return i;
      }
    }
    return Math.min(list.length, Math.max(cappedLimit - 1, 0));
  }

  function qualifiesWithinScores(scores, score, limit = LEADERBOARD_LIMIT) {
    if (!score || score <= 0) return false;
    const list = Array.isArray(scores) ? scores : [];
    const limitValue = typeof limit === 'number' && limit > 0 ? limit : LEADERBOARD_LIMIT;
    if (list.length < limitValue) return true;
    const lowest = list[Math.min(list.length, limitValue) - 1];
    const lowestScore = lowest && typeof lowest.score === 'number' ? lowest.score : -Infinity;
    return score > lowestScore;
  }

  async function loadScores(gameId, fallback = []) {
    try {
      const data = await fetchScores(gameId);
      if (data && Array.isArray(data.scores)) {
        return data.scores;
      }
      return Array.isArray(fallback) ? fallback : [];
    } catch (err) {
      console.error('Failed to load scores for', gameId, err);
      return Array.isArray(fallback) ? fallback : [];
    }
  }

  async function playerQualifies(gameId, score, limit = LEADERBOARD_LIMIT) {
    if (!score || score <= 0) return false;
    const scores = await loadScores(gameId);
    return qualifiesWithinScores(scores, score, limit);
  }

  function showLeaderboardPanel({
    gameId,
    score,
    allowEntry = false,
    allowSkip = true,
    title,
    message,
    initialScores = null,
  }) {
    if (activeResolver) {
      activeResolver(null);
      activeResolver = null;
    }
    const panel = arcadePanel();
    panel.appendChild(arcadeTitle(title || 'Søde Børn'));
    if (message) {
      const msg = document.createElement('p');
      msg.textContent = message;
      msg.style.textAlign = 'center';
      msg.style.marginBottom = '0.75rem';
      panel.appendChild(msg);
    }
    if (typeof score === 'number' && !Number.isNaN(score) && score > 0) {
      const summary = document.createElement('p');
      summary.textContent = `Din score: ${Math.floor(score)} pts`;
      summary.style.textAlign = 'center';
      summary.style.fontSize = '0.85rem';
      summary.style.opacity = '0.85';
      panel.appendChild(summary);
    }

    const listHost = document.createElement('div');
    panel.appendChild(listHost);

    const overlayHost = ensureOverlay();

    let input = null;
    let inputWrapper = null;
    let saveBtn = null;
    let helperLine = null;
    let statusLine = null;
    let saving = false;
    let entryActive = allowEntry && typeof score === 'number' && score > 0;
    overlayLocked = entryActive;
    let latestScores = Array.isArray(initialScores)
      ? initialScores.slice(0, LEADERBOARD_LIMIT)
      : [];
    let pointerHandler = null;
    let pendingOutsideLeaderboard = false;
    let lastSavedEntry = null;

    function updateHelperLegend() {
      if (!helperLine || !entryActive) return;
      helperLine.textContent = pendingOutsideLeaderboard
        ? 'Top 10 er fyldt, men din score bliver gemt – tryk Enter for at gemme.'
        : 'Skriv dit navn på listen og tryk Enter';
    }

    if (entryActive) {
      inputWrapper = document.createElement('div');
      inputWrapper.className = 'arcade-inline-input-wrapper';
      input = document.createElement('input');
      input.className = 'arcade-input';
      input.placeholder = 'DIT NAVN';
      input.maxLength = 18;
      input.autocomplete = 'off';
      input.spellcheck = false;
      input.setAttribute('aria-label', 'Navn til high score');
      inputWrapper.appendChild(input);
      const caret = document.createElement('span');
      caret.className = 'arcade-caret';
      inputWrapper.appendChild(caret);
    } else {
      entryActive = false;
      overlayLocked = false;
    }

    function buildRenderOptions(list) {
      const baseOptions = { limit: LEADERBOARD_LIMIT };
      if (lastSavedEntry && !entryActive) {
        baseOptions.highlightMatcher = (entry) =>
          entry &&
          entry.name === lastSavedEntry.name &&
          typeof entry.score === 'number' &&
          entry.score === lastSavedEntry.score;
      }
      if (entryActive && inputWrapper && typeof score === 'number' && score > 0) {
        const normalizedList = Array.isArray(list)
          ? list.slice(0, LEADERBOARD_LIMIT)
          : [];
        const lowestEntry =
          normalizedList.length >= LEADERBOARD_LIMIT
            ? normalizedList[normalizedList.length - 1]
            : null;
        const lowestScore =
          lowestEntry && typeof lowestEntry.score === 'number' ? lowestEntry.score : -Infinity;
        pendingOutsideLeaderboard =
          normalizedList.length >= LEADERBOARD_LIMIT && score <= lowestScore;
        const pendingIndex = pendingOutsideLeaderboard
          ? normalizedList.length
          : scoreInsertIndex(normalizedList, score);
        return {
          ...baseOptions,
          pendingIndex,
          pendingScore: score,
          pendingWrapper: inputWrapper,
          pendingLabel: pendingOutsideLeaderboard ? 'Din score (uden for top 10)' : 'Din score',
        };
      }
      pendingOutsideLeaderboard = false;
      return baseOptions;
    }

    function setScores(scores) {
      const normalized = Array.isArray(scores)
        ? scores.slice(0, LEADERBOARD_LIMIT)
        : [];
      latestScores = normalized.slice();
      listHost.innerHTML = '';
      listHost.appendChild(renderScoresList(normalized, buildRenderOptions(normalized)));
      updateHelperLegend();
    }

    async function refreshScores(options = {}) {
      const finalizeEntry = Boolean(options.finalizeEntry);
      try {
        const data = await fetchScores(gameId);
        if (finalizeEntry) {
          entryActive = false;
          overlayLocked = false;
        }
        setScores(data.scores || []);
        return true;
      } catch (err) {
        console.error('Failed to refresh leaderboard', err);
        return false;
      }
    }

    setScores(initialScores || []);
    if (!initialScores) {
      refreshScores();
    }

    if (entryActive) {
      helperLine = document.createElement('p');
      helperLine.style.textAlign = 'center';
      helperLine.style.fontSize = '0.75rem';
      helperLine.style.opacity = '0.75';
      helperLine.style.marginTop = '0.75rem';
      panel.appendChild(helperLine);
      updateHelperLegend();

      statusLine = document.createElement('p');
      statusLine.style.textAlign = 'center';
      statusLine.style.fontSize = '0.8rem';
      statusLine.style.minHeight = '1.4rem';
      statusLine.style.margin = '0.35rem 0 0';
      statusLine.style.opacity = '0.85';
      statusLine.textContent = '';
      panel.appendChild(statusLine);

      saveBtn = document.createElement('button');
      saveBtn.textContent = 'Gem score';
      panel.appendChild(saveBtn);
    }

    const closeBtn = document.createElement('button');
    closeBtn.textContent = entryActive ? 'Spring over' : 'Luk';
    panel.appendChild(closeBtn);

    function detachListeners() {
      if (input) {
        input.removeEventListener('keydown', onInputKey);
      }
      if (saveBtn) {
        saveBtn.removeEventListener('click', submitEntry);
      }
      closeBtn.removeEventListener('click', onCloseBtn);
      const handlerRef = pointerHandler;
      if (handlerRef && overlayHost) {
        overlayHost.removeEventListener('pointerdown', handlerRef);
      }
      if (overlayPointerHandler === handlerRef) {
        overlayPointerHandler = null;
        overlayPointerHost = null;
      }
      pointerHandler = null;
    }

    function requestClose(force = false) {
      if (entryActive && input && !input.disabled && !force) {
        if (statusLine) {
          statusLine.textContent = 'Gem din score først – tryk Enter for at gemme.';
        }
        if (input) input.focus();
        return;
      }
      entryActive = false;
      overlayLocked = false;
      detachListeners();
      lastSavedEntry = null;
      hideOverlay(true);
    }

    function onCloseBtn() {
      if (entryActive && allowSkip) {
        requestClose(true);
      } else {
        requestClose(false);
      }
    }

    function onInputKey(e) {
      if (swallowGameNavigationKeys(e)) {
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        submitEntry();
      }
    }

    async function submitEntry() {
      if (!input || !saveBtn || saving || !entryActive) return;
      const name = (input.value || '').trim();
      if (!name) {
        input.focus();
        return;
      }
      saving = true;
      saveBtn.disabled = true;
      const previousLabel = saveBtn.textContent;
      saveBtn.textContent = 'Gemmer...';
      try {
        const wasOutside = pendingOutsideLeaderboard;
        lastSavedEntry = { name, score };
        await submitScore(gameId, name, score);
        const refreshed = await refreshScores({ finalizeEntry: true });
        if (!refreshed) {
          entryActive = false;
          overlayLocked = false;
          const merged = latestScores.slice();
          const insertAt = scoreInsertIndex(merged, score);
          merged.splice(insertAt, 0, { name, score });
          setScores(merged.slice(0, LEADERBOARD_LIMIT));
        }
        const appearsInTopTen = !wasOutside
          ? latestScores.some(
              (row) =>
                row &&
                row.name === name &&
                typeof row.score === 'number' &&
                row.score === score
            )
          : false;
        if (statusLine) {
          statusLine.textContent = appearsInTopTen
            ? 'Score gemt!'
            : 'Score gemt! (ikke i top 10 endnu)';
        }
        if (helperLine) {
          helperLine.textContent = appearsInTopTen
            ? 'Tak! Score gemt.'
            : 'Tak! Score gemt – slå top 10 for at se den på listen.';
        }
        input.disabled = true;
        input.value = name;
        input.removeEventListener('keydown', onInputKey);
        input.blur();
        entryActive = false;
        overlayLocked = false;
        saveBtn.textContent = 'Score gemt';
        saveBtn.disabled = true;
        closeBtn.textContent = 'Luk';
      } catch (err) {
        console.error('Failed to submit score', err);
        if (statusLine) statusLine.textContent = 'Kunne ikke gemme score. Prøv igen.';
        saveBtn.disabled = false;
        saveBtn.textContent = previousLabel;
      } finally {
        saving = false;
        if (!entryActive) {
          overlayLocked = false;
        }
      }
    }

    if (entryActive && input && saveBtn) {
      input.addEventListener('keydown', onInputKey);
      saveBtn.addEventListener('click', submitEntry);
      setTimeout(() => input && input.focus(), 30);
    }

    closeBtn.addEventListener('click', onCloseBtn);

    keyHandler = function (e) {
      const key = e.key;
      if (entryActive && input && !input.disabled) {
        if (key === 'Escape' || key === ' ' || key === 'Spacebar' || key === 'Space') {
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
        }
        return;
      }
      if (key === 'Escape' || key === ' ' || key === 'Spacebar' || key === 'Space' || key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        requestClose(false);
      }
    };
    window.addEventListener('keydown', keyHandler, true);

    pointerHandler = function (evt) {
      const target = evt.target;
      if (target && (target.closest('input, textarea, button, select') || target.isContentEditable)) {
        return;
      }
      evt.preventDefault();
      evt.stopPropagation();
    };

    showOverlay(panel);
    if (overlayHost && pointerHandler) {
      overlayHost.addEventListener('pointerdown', pointerHandler);
      overlayPointerHandler = pointerHandler;
      overlayPointerHost = overlayHost;
    }
  }

  async function showHighScores(gameId, options = {}) {
    const scores = await loadScores(gameId);
    showLeaderboardPanel({
      gameId,
      score: options.score,
      allowEntry: false,
      allowSkip: true,
      title: options.title || 'Søde Børn',
      message: options.subtitle || options.message || 'Top 10 resultater',
      initialScores: scores,
    });
  }

  function showScoresCarousel(config = {}) {
    if (activeResolver) {
      activeResolver(null);
      activeResolver = null;
    }
    const rawGames = Array.isArray(config.games) && config.games.length
      ? config.games
      : DEFAULT_GAMES;
    const games = Array.from(
      new Set(
        rawGames
          .map(normalizeGameId)
          .filter(Boolean)
      )
    );
    if (!games.length) {
      return;
    }
    let index = Math.max(
      0,
      games.indexOf(normalizeGameId(config.startGameId || games[0]))
    );
    const panel = arcadePanel();
    panel.appendChild(arcadeTitle(config.title || 'Top 10'));

    const nav = document.createElement('div');
    nav.className = 'arcade-carousel-nav';
    const prevBtn = document.createElement('button');
    prevBtn.type = 'button';
    prevBtn.className = 'arcade-carousel-btn';
    prevBtn.textContent = '◀';

    const label = document.createElement('div');
    label.className = 'arcade-carousel-label';

    const nextBtn = document.createElement('button');
    nextBtn.type = 'button';
    nextBtn.className = 'arcade-carousel-btn';
    nextBtn.textContent = '▶';

    nav.appendChild(prevBtn);
    nav.appendChild(label);
    nav.appendChild(nextBtn);
    panel.appendChild(nav);

    const listHost = document.createElement('div');
    panel.appendChild(listHost);

    const hint = document.createElement('p');
    hint.style.textAlign = 'center';
    hint.style.fontSize = '0.75rem';
    hint.style.opacity = '0.75';
    hint.style.marginTop = '0.75rem';
    hint.textContent = 'Swipe eller brug piletasterne for at skifte spil.';
    panel.appendChild(hint);

    const closeBtn = document.createElement('button');
    closeBtn.textContent = 'Luk';
    panel.appendChild(closeBtn);

    const cache = new Map();
    let swipeState = null;

    function setLoading(text) {
      const msg = document.createElement('p');
      msg.style.textAlign = 'center';
      msg.style.margin = '0.5rem 0';
      msg.textContent = text;
      listHost.innerHTML = '';
      listHost.appendChild(msg);
    }

    async function renderCurrent(force = false) {
      const gameId = games[index];
      label.textContent = friendlyGameName(gameId);
      if (!cache.has(gameId) || force) {
        setLoading('Henter high score...');
        try {
          const rows = await loadScores(gameId, []);
          cache.set(gameId, rows);
        } catch (err) {
          console.error('Failed to load carousel leaderboard', err);
          setLoading('Kunne ikke hente high score 😢');
          return;
        }
      }
      const scores = cache.get(gameId) || [];
      listHost.innerHTML = '';
      listHost.appendChild(renderScoresList(scores, { limit: LEADERBOARD_LIMIT }));
    }

    function go(delta) {
      index = (index + delta + games.length) % games.length;
      renderCurrent();
    }

    prevBtn.addEventListener('click', () => go(-1));
    nextBtn.addEventListener('click', () => go(1));

    function onPointerDown(ev) {
      if (!ev.isPrimary) return;
      swipeState = { id: ev.pointerId, x: ev.clientX, y: ev.clientY };
    }

    function onPointerUp(ev) {
      if (!swipeState || swipeState.id !== ev.pointerId) return;
      const dx = ev.clientX - swipeState.x;
      const dy = ev.clientY - swipeState.y;
      if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) {
        ev.preventDefault();
        ev.stopPropagation();
        go(dx > 0 ? -1 : 1);
      }
      swipeState = null;
    }

    const onPointerCancel = () => { swipeState = null; };
    listHost.addEventListener('pointerdown', onPointerDown);
    listHost.addEventListener('pointerup', onPointerUp);
    listHost.addEventListener('pointercancel', onPointerCancel);
    listHost.addEventListener('pointerleave', onPointerCancel);

    const overlayHost = ensureOverlay();
    let pointerHandler = null;

    function cleanup() {
      listHost.removeEventListener('pointerdown', onPointerDown);
      listHost.removeEventListener('pointerup', onPointerUp);
      listHost.removeEventListener('pointercancel', onPointerCancel);
      listHost.removeEventListener('pointerleave', onPointerCancel);
      if (pointerHandler && overlayHost) {
        overlayHost.removeEventListener('pointerdown', pointerHandler);
      }
      if (overlayPointerHandler === pointerHandler) {
        overlayPointerHandler = null;
        overlayPointerHost = null;
      }
      if (keyHandler === localKeyHandler) {
        window.removeEventListener('keydown', localKeyHandler, true);
        keyHandler = null;
      }
      swipeState = null;
    }

    function closeOverlay() {
      cleanup();
      hideOverlay(true);
    }

    closeBtn.addEventListener('click', closeOverlay);

    const localKeyHandler = function (e) {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeOverlay();
        return;
      }
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        go(-1);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        go(1);
      }
    };
    keyHandler = localKeyHandler;
    window.addEventListener('keydown', localKeyHandler, true);

    pointerHandler = function (evt) {
      const target = evt.target;
      if (target && (target.closest('input, textarea, button, select') || target.isContentEditable)) {
        return;
      }
      evt.preventDefault();
      evt.stopPropagation();
    };

    showOverlay(panel);
    if (overlayHost && pointerHandler) {
      overlayHost.addEventListener('pointerdown', pointerHandler);
      overlayPointerHandler = pointerHandler;
      overlayPointerHost = overlayHost;
    }

    renderCurrent(true);
  }

  function promptHighScoreEntry({
    gameId,
    score,
    title = 'Ny high score!',
    message = 'Skriv dit navn til julemandens liste.',
    allowSkip = true,
    placeholder = 'DIT NAVN',
  }) {
    return new Promise((resolve) => {
      if (activeResolver) {
        activeResolver(null);
        activeResolver = null;
      }
      const panel = arcadePanel();
      panel.appendChild(arcadeTitle(title));
      const msg = document.createElement('p');
      msg.textContent = message;
      msg.style.textAlign = 'center';
      panel.appendChild(msg);

      const wrapper = document.createElement('div');
      wrapper.className = 'arcade-input-wrapper';
      const input = document.createElement('input');
      input.className = 'arcade-input';
      input.placeholder = placeholder;
      input.maxLength = 18;
      input.autocomplete = 'off';
      input.spellcheck = false;
      input.setAttribute('aria-label', 'Navn til high score');
      const caret = document.createElement('span');
      caret.className = 'arcade-caret';
      wrapper.appendChild(input);
      wrapper.appendChild(caret);
      panel.appendChild(wrapper);

      const hint = document.createElement('p');
      hint.textContent = allowSkip
        ? 'Enter for at gemme • ESC for at springe over'
        : 'Tryk Enter for at gemme';
      hint.style.textAlign = 'center';
      hint.style.fontSize = '0.75rem';
      hint.style.opacity = '0.75';
      panel.appendChild(hint);

      const save = document.createElement('button');
      save.textContent = 'Gem score';
      panel.appendChild(save);

      function submit() {
        const name = (input.value || '').trim();
        if (!name) {
          input.focus();
          return;
        }
        cleanup();
        resolve({ name, score, gameId });
      }

      function skip() {
        cleanup();
        resolve(null);
      }

      function cleanup() {
        swipeState = null;
        if (keyHandler === localKeyHandler) {
          window.removeEventListener('keydown', localKeyHandler, true);
          keyHandler = null;
        }
        save.removeEventListener('click', submit);
        input.removeEventListener('keydown', onKey);
        activeResolver = null;
        hideOverlay(true);
      }

      function onKey(e) {
        if (swallowGameNavigationKeys(e)) {
          return;
        }
        if (e.key === 'Enter') {
          e.preventDefault();
          submit();
        } else if (allowSkip && e.key === 'Escape') {
          e.preventDefault();
          skip();
        }
      }

      keyHandler = function (e) {
        if (!allowSkip) return;
        if (e.key === 'Escape') {
          e.preventDefault();
          skip();
        }
      };

      activeResolver = resolve;
      input.addEventListener('keydown', onKey);
      save.addEventListener('click', submit);
      window.addEventListener('keydown', keyHandler, true);

      showOverlay(panel);
      setTimeout(() => input.focus(), 10);
    });
  }

  async function handleHighScoreFlow({ gameId, score, allowSkip = true, title, message }) {
    const scores = await loadScores(gameId);
    const qualifies = qualifiesWithinScores(scores, score);
    const userTitle = typeof title === 'string' ? title.trim() : '';
    const userMessage = typeof message === 'string' ? message.trim() : '';
    const effectiveTitle = userTitle || 'Ny high score!';
    if (!qualifies && overlayLocked) {
      return;
    }
    const defaultMessage = qualifies
      ? 'Skriv dit navn til julemandens liste.'
      : 'Top 10 er fyldt – slå listen for at skrive dit navn.';
    const effectiveMessage = userMessage || defaultMessage;
    showLeaderboardPanel({
      gameId,
      score,
      allowEntry: typeof score === 'number' && score > 0 && qualifies,
      allowSkip,
      title: effectiveTitle,
      message: effectiveMessage,
      initialScores: scores,
    });
  }

  window.arcadeOverlay = {
    ensureOverlay,
    showHighScores,
    showScoresCarousel,
    promptHighScoreEntry,
    playerQualifies,
    submitScore,
    hideOverlay,
    handleHighScoreFlow,
  };
})();
