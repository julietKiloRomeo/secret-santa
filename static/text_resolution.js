// Canvas text is drawn at logical size and then stretched by Scale.FIT, which looks soft.
// Text resolution is the on-screen pixel density, clamped to a safe range.
export const MAX_TEXT_RESOLUTION = 4;

export function textResolution({ displayScale = 1, devicePixelRatio = 1 }) {
  const want = Math.max(1, displayScale) * Math.max(1, devicePixelRatio);
  return Math.min(MAX_TEXT_RESOLUTION, Math.max(1, want));
}

// Sharpen a Phaser text object for the scene's current on-screen scale. Call after creating it.
export function sharpen(scene, textObj) {
  const ds = scene.scale.displayScale?.x ?? 1;
  const dpr = globalThis.devicePixelRatio ?? 1;
  return textObj.setResolution(textResolution({ displayScale: 1 / ds, devicePixelRatio: dpr }));
}
