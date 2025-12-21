describe('Reindeer Rush platforms and snowmen', () => {
  let mockCtx;

  const SCREEN_WIDTH = 640;

  beforeEach(() => {
    jest.resetModules();
    global.Audio = class FakeAudio {
      constructor(src = '') {
        this.src = src;
        this.loop = false;
        this.currentTime = 0;
        this.playCalls = 0;
      }
      play() {
        this.playCalls += 1;
        this.currentTime = 0;
        return Promise.resolve();
      }
      pause() {
        this.paused = true;
      }
    };
    mockCtx = {
      setTransform: jest.fn(),
      clearRect: jest.fn(),
      fillRect: jest.fn(),
      createLinearGradient: () => ({ addColorStop: jest.fn() }),
      drawImage: jest.fn(),
      translate: jest.fn(),
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
    HTMLCanvasElement.prototype.getBoundingClientRect = () => ({ width: SCREEN_WIDTH, height: 260 });
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

  function loadRunningGame() {
    const debug = loadGame();
    if (window.__reindeerRush__ && window.__reindeerRush__.startGame) {
      window.__reindeerRush__.startGame();
    }
    return debug;
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

  test('intro runway stays gapless until after the 1000m milestone', () => {
    jest.spyOn(Math, 'random').mockReturnValue(0.42);
    const debug = loadRunningGame();
    const collectGaps = () => {
      const plats = debug.getPlatforms().slice().sort((a, b) => a.x - b.x);
      const gaps = [];
      for (let i = 1; i < plats.length; i++) {
        const prev = plats[i - 1];
        const curr = plats[i];
        gaps.push(curr.x - (prev.x + prev.width));
      }
      return gaps;
    };

    debug.stepForTest(48000);
    const introGaps = collectGaps();
    expect(introGaps.every((g) => g <= 0)).toBe(true);

    debug.stepForTest(82000);
    const rampGaps = collectGaps();
    expect(rampGaps.some((g) => g > 40)).toBe(true);
  });

  test('snowmen only start after the intro jumps are staged', () => {
    jest.spyOn(Math, 'random').mockReturnValue(0.5);
    const debug = loadRunningGame();

    debug.stepForTest(12000);
    expect(debug.getSnowmen().length).toBe(0);
    const midStatus = debug.getIntroStatus ? debug.getIntroStatus() : null;
    if (midStatus) {
      expect(midStatus.snowmanUnlocked).toBe(false);
    }

    debug.stepForTest(24000);
    expect(debug.getSnowmen().length).toBeGreaterThanOrEqual(1);
    const finalStatus = debug.getIntroStatus ? debug.getIntroStatus() : null;
    if (finalStatus) {
      expect(finalStatus.snowmanUnlocked).toBe(true);
    }
  });

  test('camera follows higher platforms to keep Rudolph near the same screen row', () => {
    jest.spyOn(Math, 'random').mockReturnValue(0.33);
    const debug = loadRunningGame();
    const initialCamera = debug.getCamera ? debug.getCamera() : { y: 0, baseline: 0 };
    const plats = debug.getPlatforms();
    const baseSurface = plats[0].surfaceY;

    debug.setSinglePlatformForTest(baseSurface - 80);
    debug.stepForTest(16);
    const cam = debug.getCamera ? debug.getCamera() : null;
    expect(cam).toBeTruthy();
    if (cam) {
      expect(cam.target).toBeCloseTo(cam.baseline - (baseSurface - 80), 0);
      expect(cam.y).toBeGreaterThan(initialCamera.y);
    }
  });

  test('single jump arc climbs significantly higher now', () => {
    const debug = loadRunningGame();
    const arc = debug.measureJumpArcForTest ? debug.measureJumpArcForTest() : null;
    expect(arc).toBeTruthy();
    if (arc) {
      expect(arc.rise).toBeGreaterThanOrEqual(120);
      expect(arc.peakY).toBeLessThan(arc.startY - 100);
    }
  });

  test('intro gives a screen of running, then a single-jump climb before a double-jump climb', () => {
    jest.spyOn(Math, 'random').mockReturnValue(0.27);
    const debug = loadRunningGame();
    const steps = debug.describeIntroSteps ? debug.describeIntroSteps() : [];
    const arc = debug.measureJumpArcForTest ? debug.measureJumpArcForTest() : null;
    const player = debug.getPlayer ? debug.getPlayer() : { x: 80 };
    expect(arc).toBeTruthy();
    expect(steps.length).toBeGreaterThanOrEqual(2);
    if (!arc || steps.length < 2) return;
    const [first, second] = steps;
    expect(first.startX - player.x).toBeGreaterThanOrEqual(SCREEN_WIDTH);
    expect(first.height).toBeLessThan(arc.rise * 0.75);
    expect(second.height).toBeGreaterThan(arc.rise * 0.6);
    expect(second.height - first.height).toBeGreaterThanOrEqual(24);
    expect(second.startX).toBeGreaterThan(first.startX);
  });

  test('later intro adds another tall jump after a few screens', () => {
    jest.spyOn(Math, 'random').mockReturnValue(0.31);
    const debug = loadRunningGame();
    const steps = debug.describeIntroSteps ? debug.describeIntroSteps(40, 5) : [];
    expect(steps.length).toBeGreaterThanOrEqual(3);
    const third = steps[2];
    expect(third.startX).toBeGreaterThanOrEqual(SCREEN_WIDTH * 3);
    expect(third.height).toBeGreaterThan(80);
  });

  test('ground scales so at least 4.5 pieces fit on screen width', () => {
    jest.spyOn(Math, 'random').mockReturnValue(0.2);
    HTMLCanvasElement.prototype.getBoundingClientRect = () => ({ width: SCREEN_WIDTH, height: 260 });
    const debug = loadRunningGame();
    const metrics = debug.getGroundMetrics ? debug.getGroundMetrics() : null;
    expect(metrics).toBeTruthy();
    if (!metrics) return;
    expect(metrics.baseWidth).toBeLessThanOrEqual(SCREEN_WIDTH / 4.5 + 1);
    const first = debug.getPlatforms()[0];
    expect(first).toBeTruthy();
    if (first) {
      expect(SCREEN_WIDTH / first.width).toBeGreaterThanOrEqual(4.3);
    }
  });
});
