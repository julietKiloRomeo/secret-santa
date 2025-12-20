describe('Reindeer Rush platforms and snowmen', () => {
  let mockCtx;

  beforeEach(() => {
    jest.resetModules();
    mockCtx = {
      setTransform: jest.fn(),
      clearRect: jest.fn(),
      fillRect: jest.fn(),
      createLinearGradient: () => ({ addColorStop: jest.fn() }),
      drawImage: jest.fn(),
      beginPath: jest.fn(),
      arc: jest.fn(),
      fill: jest.fn(),
      fillText: jest.fn(),
      save: jest.fn(),
      restore: jest.fn(),
      moveTo: jest.fn(),
      lineTo: jest.fn(),
      closePath: jest.fn(),
    };
    HTMLCanvasElement.prototype.getContext = () => mockCtx;
    HTMLCanvasElement.prototype.getBoundingClientRect = () => ({ width: 640, height: 260 });
    document.body.innerHTML = `
      <div id="reindeer-canvas"><canvas></canvas></div>
      <div id="reindeer-immersive-stage"></div>
      <div id="reindeer-immersive-hint"></div>
    `;
    global.requestAnimationFrame = jest.fn();
    global.cancelAnimationFrame = jest.fn();
  });

  afterEach(() => {
    delete window.__reindeerRush__;
    delete window.__reindeerRushDebug__;
    jest.restoreAllMocks();
  });

  function loadGame() {
    jest.isolateModules(() => {
      require('../static/reindeer_rush');
    });
    document.dispatchEvent(new Event('DOMContentLoaded'));
    return window.__reindeerRushDebug__;
  }

  test('platforms inside the same cluster never leave runnable gaps', () => {
    jest.spyOn(Math, 'random').mockReturnValue(0.5);
    const debug = loadGame();
    debug.clearPlatforms();
    debug.enablePlatformBuffer();
    const plats = debug.getPlatforms();

    for (let i = 1; i < plats.length; i++) {
      const prev = plats[i - 1];
      const curr = plats[i];
      if (prev.clusterId === curr.clusterId) {
        expect(curr.x).toBeLessThanOrEqual(prev.x + prev.width);
      } else {
        expect(curr.x - (prev.x + prev.width)).toBeGreaterThanOrEqual(200);
      }
    }
  });

  test('snowman metrics keep aspect ratio, respect bottom padding, and trim presents from hitbox', () => {
    const debug = loadGame();
    const metrics = debug.getSnowmanMetrics();
    expect(metrics.drawWidth / metrics.drawHeight).toBeCloseTo(metrics.aspect, 2);
    expect(metrics.bottomPadding).toBeGreaterThan(15);
    expect(metrics.hitbox.w).toBeLessThan(metrics.drawWidth);
  });
});
