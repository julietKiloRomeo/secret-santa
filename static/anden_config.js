/*
  Anden Advent — Gameplay configuration

  This file exports a simple global `window.__ANDEN_CONFIG__` object that
  the game (`static/anden_advent.js`) reads at startup. The goal is to make
  tuning gameplay parameters (gravity, reindeer offsets, speed scaling,
  gap sizes, spawn intervals, etc.) simple without editing the main game
  file.

  Friendly notes:
  - Values are expressed in logical units (px/s, ratios relative to canvas
    width, milliseconds) so they will be scaled by the game's responsive
    layout code.
  - Change values here and then refresh the page to test.
  - Keep `playerXRatio` and offset ratios between 0 and 1. Offsets are added
    as pixels after the layout code multiplies by canvas width.
  - `gapRatio` is multiplied by the canvas width to compute obstacle gap; if
    you want a hard minimum gap set `gapMin`.
  - `trailLengthMin` sets the minimum number of frames to keep in the trail
    buffer so trailing reindeer keep a convincing delay.

  Example: To make the game floatier, decrease `gravityPerSecond` and make
  flaps stronger by decreasing `flapVY` to a more negative value.
*/

window.__ANDEN_CONFIG__ = window.__ANDEN_CONFIG__ || {
  // Physics (base values before canvas scaling)
  gravityPerSecond: 800,     // px/s^2 (positive accelerates downward)
  flapVY: -260,              // px/s (negative = upward impulse)

  // Speed scaling
  baseSpeedPxPerS: 120,      // px/s base horizontal movement
  speedPerScorePxPerS: 6,    // px/s added per scored obstacle

  // Player / reindeer horizontal anchors expressed as ratios of canvas width
  // PLAYER_X is computed as canvasWidth * playerXRatio
  playerXRatio: 0.18,        // anchor X relative to canvas width
  leadOffsetXRatio: 0.3,   // lead reindeer offset from anchor
  secondOffsetXRatio: 0.2, // second reindeer offset from anchor
  // small pixel adjust applied to the third reindeer to keep spacing sane
  thirdOffsetXRatioAdjust: 0.1,

  // Obstacles (gap and spawn)
  gapRatio: 0.275 * 1.5,     // gap size as fraction of canvas width (50% taller for the new canvas)
  gapMin: 48,                // minimum gap in px

  // Trail and spawn tuning
  trailLengthMin: 80,        // minimum trail buffer entries
  spawnIntervalMsBase: Math.round(180 * (1000 / 60)), // ms between spawns base (double spacing for tall canvas)

  // Grace period at start (ms)
  graceMs: 1200,
  // Sprite scaling: multipliers applied to default sprite sizes
  // 1.0 = default size; values <1 shrink, >1 enlarge
  reindeerSpriteScale: 1.0,
  santaSpriteScale: 0.66,
  // Hitbox scale: fraction of the bird's width/height used for collision checks
  // Values <1 shrink the hitbox making collisions more forgiving
  reindeerHitBoxScale: 0.72,
};

/* End of config */
