jest.mock('../static/arcade_scores.js', () => ({
  fetchScores: jest.fn().mockResolvedValue([]),
  submitScore: jest.fn().mockResolvedValue(true),
  qualifies: jest.fn().mockReturnValue(true),
  LIMIT: 10,
  MAX_NAME: 18,
}));

test('score entry opts out of password managers and still submits the player name', async () => {
  global.Phaser = { Scene: class {} };
  const { showScores } = require('../static/arcade_scene.js');
  const { submitScore } = require('../static/arcade_scores.js');
  const game = { scene: { get: () => null, add: jest.fn(), pause: jest.fn(), launch: jest.fn() } };
  showScores(game, { gameId: 'advent-1', score: 3 });
  const ScoresScene = game.scene.add.mock.calls[0][1];
  const scene = new ScoresScene();
  scene.input = { keyboard: { disableGlobalCapture: jest.fn() } };
  scene.events = { once: jest.fn() };
  HTMLDialogElement.prototype.showModal = jest.fn();

  await scene.create({ gameId: 'advent-1', score: 3, onClose: jest.fn() });
  const form = document.querySelector('.arcade-score-form');
  const input = form.querySelector('input');
  expect(form.getAttribute('autocomplete')).toBe('off');
  expect(input.getAttribute('autocomplete')).toBe('off');
  expect(input.getAttribute('data-1p-ignore')).toBe('true');
  expect(input.getAttribute('data-lpignore')).toBe('true');
  expect(input.getAttribute('data-bwignore')).toBe('true');

  input.value = 'Nisse';
  form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  expect(submitScore).toHaveBeenCalledWith('advent-1', 'Nisse', 3);
  document.body.replaceChildren();
});
