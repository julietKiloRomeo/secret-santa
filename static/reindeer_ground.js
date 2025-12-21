// Helpers for Reindeer Rush ground generation and collision using a sprite's surface row.
(function () {
  const SURFACE_ROW = 78;

  function extractSegmentsFromAlphaRow(alphaRow, minRun = 1) {
    if (!Array.isArray(alphaRow) || !alphaRow.length) {
      return [[0, 0]];
    }
    const segments = [];
    let start = null;
    for (let i = 0; i < alphaRow.length; i++) {
      const opaque = alphaRow[i] > 0;
      if (opaque && start === null) {
        start = i;
      } else if (!opaque && start !== null) {
        if (i - start >= minRun) {
          segments.push([start, i - 1]);
        }
        start = null;
      }
    }
    if (start !== null && alphaRow.length - start >= minRun) {
      segments.push([start, alphaRow.length - 1]);
    }
    if (!segments.length) {
      segments.push([0, alphaRow.length - 1]);
    }
    return segments;
  }

  function scaleSegments(segments, scale = 1, offset = 0) {
    if (!Array.isArray(segments)) return [];
    return segments.map(([start, end]) => [offset + start * scale, offset + (end + 1) * scale]);
  }

  function surfaceYAt(spans, surfaceY, x) {
    if (!Array.isArray(spans)) return null;
    for (const [start, end] of spans) {
      if (x >= start && x <= end) {
        return surfaceY;
      }
    }
    return null;
  }

  function createPlatform({ x = 0, surfaceY = 0, baseWidth = 1, baseSegments = [[0, 0]], scale = 1 } = {}) {
    const width = baseWidth * scale;
    const spans = scaleSegments(baseSegments, scale, x);
    return { x, surfaceY, width, scale, spans };
  }

  function buildScaledSpriteCache(img, scale = 1) {
    try {
      if (!img || typeof document === 'undefined') return null;
      const w = Math.max(1, Math.floor((img.naturalWidth || img.width) * scale));
      const h = Math.max(1, Math.floor((img.naturalHeight || img.height) * scale));
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      const ctx = c.getContext('2d');
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(img, 0, 0, w, h);
      return c;
    } catch (err) {
      console.warn('Unable to cache scaled sprite', err);
      return null;
    }
  }

  function planIslandsFromMask({
    startX = 0,
    baseY = 220,
    baseWidth = 200,
    segments = [[0, 1]],
    clusterRange = [1, 4],
    gapRange = [220, 420],
    jitterY = 12,
    scaleRange = [0.75, 1.05],
    islandCount = 4,
    minY = 140,
    maxY = 320,
  } = {}) {
    const rand = (min, max) => min + Math.random() * (max - min);
    const randInt = (min, max) => Math.floor(rand(min, max + 1));
    const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
    let cursor = startX;
    let surface = baseY;
    const islands = [];

    for (let i = 0; i < islandCount; i++) {
      const pieces = randInt(clusterRange[0], clusterRange[1]);
      const island = [];
      for (let p = 0; p < pieces; p++) {
        const scale = rand(scaleRange[0], scaleRange[1]);
        const y = clamp(surface + rand(-jitterY, jitterY), minY, maxY);
        const plat = createPlatform({ x: cursor, surfaceY: y, baseWidth, baseSegments: segments, scale });
        island.push(plat);
        const connector = rand(0, 18);
        cursor += plat.width + connector;
      }
      islands.push(island);
      const gap = rand(gapRange[0], gapRange[1]);
      surface = clamp(surface + rand(-60, 60), minY, maxY);
      cursor += gap;
    }
    return islands;
  }

  function buildSegmentsFromImage(img, row = SURFACE_ROW) {
    try {
      if (!img || typeof document === 'undefined') return null;
      const w = img.naturalWidth || img.width;
      const h = img.naturalHeight || img.height;
      if (!w || !h || row >= h) return null;
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
      const data = ctx.getImageData(0, row, w, 1).data;
      const alphaRow = [];
      for (let i = 0; i < w; i++) {
        alphaRow.push(data[i * 4 + 3]);
      }
      return extractSegmentsFromAlphaRow(alphaRow);
    } catch (err) {
      console.warn('Unable to build ground mask from image', err);
      return null;
    }
  }

  const api = {
    SURFACE_ROW,
    extractSegmentsFromAlphaRow,
    scaleSegments,
    surfaceYAt,
    createPlatform,
    planIslandsFromMask,
    buildSegmentsFromImage,
    buildScaledSpriteCache,
  };

  if (typeof module !== 'undefined') {
    module.exports = api;
  }
  if (typeof window !== 'undefined') {
    window.ReindeerGround = api;
  }
})();
