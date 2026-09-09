import React from 'react';
import { act, render, screen, userEvent } from '@testing-library/react-native';

jest.mock('react-native-reanimated', () => {
  const mock = require('react-native-reanimated/mock');
  const pass = (f) => f || ((t) => t);
  return {
    ...mock,
    Easing: {
      out: pass, in: pass, inOut: pass,
      cubic: (t) => t, quad: (t) => t, linear: (t) => t, ease: (t) => t,
      bezier: () => (t) => t,
    },
    useAnimatedReaction: mock.useAnimatedReaction || (() => {}),
    cancelAnimation: mock.cancelAnimation || (() => {}),
    withDecay: mock.withDecay || (() => 0),
    runOnJS: mock.runOnJS || ((fn) => fn),
  };
});

jest.mock('react-native-gesture-handler', () => {
  const { View } = require('react-native');
  const chain = () => new Proxy(function chainFn() {}, {
    get: (_target, key) => (key === 'then' ? undefined : () => chain()),
    apply: () => chain(),
  });
  return {
    Gesture: {
      Pan: () => chain(), Pinch: () => chain(), Tap: () => chain(),
      Race: () => chain(), Simultaneous: () => chain(), Exclusive: () => chain(),
    },
    GestureDetector: ({ children }) => children,
    GestureHandlerRootView: View,
  };
});

jest.mock('expo-image', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    Image: (props) => React.createElement(View, {
      testID: `img:${props.source?.uri}`,
      accessibilityLabel: props.accessibilityLabel,
    }),
  };
});
jest.mock('expo-video', () => ({
  useVideoPlayer: () => ({ play: jest.fn(), pause: jest.fn(), playing: false, muted: true }),
  VideoView: () => null,
}));
jest.mock('expo-linear-gradient', () => ({ LinearGradient: () => null }));
jest.mock('react-native-vector-icons/MaterialCommunityIcons', () => 'Icon');
jest.mock('../../../../../context/MusicPlayerContext', () => ({
  useMusicPlayer: () => ({ pause: jest.fn() }),
}));

import PhotoViewer from '../PhotoViewer';
import { formatClock } from '../ViewerChrome';
import { matchTags, mergeTags } from '../TagsSheet';

describe('viewer helpers', () => {
  test('formatClock', () => {
    expect(formatClock(0)).toBe('0:00');
    expect(formatClock(7.9)).toBe('0:07');
    expect(formatClock(63)).toBe('1:03');
    expect(formatClock(3725)).toBe('1:02:05');
    expect(formatClock(NaN)).toBe('0:00');
  });
  test('matchTags ranks earlier matches first and ignores case', () => {
    expect(matchTags(['Beach', 'Trip', 'Road trip', 'Zebra'], 'tri')).toEqual(['Trip', 'Road trip']);
    expect(matchTags(['Beach', 'Trip'], '')).toEqual(['Beach', 'Trip']);
    expect(matchTags(['Beach'], 'xyz')).toEqual([]);
  });
  test('mergeTags trims, dedupes, keeps order', () => {
    expect(mergeTags(['A'], [' B ', '', 'A', 'C'])).toEqual(['A', 'B', 'C']);
  });
});

const makeStore = () => {
  let value = null;
  const listeners = new Set();
  return {
    get: () => value,
    set: (next) => { value = next; listeners.forEach((l) => l(next)); },
    subscribe: (l) => { listeners.add(l); return () => listeners.delete(l); },
  };
};
const makeHdStore = () => {
  const ready = new Set();
  const listeners = new Set();
  return {
    get: (id) => ready.has(id),
    subscribe: (l) => { listeners.add(l); return () => listeners.delete(l); },
    mark: (id) => { ready.add(id); listeners.forEach((l) => l(id)); },
  };
};

const items = [
  { id: 'm0', type: 'image', compressedUrl: '/c/m0.jpg', width: 400, height: 300, tags: '[]', originalDate: '2026-09-08T09:00:00' },
  {
    id: 'm1', type: 'image', compressedUrl: '/c/m1.jpg', width: 4032, height: 3024, tags: '["Favourites"]',
    originalDate: '2026-09-09T14:03:00', filename: 'IMG_0001.HEIC', size: 2150000,
  },
  { id: 'm2', type: 'video', rawUrl: '/r/m2.mp4', width: 1920, height: 1080, tags: '[]' },
];

const theme = {
  colors: {
    primary: '#3b82f6', background: '#000', surface: '#111', surfaceElevated: '#222',
    textPrimary: '#fff', textSecondary: '#ccc', textMuted: '#888', border: '#333',
  },
};

async function renderViewer(overrides = {}) {
  const props = {
    visible: true,
    items,
    initialIndex: 1,
    origin: null,
    activeStore: makeStore(),
    hdStore: makeHdStore(),
    dragStore: makeStore(),
    getFullUrl: (p) => `https://pond${p}`,
    tagSuggestions: ['Trip', 'Favourites', 'All'],
    onIndexSettled: jest.fn(),
    onCommitTags: jest.fn(),
    onToggleFavourite: jest.fn(),
    onShare: jest.fn(),
    onEditImage: jest.fn(),
    onClosed: jest.fn(),
    theme,
    insets: { top: 47, bottom: 34 },
    bottomInset: 90,
    ...overrides,
  };
  const view = await render(<PhotoViewer {...props} />);
  return { view, props, user: userEvent.setup() };
}

describe('PhotoViewer', () => {
  test('renders the active photo on its fast uri, both neighbours, and the chrome', async () => {
    const { props } = await renderViewer();
    expect(screen.getByTestId('img:https://pond/c/m1.jpg')).toBeTruthy();
    expect(screen.getByTestId('img:https://pond/c/m0.jpg')).toBeTruthy();
    expect(screen.getByTestId('viewer-page-m2')).toBeTruthy();
    expect(screen.getByText(/Sep 9, 2026/)).toBeTruthy();
    expect(screen.getByText('4032 × 3024')).toBeTruthy();
    expect(screen.getByTestId('viewer-favourite').props.accessibilityLabel).toBe('Remove from favourites');
    expect(props.activeStore.get()).toBe('m1');
  });

  test('the HD store flips the page to the display variant', async () => {
    const { props } = await renderViewer();
    expect(screen.queryByTestId('img:https://pond/api/media/display/m1')).toBeNull();
    await act(async () => { props.hdStore.mark('m1'); });
    expect(screen.getByTestId('img:https://pond/api/media/display/m1')).toBeTruthy();
  });

  test('the tags button opens the sheet, and every add commits immediately', async () => {
    const { props, user } = await renderViewer();
    expect(screen.queryByTestId('tags-sheet')).toBeNull();
    await user.press(screen.getByTestId('viewer-tags'));
    expect(screen.getByTestId('tags-sheet')).toBeTruthy();
    // Favourites is on the photo, so only Trip is offered (All is a system album).
    expect(screen.queryByTestId('tag-suggest-Favourites')).toBeNull();
    expect(screen.queryByTestId('tag-suggest-All')).toBeNull();
    await user.press(screen.getByTestId('tag-suggest-Trip'));
    expect(props.onCommitTags).toHaveBeenCalledWith('m1', ['Favourites', 'Trip']);
    await user.type(screen.getByTestId('tags-input'), 'Beach', { submitEditing: true });
    expect(props.onCommitTags).toHaveBeenLastCalledWith('m1', ['Favourites', 'Beach']);
    // Favourites can't be removed from here.
    await user.press(screen.getByTestId('tag-chip-Favourites'));
    expect(props.onCommitTags).toHaveBeenCalledTimes(2);
  });

  test('favourite, share and edit hand the active item to the gallery', async () => {
    const { props, user } = await renderViewer();
    await user.press(screen.getByTestId('viewer-favourite'));
    expect(props.onToggleFavourite).toHaveBeenCalledWith(items[1]);
    await user.press(screen.getByTestId('viewer-share'));
    expect(props.onShare).toHaveBeenCalledWith(items[1]);
    await user.press(screen.getByTestId('viewer-edit'));
    expect(props.onEditImage).toHaveBeenCalledWith(items[1]);
  });

  test('a video page shows play and mute instead of edit', async () => {
    await renderViewer({ initialIndex: 2 });
    expect(screen.getByTestId('viewer-play')).toBeTruthy();
    expect(screen.getByTestId('viewer-mute')).toBeTruthy();
    expect(screen.queryByTestId('viewer-edit')).toBeNull();
  });

  test('renders nothing while hidden', async () => {
    await renderViewer({ visible: false });
    expect(screen.queryByTestId('photo-viewer')).toBeNull();
  });

  test('the open item vanishing from the list closes the viewer', async () => {
    const { view, props } = await renderViewer();
    await view.rerender(<PhotoViewer {...props} items={[items[0], items[2]]} />);
    expect(props.onClosed).toHaveBeenCalled();
  });
});
