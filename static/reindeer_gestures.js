function createGestureInterpreter(options = {}) {
  const {
    onJump = () => {},
    onDoubleJump = () => {},
    onDash = () => {},
    onDuckStart = () => {},
    onDuckEnd = () => {},
    now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now()),
  } = options;

  const thresholds = {
    swipeRight: 48,
    swipeDown: 36,
    maxDiagonal: 90,
  };

  const state = {
    grounded: true,
    doubleUsed: false,
    pointerActive: false,
    pointerId: null,
    startX: 0,
    startY: 0,
    startTime: 0,
    swipeType: null,
    ducking: false,
  };

  function setGrounded(isGrounded) {
    state.grounded = Boolean(isGrounded);
    if (isGrounded) {
      state.doubleUsed = false;
      state.swipeType = null;
    }
  }

  function pointerDown(ev) {
    if (state.pointerActive && ev.pointerId !== state.pointerId) return;
    state.pointerActive = true;
    state.pointerId = ev.pointerId;
    state.startX = ev.clientX || 0;
    state.startY = ev.clientY || 0;
    state.startTime = now();
    state.swipeType = null;
    if (ev.preventDefault) ev.preventDefault();
  }

  function detectSwipe(dx, dy) {
    if (state.swipeType) return state.swipeType;
    const absX = Math.abs(dx);
    const absY = Math.abs(dy);
    if (dx > thresholds.swipeRight && absY < thresholds.maxDiagonal) {
      state.swipeType = 'dash';
      onDash();
    } else if (dy > thresholds.swipeDown && absX < thresholds.maxDiagonal) {
      state.swipeType = 'duck';
      if (!state.ducking) {
        state.ducking = true;
        onDuckStart();
      }
    }
    return state.swipeType;
  }

  function pointerMove(ev) {
    if (!state.pointerActive || ev.pointerId !== state.pointerId) return;
    const dx = (ev.clientX || 0) - state.startX;
    const dy = (ev.clientY || 0) - state.startY;
    const swipe = detectSwipe(dx, dy);
    if (swipe && ev.preventDefault) ev.preventDefault();
  }

  function finishDuck() {
    if (state.ducking) {
      state.ducking = false;
      onDuckEnd();
    }
  }

  function pointerUp(ev) {
    if (!state.pointerActive || ev.pointerId !== state.pointerId) return;
    if (state.swipeType === 'duck') {
      finishDuck();
    } else if (state.swipeType === 'dash') {
      // dash already dispatched on move
    } else {
      const held = now() - state.startTime;
      if (state.grounded) {
        onJump(held);
      } else if (!state.doubleUsed) {
        state.doubleUsed = true;
        onDoubleJump(held);
      }
    }
    if (ev.preventDefault) ev.preventDefault();
    state.pointerActive = false;
    state.pointerId = null;
    state.swipeType = null;
  }

  function pointerCancel() {
    if (state.swipeType === 'duck') {
      finishDuck();
    }
    state.pointerActive = false;
    state.pointerId = null;
    state.swipeType = null;
  }

  function getState() {
    return { ...state };
  }

  return {
    pointerDown,
    pointerMove,
    pointerUp,
    pointerCancel,
    setGrounded,
    getState,
  };
}

const api = { createGestureInterpreter };

if (typeof module !== 'undefined') {
  module.exports = api;
}
if (typeof window !== 'undefined') {
  window.ReindeerRushGestures = api;
}
