// Nissen & Kuglen levels. Only the cut is an action: a rope is a chain from a peg to a bauble.
// World is fixed; the view fits it to the screen (world_fit).
export const WORLD = { width: 640, height: 900 };

export const LEVELS = [
  {
    name: 'Første klip',
    // A rope from a peg holds the bauble over the stocking.
    ropes: [{ peg: { x: 320, y: 120 }, length: 360, segments: 12 }],
    baubles: [{ x: 320, y: 480 }],
    walls: [],
    stocking: { x: 320, y: 820, w: 120, h: 80 },
  },
];
