// cameraRollAutoUpload — background-uploads Phase 5: new camera photos and
// videos go to the vault on their own (the iCloud-like goal), behind a
// Settings switch.
//
// How: a WATERMARK (the creation time of the newest asset already handed to
// the uploader) lives in AsyncStorage. A scan asks the media library for
// assets created after it, hands them to VaultUploadContext.enqueue exactly
// like the device picker does, and moves the watermark forward only when the
// uploader accepted the batch. Scans run when the app comes to the
// foreground, when the library reports a change while the app is open, and
// inside the Phase 2 background window (services/backgroundUploadTask) — iOS
// never runs a third-party app on "photo taken", so that window is as close
// as it gets.
//
// Dedupe is the uploader's job (fingerprint check before any bytes move), so
// a photo that reaches the pond twice by another road is still one photo.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState } from 'react-native';
import * as MediaLibrary from 'expo-media-library';

export const AUTO_UPLOAD_KEY = 'turtle:autoUpload:v1';
export const AUTO_UPLOAD_TAGS = ['Phone Uploads'];
/** Newest-first page per scan; the next scan picks up the rest. */
const SCAN_LIMIT = 200;
const LISTENER_DEBOUNCE_MS = 3000;

const DEFAULTS = { enabled: false, watermark: 0, lastScanAt: 0, lastCount: 0 };
let cache = null;

export async function getAutoUploadSettings() {
  if (cache) return cache;
  try {
    const raw = await AsyncStorage.getItem(AUTO_UPLOAD_KEY);
    cache = raw ? { ...DEFAULTS, ...JSON.parse(raw) } : { ...DEFAULTS };
  } catch {
    cache = { ...DEFAULTS };
  }
  return cache;
}

async function save(patch) {
  const next = { ...(await getAutoUploadSettings()), ...patch };
  cache = next;
  try { await AsyncStorage.setItem(AUTO_UPLOAD_KEY, JSON.stringify(next)); } catch { /* next launch re-reads */ }
  return next;
}

/**
 * Turn the feature on or off. Turning ON asks for the photo-library
 * permission and, the first time, sets the watermark to NOW: only photos
 * taken from here on upload by themselves (older ones stay a Smart Sync
 * choice). Resolves the saved settings; `granted` false means the switch
 * could not be turned on.
 */
export async function setAutoUploadEnabled(enabled) {
  if (!enabled) return { ...(await save({ enabled: false })), granted: true };
  let granted = false;
  try {
    let { status } = await MediaLibrary.getPermissionsAsync();
    if (status !== 'granted') ({ status } = await MediaLibrary.requestPermissionsAsync());
    granted = status === 'granted';
  } catch { granted = false; }
  if (!granted) return { ...(await getAutoUploadSettings()), granted: false };
  const cur = await getAutoUploadSettings();
  const next = await save({ enabled: true, watermark: cur.watermark || Date.now() });
  return { ...next, granted: true };
}

const toUploadAsset = (a) => ({
  assetId: a.id || null,
  uri: a.uri || null,
  fileName: a.filename || (a.uri ? String(a.uri).split('/').pop() : null),
  mimeType: a.mimeType || null,
  type: a.mediaType === 'video' ? 'video' : 'image',
  duration: a.duration || null,
  width: a.width || null,
  height: a.height || null,
  creationTime: a.creationTime || 0,
});

/** Assets created after the watermark, oldest first, already in enqueue shape. */
export async function scanNewAssets() {
  const s = await getAutoUploadSettings();
  if (!s.enabled) return [];
  try {
    const { status } = await MediaLibrary.getPermissionsAsync();
    if (status !== 'granted') return [];
  } catch { return []; }
  const result = await MediaLibrary.getAssetsAsync({
    first: SCAN_LIMIT,
    sortBy: [[MediaLibrary.SortBy.creationTime, false]],
    mediaType: [MediaLibrary.MediaType.photo, MediaLibrary.MediaType.video],
    createdAfter: s.watermark || 0,
  });
  const fresh = (result?.assets || [])
    .filter((a) => a && (a.creationTime || 0) > (s.watermark || 0))
    .map(toUploadAsset)
    .sort((a, b) => a.creationTime - b.creationTime);
  return fresh;
}

let running = false;

/**
 * One scan + one batch. `enqueue` is VaultUploadContext's action; it returns
 * false when a batch is already running (the watermark then stays put and
 * the next trigger picks these up again). Resolves the number queued.
 */
export async function runAutoUpload({ enqueue }) {
  if (running || typeof enqueue !== 'function') return 0;
  running = true;
  try {
    const assets = await scanNewAssets();
    if (assets.length === 0) { await save({ lastScanAt: Date.now() }); return 0; }
    const ok = enqueue({ assets, tags: AUTO_UPLOAD_TAGS });
    if (!ok) return 0;
    const watermark = assets.reduce((m, a) => Math.max(m, a.creationTime || 0), 0);
    await save({ watermark, lastScanAt: Date.now(), lastCount: assets.length });
    return assets.length;
  } catch (e) {
    console.warn('[AutoUpload] scan failed:', e?.message || e);
    return 0;
  } finally {
    running = false;
  }
}

/**
 * Wire the foreground triggers: the app becoming active, and the library
 * changing while it is open (debounced — a burst of new photos is one scan).
 * Returns an unsubscribe.
 */
export function subscribeAutoUpload({ enqueue }) {
  let timer = null;
  const kick = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => { timer = null; runAutoUpload({ enqueue }); }, LISTENER_DEBOUNCE_MS);
  };
  const app = AppState.addEventListener('change', (s) => { if (s === 'active') kick(); });
  let lib = null;
  try { lib = MediaLibrary.addListener(() => { if (AppState.currentState === 'active') kick(); }); } catch { lib = null; }
  kick(); // the launch itself is a trigger
  return () => {
    if (timer) clearTimeout(timer);
    app.remove();
    try { lib?.remove?.(); } catch { /* already gone */ }
  };
}

/** Tests only. */
export function __resetAutoUploadForTests() { cache = null; running = false; }
