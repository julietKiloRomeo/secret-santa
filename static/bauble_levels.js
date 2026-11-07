// Nissen & Kuglen levels. Only the cut is an action: a rope is a chain from a peg to a bauble.
// World is fixed; the view fits it to the screen (world_fit).
// solution: the swipes that solve the level, in order. The browser solver plays exactly these.
export const WORLD = { width: 640, height: 900 };

export const LEVELS = [
  {
    name: 'Første klip',
    ropes: [{ peg: { x: 320, y: 120 }, length: 360, segments: 12 }],
    baubles: [{ x: 320, y: 480 }],
    walls: [],
    stocking: { x: 320, y: 820, w: 120, h: 80 },
    solution: [{ from: { x: 150, y: 270 }, to: { x: 490, y: 270 } }],
  },
  {
    name: 'Skråt',
    // The rope hangs straight down, but a ledge sits between the bauble and the stocking.
    // Cut the rope and the bauble lands on the ledge's far side.
    ropes: [{ peg: { x: 200, y: 120 }, length: 360, segments: 12 }],
    baubles: [{ x: 200, y: 480 }],
    walls: [{ x: 230, y: 600, w: 260, h: 22, angle: 0.35 }],
    stocking: { x: 420, y: 820, w: 120, h: 80 },
    solution: [{ from: { x: 100, y: 270 }, to: { x: 300, y: 270 } }],
  },
];
