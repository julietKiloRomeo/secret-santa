// Nissen & Kuglen level data. World is fixed; the view stretches it to the screen (world_fit).
// Pieces: ramp | block | rope. movable/removable say what the player may do to a piece.
export const WORLD = { width: 640, height: 900 };

export const LEVELS = [
  {
    name: 'Første fald',
    bauble: { x: 220, y: 120 },
    star: { x: 220, y: 780, r: 34 },
    pieces: [{ kind: 'block', x: 220, y: 330, w: 160, h: 24, angle: 0, movable: true, removable: true }],
  },
  {
    name: 'Rampen',
    bauble: { x: 120, y: 120 },
    star: { x: 520, y: 780, r: 34 },
    pieces: [
      { kind: 'ramp', x: 240, y: 300, w: 300, h: 22, angle: 0.35, movable: true, removable: true },
      { kind: 'block', x: 380, y: 520, w: 120, h: 24, angle: 0, movable: true, removable: false },
    ],
  },
  {
    name: 'Snoren',
    bauble: { x: 320, y: 110 },
    star: { x: 320, y: 800, r: 34 },
    pieces: [
      { kind: 'rope', x: 320, y: 280, length: 200, movable: false, removable: true },
      { kind: 'block', x: 200, y: 520, w: 200, h: 24, angle: -0.2, movable: true, removable: true },
    ],
  },
  {
    name: 'Tre stænger',
    bauble: { x: 160, y: 120 },
    star: { x: 500, y: 800, r: 34 },
    pieces: [
      { kind: 'block', x: 160, y: 300, w: 180, h: 22, angle: 0.1, movable: true, removable: true },
      { kind: 'block', x: 330, y: 480, w: 180, h: 22, angle: -0.2, movable: true, removable: true },
      { kind: 'block', x: 490, y: 640, w: 150, h: 22, angle: 0.3, movable: true, removable: true },
    ],
  },
  {
    name: 'Skrå bane',
    bauble: { x: 100, y: 140 },
    star: { x: 560, y: 820, r: 34 },
    pieces: [
      { kind: 'ramp', x: 300, y: 260, w: 340, h: 22, angle: 0.5, movable: true, removable: true },
      { kind: 'ramp', x: 360, y: 500, w: 260, h: 22, angle: -0.45, movable: true, removable: true },
      { kind: 'block', x: 520, y: 700, w: 120, h: 24, angle: 0, movable: true, removable: false },
    ],
  },
  {
    name: 'Julestjernen',
    bauble: { x: 320, y: 100 },
    star: { x: 320, y: 840, r: 30 },
    pieces: [
      { kind: 'rope', x: 320, y: 240, length: 160, movable: false, removable: true },
      { kind: 'ramp', x: 200, y: 420, w: 260, h: 22, angle: 0.4, movable: true, removable: true },
      { kind: 'ramp', x: 440, y: 580, w: 260, h: 22, angle: -0.4, movable: true, removable: true },
      { kind: 'block', x: 320, y: 730, w: 160, h: 24, angle: 0, movable: true, removable: false },
    ],
  },
];
