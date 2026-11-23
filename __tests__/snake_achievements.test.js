import { reachedSnakeIds, SNAKE_TRACKS } from '../static/snake_achievements';

test('no stats reached means no ids', () => {
  expect(reachedSnakeIds({})).toEqual([]);
});

test('a loop tier is sent for every loop count reached', () => {
  expect(reachedSnakeIds({ maxLoops: 2 })).toEqual(['advent-1:loops:1', 'advent-1:loops:2']);
  expect(reachedSnakeIds({ maxLoops: 3 })).toContain('advent-1:loops:3');
});

test('shield and trim tiers unlock at 3, 6 and 10', () => {
  expect(reachedSnakeIds({ maxShields: 5 })).toEqual(['advent-1:shield:3']);
  expect(reachedSnakeIds({ trims: 6 })).toEqual(['advent-1:trim:3', 'advent-1:trim:6']);
});

test('the track ids match the server id format and the spec tier counts', () => {
  for (const [track, { tiers }] of Object.entries(SNAKE_TRACKS)) {
    expect(track).toMatch(/^[a-z]+$/);
    expect(tiers).toHaveLength(3);
  }
});
