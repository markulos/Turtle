const mockStore = new Map();
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn((k) => Promise.resolve(mockStore.has(k) ? mockStore.get(k) : null)),
  setItem: jest.fn((k, v) => { mockStore.set(k, v); return Promise.resolve(); }),
  removeItem: jest.fn((k) => { mockStore.delete(k); return Promise.resolve(); }),
}));

const mockAssets = { list: [] };
const mockPerm = { status: 'granted' };
jest.mock('expo-media-library', () => ({
  SortBy: { creationTime: 'creationTime' },
  MediaType: { photo: 'photo', video: 'video' },
  getPermissionsAsync: jest.fn(() => Promise.resolve({ status: mockPerm.status })),
  requestPermissionsAsync: jest.fn(() => Promise.resolve({ status: mockPerm.status })),
  getAssetsAsync: jest.fn(({ createdAfter }) => Promise.resolve({
    assets: mockAssets.list.filter((a) => a.creationTime > (createdAfter || 0)),
    hasNextPage: false,
  })),
  addListener: jest.fn(() => ({ remove: jest.fn() })),
}));

import {
  AUTO_UPLOAD_KEY,
  __resetAutoUploadForTests,
  getAutoUploadSettings,
  runAutoUpload,
  scanNewAssets,
  setAutoUploadEnabled,
} from '../cameraRollAutoUpload';

const asset = (id, t, mediaType = 'photo') => ({ id, uri: `ph://${id}`, filename: `${id}.heic`, mediaType, creationTime: t, width: 4000, height: 3000 });

beforeEach(() => {
  mockStore.clear();
  mockAssets.list = [];
  mockPerm.status = 'granted';
  __resetAutoUploadForTests();
  jest.spyOn(Date, 'now').mockReturnValue(1_000_000);
});
afterEach(() => jest.restoreAllMocks());

test('off by default: no scan, nothing queued', async () => {
  mockAssets.list = [asset('a', 1_500_000)];
  expect(await scanNewAssets()).toEqual([]);
  expect(await runAutoUpload({ enqueue: jest.fn() })).toBe(0);
});

test('turning on sets the watermark to now, so only NEW photos upload', async () => {
  const r = await setAutoUploadEnabled(true);
  expect(r).toMatchObject({ enabled: true, granted: true, watermark: 1_000_000 });
  mockAssets.list = [asset('old', 900_000), asset('new1', 1_100_000), asset('new2', 1_200_000, 'video')];
  const enqueue = jest.fn(() => true);
  expect(await runAutoUpload({ enqueue })).toBe(2);
  expect(enqueue).toHaveBeenCalledTimes(1);
  const { assets, tags } = enqueue.mock.calls[0][0];
  expect(assets.map((a) => a.assetId)).toEqual(['new1', 'new2']); // oldest first
  expect(assets[1].type).toBe('video');
  expect(tags).toEqual(['Phone Uploads']);
  expect((await getAutoUploadSettings()).watermark).toBe(1_200_000);
  expect(JSON.parse(mockStore.get(AUTO_UPLOAD_KEY)).lastCount).toBe(2);
  // a second scan finds nothing new
  expect(await runAutoUpload({ enqueue })).toBe(0);
  expect(enqueue).toHaveBeenCalledTimes(1);
});

test('a busy uploader (enqueue → false) keeps the watermark, so the next trigger retries', async () => {
  await setAutoUploadEnabled(true);
  mockAssets.list = [asset('n', 1_100_000)];
  expect(await runAutoUpload({ enqueue: () => false })).toBe(0);
  expect((await getAutoUploadSettings()).watermark).toBe(1_000_000);
  expect(await runAutoUpload({ enqueue: () => true })).toBe(1);
});

test('permission denied: the switch does not turn on', async () => {
  mockPerm.status = 'denied';
  const r = await setAutoUploadEnabled(true);
  expect(r.granted).toBe(false);
  expect((await getAutoUploadSettings()).enabled).toBe(false);
});
