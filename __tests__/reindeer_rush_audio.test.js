describe('Reindeer Rush audio cues', () => {
  let createdAudio;
  let mockCtx;

  beforeEach(() => {
    jest.resetModules();
    createdAudio = [];
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
    global.requestAnimationFrame = jest.fn();
    global.cancelAnimationFrame = jest.fn();
    global.Audio = class FakeAudio {
      constructor(src = '') {
        this.src = src;
        this.loop = false;
        this.currentTime = 0;
        this.playCalls = 0;
        createdAudio.push(this);
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
    HTMLCanvasElement.prototype.getContext = () => mockCtx;
    HTMLCanvasElement.prototype.getBoundingClientRect = () => ({ width: 600, height: 260 });
    document.body.innerHTML = `
      <div id="reindeer-canvas"><canvas></canvas></div>
      <div id="reindeer-immersive-stage"></div>
      <div id="reindeer-immersive-hint"></div>
    `;
  });

  afterEach(() => {
    delete window.__reindeerRush__;
    delete window.__reindeerRushDebug__;
  });

  function loadGame() {
    jest.isolateModules(() => {
      require('../static/reindeer_rush');
    });
    document.dispatchEvent(new Event('DOMContentLoaded'));
    return {
      game: window.__reindeerRush__,
      debug: window.__reindeerRushDebug__,
    };
  }

  function findAudio(srcFragment) {
    return createdAudio.find((a) => (a.src || '').includes(srcFragment));
  }

  test('starts looping background song when the run begins', () => {
    const { game } = loadGame();

    game.startGame();

    const music = findAudio('arcade-kid.mp3');
    expect(music).toBeDefined();
    expect(music.loop).toBe(true);
    expect(music.playCalls).toBeGreaterThan(0);
  });

  test('plays jump and death sounds on the matching events', () => {
    const { game, debug } = loadGame();
    game.startGame();

    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', cancelable: true, bubbles: true }));

    const jump = findAudio('jump.mp3');
    expect(jump).toBeDefined();
    expect(jump.playCalls).toBe(1);
    expect(jump.currentTime).toBe(0);

    debug.triggerDeathForTest();

    const boom = findAudio('explosion.mp3');
    expect(boom).toBeDefined();
    expect(boom.playCalls).toBe(1);
  });

  test('dashing through a snowman plays the coin sound', () => {
    const { game, debug } = loadGame();
    game.startGame();

    debug.spawnSnowmanForTest(-20);
    debug.triggerDash();
    debug.stepForTest(16);

    const coin = findAudio('coin.mp3');
    expect(coin).toBeDefined();
    expect(coin.playCalls).toBe(1);
  });
});
