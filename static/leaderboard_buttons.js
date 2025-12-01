(function () {
  const DEFAULT_GAMES = ['forste-advent', 'anden-advent', 'tredje-advent'];

  function normalizeGameId(value) {
    if (!value) return '';
    const raw = String(value).trim().toLowerCase();
    if (raw === 'reindeer-rush') return 'tredje-advent';
    return raw;
  }

  function parseGames(el) {
    const attr = el.getAttribute('data-games');
    if (!attr) return DEFAULT_GAMES.slice();
    return attr
      .split(',')
      .map(normalizeGameId)
      .filter(Boolean);
  }

  function onClick(btn) {
    const games = parseGames(btn);
    if (!games.length) return;
    const start = normalizeGameId(btn.getAttribute('data-start-game')) || games[0];
    if (typeof window === 'undefined') return;
    const overlay = window.arcadeOverlay;
    if (overlay && typeof overlay.showScoresCarousel === 'function') {
      overlay.showScoresCarousel({ games, startGameId: start });
    }
  }

  function init() {
    const buttons = document.querySelectorAll('[data-arcade-leaderboard]');
    buttons.forEach((btn) => {
      btn.addEventListener('click', (event) => {
        event.preventDefault();
        onClick(btn);
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
