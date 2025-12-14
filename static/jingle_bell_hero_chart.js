export const DIFFICULTIES = {
  easy: {
    speeds: [
      { name: 'Easy Slow', bpm: 85, speedMultiplier: 0.85 },
      { name: 'Easy Medium', bpm: 90, speedMultiplier: 0.9 },
      { name: 'Easy Fast', bpm: 95, speedMultiplier: 0.95 },
    ],
  },
  hard: {
    speeds: [
      { name: 'Hard Slow', bpm: 95, speedMultiplier: 0.95 },
      { name: 'Hard Medium', bpm: 100, speedMultiplier: 1.0 },
      { name: 'Hard Fast', bpm: 105, speedMultiplier: 1.05 },
    ],
  },
};

export const SONG_MANIFEST = [
  { id: 'partridge-1', file: 'partridge-1.json' },
  { id: 'partridge-2', file: 'partridge-2.json' },
  { id: 'partridge-3', file: 'partridge-3.json' },
];

export const PROGRESSION = [
  { difficulty: 'easy', speedIndex: 0, songId: 'partridge-1' },
  { difficulty: 'easy', speedIndex: 1, songId: 'partridge-1' },
  { difficulty: 'easy', speedIndex: 2, songId: 'partridge-2' },
  { difficulty: 'hard', speedIndex: 0, songId: 'partridge-2' },
  { difficulty: 'hard', speedIndex: 1, songId: 'partridge-3' },
  { difficulty: 'hard', speedIndex: 2, songId: 'partridge-3' },
];

function computeBaseUrl(explicit) {
  if (explicit) return explicit.replace(/\/$/, '');
  if (typeof window !== 'undefined' && window.__jbhSongBase) {
    return String(window.__jbhSongBase).replace(/\/$/, '');
  }
  return '/static/songs';
}

export async function loadSongCharts(fetchImpl, baseUrl) {
  const fetcher = fetchImpl || (typeof fetch !== 'undefined' ? fetch : null);
  if (!fetcher) {
    throw new Error('fetch is not available for loading songs');
  }
  const base = computeBaseUrl(baseUrl);
  const results = {};
  for (const entry of SONG_MANIFEST) {
    const url = `${base}/${entry.file}`;
    const resp = await fetcher(url);
    if (!resp.ok) {
      throw new Error(`Failed to load song "${entry.id}" (${resp.status}) from ${url}`);
    }
    results[entry.id] = await resp.json();
  }
  return results;
}
