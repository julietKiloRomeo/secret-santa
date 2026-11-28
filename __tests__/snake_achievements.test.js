import { reachedSnakeIds, SNAKE_TRACKS, snakeTierName } from '../static/snake_achievements';

test('no stats reached means no ids', () => {
  expect(reachedSnakeIds({})).toEqual([]);
});

test('tier ids resolve to their badge names', () => {
  expect(snakeTierName('advent-1:loops:1')).toBe('Nidhogg');
  expect(snakeTierName('advent-1:loops:3')).toBe('Midgårdsormen');
  expect(snakeTierName('advent-1:other:1')).toBeNull();
});

test('a loop tier is sent for every loop count reached', () => {
  expect(reachedSnakeIds({ maxLoops: 2 })).toEqual(['advent-1:loops:1', 'advent-1:loops:2']);
  expect(reachedSnakeIds({ maxLoops: 3 })).toContain('advent-1:loops:3');
});

test('only ghost loops unlock achievements, even with many shields and trims', () => {
  expect(Object.keys(SNAKE_TRACKS)).toEqual(['loops']);
  expect(reachedSnakeIds({ maxShields: 100, trims: 100 })).toEqual([]);
});

test('the track ids match the server id format and the spec tier counts', () => {
  for (const [track, { tiers }] of Object.entries(SNAKE_TRACKS)) {
    expect(track).toMatch(/^[a-z]+$/);
    expect(tiers).toHaveLength(3);
  }
});
