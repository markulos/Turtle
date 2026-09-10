// renameProject: optimistic board rename — the list, every task on the board
// and the caller flip at once; PUT /projects/:name persists; revert on failure.
import { renderHook, act } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { useTaskData } from '../useTaskData';
import { __resetForTests } from '../../../../services/offlineQueue';

const mockStore = new Map();
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn((k) => Promise.resolve(mockStore.has(k) ? mockStore.get(k) : null)),
  setItem: jest.fn((k, v) => { mockStore.set(k, v); return Promise.resolve(); }),
  removeItem: jest.fn((k) => { mockStore.delete(k); return Promise.resolve(); }),
}));
jest.mock('../../../../context/ServerContext', () => ({ getApiAuthToken: () => 'tok' }));

const makeApi = ({ put }) => ({
  get: jest.fn(async (path) => {
    if (path === '/tasks') return [{ id: 't1', title: 'one', project: 'Old', completed: false }, { id: 't2', title: 'two', project: 'Other', completed: false }];
    if (path === '/projects') return ['Old', 'Other'];
    return [];
  }),
  post: jest.fn(async () => ({})),
  put: jest.fn(put),
});

beforeEach(() => {
  mockStore.clear();
  __resetForTests();
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

const flush = () => act(async () => { await new Promise((r) => setTimeout(r, 0)); });

describe('useTaskData renameProject', () => {
  test('renames the board and re-points its tasks; PUT carries newName', async () => {
    const api = makeApi({ put: async () => ({ success: true, projects: ['New', 'Other'] }) });
    const { result } = await renderHook(() => useTaskData(api, true, null));
    await flush();
    let ok;
    await act(async () => { ok = await result.current.renameProject('Old', 'New'); });
    expect(ok).toBe(true);
    expect(api.put).toHaveBeenCalledWith('/projects/Old', { newName: 'New' });
    expect(result.current.projects).toEqual(['New', 'Other']);
    expect(result.current.tasks.find((t) => t.id === 't1').project).toBe('New');
    expect(result.current.tasks.find((t) => t.id === 't2').project).toBe('Other');
  });

  test('server failure reverts both lists and alerts', async () => {
    const api = makeApi({ put: async () => { throw new Error('API Error 500: nope'); } });
    const { result } = await renderHook(() => useTaskData(api, true, null));
    await flush();
    let ok;
    await act(async () => { ok = await result.current.renameProject('Old', 'New'); });
    expect(ok).toBe(false);
    expect(result.current.projects).toEqual(['Old', 'Other']);
    expect(result.current.tasks.find((t) => t.id === 't1').project).toBe('Old');
    expect(Alert.alert).toHaveBeenCalled();
  });

  test('refuses a case-insensitive clash with another board without calling the server', async () => {
    const api = makeApi({ put: async () => ({ success: true }) });
    const { result } = await renderHook(() => useTaskData(api, true, null));
    await flush();
    let ok;
    await act(async () => { ok = await result.current.renameProject('Old', 'other'); });
    expect(ok).toBe(false);
    expect(api.put).not.toHaveBeenCalled();
  });
});
