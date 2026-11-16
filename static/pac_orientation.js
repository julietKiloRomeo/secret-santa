// Pac-Santa orientation helpers. Pure, no Phaser.
// Portrait screens use a tall maze, landscape screens the same maze transposed (swapped rows and columns).
export function transpose(rows) {
  const h = rows.length;
  const w = rows[0].length;
  return Array.from({ length: w }, (_, x) => Array.from({ length: h }, (_, y) => rows[y][x]).join(''));
}

// Portrait is 30 wide by 40 tall; landscape swaps the two so the maze fills the screen.
export function mazeSizeFor(screenW, screenH) {
  return screenW >= screenH ? { cols: 40, rows: 30 } : { cols: 30, rows: 40 };
}
