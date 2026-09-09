// Offline-first outbox wiring for the task list (roadmap item 3).
//
// Pins the contract saveTasks now has with services/offlineQueue:
//   • pond unreachable → the write is PARKED and the optimistic list STANDS
//     (no revert, no alert);
//   • a permanent 4xx → revert + alert, exactly as before the outbox.
import { renderHook, act } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { useTaskData } from '../useTaskData';
import { __resetForTests, getPending } from '../../../../services/offlineQueue';

const mockStore = new Map();
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn((k) => Promise.resolve(mockStore.has(k) ? mockStore.get(k) : null)),
  setItem: jest.fn((k, v) => { mockStore.set(k, v); return Promise.resolve(); }),
  removeItem: jest.fn((k) => { mockStore.delete(k); return Promise.resolve(); }),
}));
jest.mock('../../../../context/ServerContext', () => ({ getApiAuthToken: () => 'tok' }));

const networkError = () => new Error('Network request failed');
const httpError = (status) => new Error(`API Error ${status}: nope`);

const makeApi = ({ post }) => ({
  get: jest.fn(async (path) => {
    if (path === '/tasks') return [{ id: 't1', title: 'one', completed: false }];
    if (path === '/projects') return [];
    if (path === '/tags') return [];
    return [];
  }),
  post: jest.fn(post),
});

beforeEach(() => {
  mockStore.clear();
  __resetForTests();
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

const flush = () => act(async () => { await new Promise((r) => setTimeout(r, 0)); });

describe('useTaskData saveTasks through the outbox', () => {
  test('offline: the optimistic list stands and the write is parked under tasks:all', async () => {
    const api = makeApi({ post: () => Promise.reject(networkError()) });
    const { result } = await renderHook(() => useTaskData(api, true, null));
    await flush();

    const next = [{ id: 't1', title: 'one', completed: true }];
    await act(async () => { await result.current.saveTasks(next); });

    expect(result.current.tasks).toEqual(next);
    expect(Alert.alert).not.toHaveBeenCalled();
    const pending = getPending();
    expect(pending).toHaveLength(1);
    expect(pending[0]).toMatchObject({ method: 'post', path: '/tasks', key: 'tasks:all' });

    // A second offline edit collapses onto the same entry — one POST later.
    const next2 = [{ id: 't1', title: 'one renamed', completed: true }];
    await act(async () => { await result.current.saveTasks(next2); });
    expect(getPending()).toHaveLength(1);
    expect(getPending()[0].body).toEqual(next2);
    expect(result.current.tasks).toEqual(next2);
  });

  test('permanent 4xx: reverts and alerts, nothing parked', async () => {
    const api = makeApi({ post: () => Promise.reject(httpError(400)) });
    const { result } = await renderHook(() => useTaskData(api, true, null));
    await flush();
    const before = result.current.tasks;

    const next = [{ id: 't1', title: 'one', completed: true }];
    await act(async () => {
      await expect(result.current.saveTasks(next)).rejects.toBeTruthy();
    });

    expect(result.current.tasks).toEqual(before);
    expect(Alert.alert).toHaveBeenCalled();
    expect(getPending()).toHaveLength(0);
  });
});
