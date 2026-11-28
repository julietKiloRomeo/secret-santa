// Leaderboard helpers shared by all advent games (talks to /api/scores/{game}).
export const LIMIT = 10;
export const MAX_NAME = 18; // same cap as app.py

export const qualifies = (scores, score) =>
  score > 0 && (scores.length < LIMIT || score > scores[LIMIT - 1].score);

// Index the new score would take; ties go below existing entries.
export const rankFor = (scores, score) => {
  const i = scores.findIndex((s) => score > s.score);
  return i === -1 ? scores.length : i;
};

export async function fetchScores(gameId) {
  try {
    const resp = await fetch(`/api/scores/${gameId}`);
    if (!resp.ok) return null;
    const { scores } = await resp.json();
    return Array.isArray(scores) ? scores : null;
  } catch {
    return null;
  }
}

export async function submitScore(gameId, name, score) {
  const resp = await fetch(`/api/scores/${gameId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, score }),
  });
  return resp.ok;
}
