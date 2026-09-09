/**
 * viewerFormat — what the photo viewer's chrome and details sheet print for a
 * media row. Pure functions over the row's own fields; every one tolerates a
 * missing or malformed value, because rows from older uploads carry less.
 *
 * Row fields read here: `originalDate` (ISO string or epoch ms, the capture
 * time), `uploadDate` (ISO string), `width` / `height` (source pixels), `type`
 * ('image' | 'video'), `tags` (a JSON string of an array — or, on a freshly
 * spread row, already an array).
 */

const DATE_TIME = { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' };
const DATE_ONLY = { year: 'numeric', month: 'short', day: 'numeric' };

function toDate(value) {
  if (value == null || value === '') return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** "Sep 9, 2026, 2:03 PM" from the capture time; the upload day if that's all there is. */
export function formatViewerTimestamp(item) {
  if (!item) return '';
  const taken = toDate(item.originalDate);
  if (taken) return taken.toLocaleString('en-US', DATE_TIME);
  const uploaded = toDate(item.uploadDate);
  if (uploaded) return uploaded.toLocaleDateString('en-US', DATE_ONLY);
  return '';
}

/** "4032 × 3024", with " · Video" for a video; "Video" alone when the size is unknown. */
export function formatViewerResolution(item) {
  if (!item) return '';
  const hasSize = item.width > 0 && item.height > 0;
  const size = hasSize ? `${item.width} × ${item.height}` : '';
  if (item.type === 'video') return size ? `${size} · Video` : 'Video';
  return size;
}

/** The row's tags as an array, whatever shape the row carries them in. */
export function parseTags(item) {
  if (!item || item.tags == null) return [];
  if (Array.isArray(item.tags)) return item.tags.filter((t) => typeof t === 'string');
  try {
    const parsed = JSON.parse(item.tags);
    return Array.isArray(parsed) ? parsed.filter((t) => typeof t === 'string') : [];
  } catch {
    return [];
  }
}

export const FAVOURITES_TAG = 'Favourites';

export function isFavourite(item) {
  return parseTags(item).includes(FAVOURITES_TAG);
}
