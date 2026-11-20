// Feedback tuning for Jule Snake. Tiers follow game-feel: pickup = medium, death = large.
// Pure values, no Phaser, so the tiers are checked by Jest.
export const FEEL = {
  pickup: { stopMs: 50, trauma: 0.35, burstCount: 10, popScale: 1.4, popMs: 180 },
  death: { stopMs: 120, trauma: 0.9, flashMs: 160 },
};
