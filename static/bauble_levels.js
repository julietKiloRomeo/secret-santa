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
  {
    name: 'Stigning',
    // The bauble lands on a sloping ledge and rolls down into the bowl on the right.
    ropes: [{ peg: { x: 320, y: 100 }, length: 260, segments: 11 }],
    baubles: [{ x: 320, y: 360 }],
    walls: [{ x: 320, y: 520, w: 300, h: 22, angle: 0.3 }],
    stocking: { x: 520, y: 820, w: 120, h: 80 },
    solution: [{ from: { x: 180, y: 220 }, to: { x: 460, y: 220 } }],
  },
  {
    name: 'Tragt',
    // Two ledges form a funnel under the rope; the bauble drops in and is guided to the bowl.
    ropes: [{ peg: { x: 200, y: 100 }, length: 300, segments: 12 }],
    baubles: [{ x: 200, y: 400 }],
    walls: [
      { x: 150, y: 560, w: 220, h: 22, angle: 0.5 },
      { x: 510, y: 560, w: 220, h: 22, angle: -0.5 },
    ],
    stocking: { x: 330, y: 800, w: 120, h: 80 },
    solution: [{ from: { x: 100, y: 200 }, to: { x: 300, y: 200 } }],
  },
  {
    name: 'Dobbelt',
    // Two ropes hang the bauble; cutting the second one lets it swing into the bowl.
    ropes: [
      { peg: { x: 160, y: 100 }, length: 220, segments: 10 },
      { peg: { x: 480, y: 100 }, length: 220, segments: 10 },
    ],
    baubles: [{ x: 320, y: 340 }],
    walls: [],
    stocking: { x: 320, y: 820, w: 120, h: 80 },
    solution: [{ from: { x: 380, y: 190 }, to: { x: 540, y: 190 } }],
  },
];
