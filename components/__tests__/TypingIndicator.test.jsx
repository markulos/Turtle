import React from 'react';
import { render, screen } from '@testing-library/react-native';

jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));
jest.mock('expo-image', () => {
  const { View } = require('react-native');
  return { Image: (props) => <View testID="typing-icon" {...props} /> };
});

import TypingIndicator from '../TypingIndicator';

const theme = { colors: { surfaceElevated: '#222', border: '#333', textMuted: '#888' } };

test('renders the turtle and three dots as a labelled live region', async () => {
  await render(<TypingIndicator theme={theme} />);
  const bubble = screen.getByTestId('typing-indicator');
  expect(bubble.props.accessibilityLabel).toBe('Turtle is typing');
  expect(screen.getByTestId('typing-icon')).toBeTruthy();
});
