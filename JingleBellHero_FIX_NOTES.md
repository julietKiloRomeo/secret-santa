# Jingle Bell Hero: Current Bug Status

## What’s broken
- **Notes invisible**: Expected Guitar Hero–style note circles/holds scrolling toward the hit line; currently nothing shows on the playfield during gameplay.
- **Bells missing/partially visible**: Bell targets sometimes disappear or sit outside the viewport, especially on mobile.
- **Keyboard hits unreliable**: Mouse/touch taps can register, but keyboard keys rarely/never score.
- **Mobile layout cramped**: Not all bells are visible on smaller screens; existing title/subtitle/leaderboard chrome reduce the usable area.
- **Confidence gap**: No verified visual that notes render; assumptions may be wrong. Need to capture screenshots to validate.

## Expected behavior
- Four bells visible across the bottom, always in view on desktop and mobile.
- Notes (including long holds) spawn from the chart JSON (partridge-1/2/3) and scroll down toward a clearly visible hit line, reaching the bells at the correct times.
- Keyboard controls (`D`, `F`, `J`, `K`) hit the corresponding lanes consistently; touch/mouse taps also work.
- Minimal chrome: prioritize playfield visibility; hide title/subtitle/leaderboard box below the game.

## Investigation steps to redo
1. Load `/tredje-advent` and confirm the SVG contains bell targets and a hit line at the bottom.
2. Verify `partridge-*.json` events load and populate an in-memory note list; log/count visible notes.
3. Check render math: lane X positions, Y positions relative to `HIT_ZONE_Y`, and scroll speed/timestamps.
4. Ensure hit line and bells are **inside** the SVG (not separate HTML), so notes and targets share the same coordinate space and stay visible with `preserveAspectRatio`.
5. Test inputs: keyboard mapping, touch/click handlers, and focus/ARIA to let tests locate bells.
6. Capture screenshots (desktop + mobile viewport) to confirm notes are drawn and moving.
7. Add/adjust Playwright tests to assert notes appear, move downward over time, and align with hit line.

## Assets & mapping
- Songs live in `static/songs/`:
  - Levels 1–2: `partridge-1.json`
  - Levels 3–4: `partridge-2.json`
  - Levels 5–6: `partridge-3.json`
- Use the JSON **events** format (not `.chart`) for gameplay.

## Guardrails
- Keep rendering within a single SVG for alignment.
- Keep bells and hit line visible on mobile; remove extra title/leaderboard chrome to free space.
- Maintain keyboard + touch parity.
- Use the existing test harness to validate (unit/Jest + Playwright).
