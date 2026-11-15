// World that fills the screen with no bars. Pure, no Phaser.
// The scale is the largest that fits the minimum world width (never cropping sides);
// the world height then follows the screen aspect so the canvas covers the full height.
// Height never drops below worldH, so the design stays readable on landscape screens.
export function worldFor(screenW, screenH, worldH, minW = worldH) {
  const scale = screenW / minW < screenH / worldH ? screenW / minW : screenH / worldH;
  const width = Math.max(minW, Math.floor(screenW / scale));
  const height = Math.max(worldH, Math.floor(screenH / scale));
  return { width, height, scale };
}
