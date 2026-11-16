// Board size in cells, matched to the screen's aspect ratio so the board fills the screen.
// Keeps about 20x20 cells of area on every screen. Pure, no Phaser.
const CELLS = 400;
export function boardFor(screenW, screenH) {
  const aspect = screenW / screenH;
  const rows = Math.max(10, Math.round(Math.sqrt(CELLS / aspect)));
  const cols = Math.max(10, Math.round(rows * aspect));
  return { cols, rows };
}
