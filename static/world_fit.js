// Fixed-height world that adapts its width to the screen. Pure, no Phaser.
// Scale is the largest that fits the height and never crops; when the screen is too narrow for
// the minimum world width we scale down to fit that width instead (black bars top and bottom).
export function worldFor(screenW, screenH, worldH, minW = worldH) {
  const scale = Math.min(screenH / worldH, screenW / minW);
  const width = Math.max(minW, Math.floor(screenW / scale));
  return { width, height: worldH, scale };
}
