import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import JingleBellHero from '../static/jingle_bell_hero_app';
import { pitchToFreq, addFrequencies, processTiedNotes, AudioPlayer } from '../static/jingle_bell_hero_core';

class MockOscillator {
  constructor() {
    this.type = 'sine';
    this.frequency = { value: 0 };
  }
  connect() {}
  start() {}
  stop() {}
}

class MockGain {
  constructor() {
    this.gain = {
      setValueAtTime: () => {},
      exponentialRampToValueAtTime: () => {},
    };
  }
  connect() {}
}

class MockAudioContext {
  constructor() {
    this.currentTime = 0;
  }
  createOscillator() {
    return new MockOscillator();
  }
  createGain() {
    return new MockGain();
  }
}

beforeAll(() => {
  global.AudioContext = MockAudioContext;
  global.webkitAudioContext = MockAudioContext;
  if (!global.requestAnimationFrame) {
    global.requestAnimationFrame = (cb) => setTimeout(() => cb(Date.now()), 16);
  }
  if (!global.cancelAnimationFrame) {
    global.cancelAnimationFrame = (id) => clearTimeout(id);
  }
});

const demoSong = [
  { time: 0, notes: [{ pitch: 'c4', lane: 1, tied: false }] },
  { time: 1, notes: [{ pitch: 'd4', lane: 2, tied: false }] },
  { time: 2, notes: [{ pitch: 'e4', lane: 3, tied: false }] },
];

beforeEach(() => {
  global.fetch = jest.fn(() => Promise.resolve({ ok: true, json: async () => demoSong }));
});

afterEach(() => {
  delete global.fetch;
});

describe('jingle bell hero utilities', () => {
  test('pitchToFreq matches concert A for a4', () => {
    expect(pitchToFreq('a4')).toBeCloseTo(440, 3);
  });

  test('pitchToFreq falls back when note is malformed', () => {
    expect(pitchToFreq('invalid')).toBe(440);
  });

  test('addFrequencies injects frequency metadata', () => {
    const events = [
      { time: 0, notes: [{ pitch: 'c4', lane: 1, tied: false }] },
    ];
    const enriched = addFrequencies(events);
    expect(enriched[0].notes[0]).toHaveProperty('freq');
    expect(enriched[0].notes[0].freq).toBeGreaterThan(200);
  });

  test('processTiedNotes stitches sustained segments', () => {
    const events = [
      { time: 0, notes: [{ pitch: 'c4', lane: 2, tied: true }] },
      { time: 1, notes: [{ pitch: 'c4', lane: 2, tied: false }] },
    ];
    const processed = processTiedNotes(events);
    expect(processed).toHaveLength(1);
    expect(processed[0]).toMatchObject({ isSustained: true, startTime: 0, endTime: 1 });
  });
});

describe('AudioPlayer', () => {
  const originalAudioCtx = window.AudioContext;
  const originalWebkitAudioCtx = window.webkitAudioContext;

  afterEach(() => {
    window.AudioContext = originalAudioCtx;
    window.webkitAudioContext = originalWebkitAudioCtx;
  });

  test('returns null context when AudioContext is unavailable', () => {
    delete window.AudioContext;
    delete window.webkitAudioContext;
    const player = new AudioPlayer();
    expect(player.ensureCtx()).toBeNull();
  });

  test('creates oscillator when AudioContext exists', () => {
    const mockCtx = {
      currentTime: 0,
      destination: {},
      createOscillator: jest.fn(() => ({
        type: '',
        frequency: { value: 0 },
        connect: jest.fn(),
        start: jest.fn(),
        stop: jest.fn(),
      })),
      createGain: jest.fn(() => ({
        connect: jest.fn(),
        gain: {
          setValueAtTime: jest.fn(),
          exponentialRampToValueAtTime: jest.fn(),
        },
      })),
    };
    window.AudioContext = jest.fn(() => mockCtx);
    window.webkitAudioContext = undefined;
    const player = new AudioPlayer();
    expect(player.ensureCtx()).toBe(mockCtx);
    player.playNote(330, 0.1);
    expect(mockCtx.createOscillator).toHaveBeenCalled();
    expect(mockCtx.createGain).toHaveBeenCalled();
  });

  test('startHold and stopHold wrap sustained playback', () => {
    const osc = {
      type: '',
      frequency: { value: 0 },
      connect: jest.fn(),
      start: jest.fn(),
      stop: jest.fn(),
    };
    const gain = {
      connect: jest.fn(),
      gain: {
        setValueAtTime: jest.fn(),
        exponentialRampToValueAtTime: jest.fn(),
      },
    };
    const mockCtx = {
      currentTime: 0,
      destination: {},
      createOscillator: jest.fn(() => osc),
      createGain: jest.fn(() => gain),
    };
    window.AudioContext = jest.fn(() => mockCtx);
    window.webkitAudioContext = undefined;
    const player = new AudioPlayer();
    const id = player.startHold(220);
    expect(id).toBeTruthy();
    expect(mockCtx.createOscillator).toHaveBeenCalledTimes(1);
    player.stopHold(id);
    expect(gain.gain.exponentialRampToValueAtTime).toHaveBeenCalled();
    expect(osc.stop).toHaveBeenCalled();
    // Ensure stopping unknown id is safe
    expect(() => player.stopHold(9999)).not.toThrow();
  });

  test('playError produces a harsh tone when context exists', () => {
    const mockCtx = {
      currentTime: 0,
      destination: {},
      createOscillator: jest.fn(() => ({
        type: '',
        frequency: { value: 0, exponentialRampToValueAtTime: jest.fn() },
        connect: jest.fn(),
        start: jest.fn(),
        stop: jest.fn(),
      })),
      createGain: jest.fn(() => ({
        connect: jest.fn(),
        gain: {
          setValueAtTime: jest.fn(),
          exponentialRampToValueAtTime: jest.fn(),
        },
      })),
    };
    window.AudioContext = jest.fn(() => mockCtx);
    window.webkitAudioContext = undefined;
    const player = new AudioPlayer();
    player.playError(0.1);
    expect(mockCtx.createOscillator).toHaveBeenCalled();
    expect(mockCtx.createGain).toHaveBeenCalled();
  });

  test('playError is a no-op when no audio context is available', () => {
    delete window.AudioContext;
    delete window.webkitAudioContext;
    const player = new AudioPlayer();
    expect(() => player.playError(0.1)).not.toThrow();
  });
});

describe('JingleBellHero component', () => {
  test('renders menu and moves into playing state after clicking start', async () => {
    render(<JingleBellHero />);
    const startButton = screen.getByRole('button', { name: /start/i });
    await waitFor(() => expect(startButton).not.toBeDisabled());
    await act(async () => {
      fireEvent.click(startButton);
      await Promise.resolve();
    });
    await screen.findByText(/Score:/i);
    expect(screen.getByText(/Level 1/)).toBeInTheDocument();
  });

  test('clicking a bell outside the hit window increments miss streak', async () => {
    render(<JingleBellHero />);
    const startButton = screen.getByRole('button', { name: /start/i });
    await waitFor(() => expect(startButton).not.toBeDisabled());
    await act(async () => {
      fireEvent.click(startButton);
      await Promise.resolve();
    });
    await screen.findByText(/Score:/i);
    const bells = screen.getAllByRole('button', { name: '🔔' });
    await act(async () => {
      fireEvent.click(bells[0]);
      await Promise.resolve();
    });
    expect(await screen.findByText(/Miss Streak: 1\/4/)).toBeInTheDocument();
  });

  test('notes render onto the playfield once songs load', async () => {
    render(<JingleBellHero />);
    const startButton = screen.getByRole('button', { name: /start/i });
    await waitFor(() => expect(startButton).not.toBeDisabled());
    await act(async () => {
      fireEvent.click(startButton);
      await Promise.resolve();
    });
    await screen.findByText(/Score:/i);
    await waitFor(() => {
      const noteGroups = document.querySelectorAll('[data-testid="note"]');
      expect(noteGroups.length).toBeGreaterThan(0);
    });
  });

  test('bells and hit line stay anchored at the bottom of the playfield', async () => {
    render(<JingleBellHero />);
    const startButton = screen.getByRole('button', { name: /start/i });
    await waitFor(() => expect(startButton).not.toBeDisabled());
    await act(async () => {
      fireEvent.click(startButton);
      await Promise.resolve();
    });
    const svg = await screen.findByTestId('playfield');
    const bells = svg.querySelectorAll('[data-testid^="bell-"]');
    expect(bells.length).toBe(4);
    const hitLine = svg.querySelector('[data-testid="hit-line"]');
    expect(hitLine).not.toBeNull();
  });

  test('notes spawn within the visible playfield range', async () => {
    render(<JingleBellHero />);
    const startButton = screen.getByRole('button', { name: /start/i });
    await waitFor(() => expect(startButton).not.toBeDisabled());
    await act(async () => {
      fireEvent.click(startButton);
      await Promise.resolve();
    });
    await waitFor(() => {
      const circles = Array.from(document.querySelectorAll('[data-testid="note"] circle'));
      expect(circles.length).toBeGreaterThan(0);
      const ys = circles.map((c) => parseFloat(c.getAttribute('cy') || c.getAttribute('y1') || '0'));
      const inFrame = ys.some((y) => y >= 0 && y <= 800);
      expect(inFrame).toBe(true);
    });
  });

  test('play area suppresses pinch/long-press defaults', async () => {
    render(<JingleBellHero />);
    const startButton = screen.getByRole('button', { name: /start/i });
    await waitFor(() => expect(startButton).not.toBeDisabled());
    await act(async () => {
      fireEvent.click(startButton);
      await Promise.resolve();
    });
    const playArea = screen.getByTestId('jbh-root');
    expect(playArea.style.touchAction).toBe('none');
    expect(playArea.style.userSelect).toBe('none');
    expect(playArea.style.WebkitUserSelect).toBe('none');
    expect(playArea.style.WebkitTouchCallout).toBe('none');
    expect(playArea.style.WebkitTapHighlightColor).toBe('transparent');
    const selectionEvent = new Event('selectstart', { bubbles: true, cancelable: true });
    playArea.dispatchEvent(selectionEvent);
    expect(selectionEvent.defaultPrevented).toBe(true);
    const contextEvent = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
    playArea.dispatchEvent(contextEvent);
    expect(contextEvent.defaultPrevented).toBe(true);
  });
});
