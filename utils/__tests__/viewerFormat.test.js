import { formatViewerTimestamp, formatViewerResolution, parseTags, isFavourite } from '../viewerFormat';

describe('formatViewerTimestamp', () => {
  test('original date → date and time', () => {
    const s = formatViewerTimestamp({ originalDate: '2026-09-09T14:03:00' });
    expect(s).toMatch(/Sep 9, 2026/);
    expect(s).toMatch(/2:03/);
  });
  test('upload date only → date', () => {
    const s = formatViewerTimestamp({ uploadDate: '2026-09-09T14:03:00' });
    expect(s).toMatch(/Sep 9, 2026/);
    expect(s).not.toMatch(/2:03/);
  });
  test('epoch and garbage', () => {
    expect(formatViewerTimestamp({ originalDate: new Date(2026, 0, 2, 12).getTime() })).toMatch(/Jan 2, 2026/);
    expect(formatViewerTimestamp({ originalDate: 'nope' })).toBe('');
    expect(formatViewerTimestamp({})).toBe('');
    expect(formatViewerTimestamp(null)).toBe('');
  });
});

describe('formatViewerResolution', () => {
  test('dimensions and the video marker', () => {
    expect(formatViewerResolution({ width: 4032, height: 3024, type: 'image' })).toBe('4032 × 3024');
    expect(formatViewerResolution({ width: 1920, height: 1080, type: 'video' })).toBe('1920 × 1080 · Video');
    expect(formatViewerResolution({ type: 'video' })).toBe('Video');
    expect(formatViewerResolution({})).toBe('');
  });
});

describe('tags', () => {
  test('parseTags tolerates every shape', () => {
    expect(parseTags({ tags: '["A","B"]' })).toEqual(['A', 'B']);
    expect(parseTags({ tags: ['A'] })).toEqual(['A']);
    expect(parseTags({ tags: '{bad' })).toEqual([]);
    expect(parseTags({})).toEqual([]);
    expect(parseTags(null)).toEqual([]);
  });
  test('isFavourite', () => {
    expect(isFavourite({ tags: '["Favourites"]' })).toBe(true);
    expect(isFavourite({ tags: '["Trip"]' })).toBe(false);
  });
});
