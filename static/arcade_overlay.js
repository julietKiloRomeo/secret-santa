(function () {
  if (typeof window === 'undefined') return;
  if (window.arcadeOverlay) return;

  const STYLE_ID = 'arcade-overlay-styles';
  const OVERLAY_ID = 'arcade-overlay';
  const LEADERBOARD_LIMIT = 10;
  let overlayEl = null;
  let escHandler = null;
  let activeResolver = null;

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
        z-index: 1000;
        backdrop-filter: blur(3px);
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
        max-height: 260px;
        overflow-y: auto;
        overflow-x: hidden;
        scrollbar-width: none;
        -ms-overflow-style: none;
      }
      .arcade-scores::-webkit-scrollbar {
        display: none;
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

  function hideOverlay() {
    if (overlayEl) overlayEl.classList.remove('visible');
    if (overlayEl) overlayEl.innerHTML = '';
    if (document.body) {
      document.body.classList.remove('arcade-overlay-open');
    }
    if (escHandler) {
      window.removeEventListener('keydown', escHandler, true);
      escHandler = null;
    }
    if (activeResolver) {
      activeResolver(null);
      activeResolver = null;
    }
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
    const rows = Array.isArray(scores) ? scores.slice() : [];
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

    let input = null;
    let inputWrapper = null;
    let saveBtn = null;
    let helperLine = null;
    let statusLine = null;
    let saving = false;
    let entryActive = allowEntry && typeof score === 'number' && score > 0;
    let latestScores = Array.isArray(initialScores)
      ? initialScores.slice(0, LEADERBOARD_LIMIT)
      : [];

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
    }

    function buildRenderOptions(list) {
      if (entryActive && inputWrapper && typeof score === 'number' && score > 0) {
        return {
          pendingIndex: scoreInsertIndex(list, score),
          pendingScore: score,
          pendingWrapper: inputWrapper,
          limit: LEADERBOARD_LIMIT,
        };
      }
      return { limit: LEADERBOARD_LIMIT };
    }

    function setScores(scores) {
      const normalized = Array.isArray(scores)
        ? scores.slice(0, LEADERBOARD_LIMIT)
        : [];
      latestScores = normalized.slice();
      listHost.innerHTML = '';
      listHost.appendChild(renderScoresList(normalized, buildRenderOptions(normalized)));
    }

    async function refreshScores(options = {}) {
      const finalizeEntry = Boolean(options.finalizeEntry);
      try {
        const data = await fetchScores(gameId);
        if (finalizeEntry) {
          entryActive = false;
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
      helperLine.textContent = allowSkip
        ? 'Skriv dit navn på listen og tryk Enter • ESC for at springe over'
        : 'Skriv dit navn på listen og tryk Enter';
      helperLine.style.textAlign = 'center';
      helperLine.style.fontSize = '0.75rem';
      helperLine.style.opacity = '0.75';
      helperLine.style.marginTop = '0.75rem';
      panel.appendChild(helperLine);

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

    function closeOverlay() {
      if (input) {
        input.removeEventListener('keydown', onInputKey);
      }
      if (saveBtn) {
        saveBtn.removeEventListener('click', submitEntry);
      }
      closeBtn.removeEventListener('click', closeOverlay);
      hideOverlay();
    }

    function onInputKey(e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        submitEntry();
      } else if (allowSkip && e.key === 'Escape') {
        e.preventDefault();
        closeOverlay();
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
        await submitScore(gameId, name, score);
        const refreshed = await refreshScores({ finalizeEntry: true });
        if (!refreshed) {
          entryActive = false;
          const merged = latestScores.slice();
          const insertAt = scoreInsertIndex(merged, score);
          merged.splice(insertAt, 0, { name, score });
          setScores(merged.slice(0, LEADERBOARD_LIMIT));
        }
        if (statusLine) statusLine.textContent = 'Score gemt!';
        if (helperLine) helperLine.textContent = 'Tak! Score gemt.';
        input.disabled = true;
        input.value = name;
        input.removeEventListener('keydown', onInputKey);
        input.blur();
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
      }
    }

    if (entryActive && input && saveBtn) {
      input.addEventListener('keydown', onInputKey);
      saveBtn.addEventListener('click', submitEntry);
      setTimeout(() => input && input.focus(), 30);
    }

    closeBtn.addEventListener('click', closeOverlay);

    escHandler = function (e) {
      if (!allowSkip) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        closeOverlay();
      }
    };
    window.addEventListener('keydown', escHandler, true);

    showOverlay(panel);
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
        if (escHandler) {
          window.removeEventListener('keydown', escHandler, true);
          escHandler = null;
        }
        save.removeEventListener('click', submit);
        input.removeEventListener('keydown', onKey);
        activeResolver = null;
        hideOverlay();
      }

      function onKey(e) {
        if (e.key === 'Enter') {
          e.preventDefault();
          submit();
        } else if (allowSkip && e.key === 'Escape') {
          e.preventDefault();
          skip();
        }
      }

      escHandler = function (e) {
        if (!allowSkip) return;
        if (e.key === 'Escape') {
          e.preventDefault();
          skip();
        }
      };

      activeResolver = resolve;
      input.addEventListener('keydown', onKey);
      save.addEventListener('click', submit);
      window.addEventListener('keydown', escHandler, true);

      showOverlay(panel);
      setTimeout(() => input.focus(), 10);
    });
  }

  async function handleHighScoreFlow({ gameId, score, allowSkip = true, title, message }) {
    const scores = await loadScores(gameId);
    const qualifies = qualifiesWithinScores(scores, score);
    const userTitle = typeof title === 'string' ? title.trim() : '';
    const userMessage = typeof message === 'string' ? message.trim() : '';
    const effectiveTitle = qualifies
      ? (userTitle || 'Ny high score!')
      : 'Top 10';
    const effectiveMessage = qualifies
      ? (userMessage || 'Skriv dit navn til julemandens liste.')
      : 'Du nåede ikke helt på listen, men her er de bedste scorere.';
    showLeaderboardPanel({
      gameId,
      score,
      allowEntry: qualifies,
      allowSkip,
      title: effectiveTitle,
      message: effectiveMessage,
      initialScores: scores,
    });
  }

  window.arcadeOverlay = {
    ensureOverlay,
    showHighScores,
    promptHighScoreEntry,
    playerQualifies,
    submitScore,
    hideOverlay,
    handleHighScoreFlow,
  };
})();
