import { loadSongCharts, SONG_MANIFEST } from '../static/jingle_bell_hero_chart';

const demoSong = [{ time: 0, notes: [{ pitch: 'c4', lane: 1, tied: false }] }];

describe('loadSongCharts', () => {
  test('fetches each manifest entry from provided base', async () => {
    const base = '/static/songs';
    const fetchMock = jest.fn(() =>
      Promise.resolve({
        ok: true,
        json: async () => demoSong,
      }),
    );

    const charts = await loadSongCharts(fetchMock, base);
    expect(fetchMock).toHaveBeenCalledTimes(SONG_MANIFEST.length);
    SONG_MANIFEST.forEach((entry) => {
      expect(fetchMock).toHaveBeenCalledWith(`${base}/${entry.file}`);
    });
    expect(Object.keys(charts)).toEqual(SONG_MANIFEST.map((e) => e.id));
  });
});
