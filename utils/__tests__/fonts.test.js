// The app-wide typeface: every Text / TextInput gets the Figtree family that
// matches its fontWeight; explicit families (icons, monospace) are respected.
import React from 'react';
import { StyleSheet } from 'react-native';
import TestRenderer from 'react-test-renderer';
import { familyForWeight, fontStyleFor, installGlobalFont } from '../fonts';

jest.mock('expo-font', () => ({ useFonts: () => [true] }));
jest.mock('@expo-google-fonts/figtree/300Light', () => ({ Figtree_300Light: 1 }));
jest.mock('@expo-google-fonts/figtree/400Regular', () => ({ Figtree_400Regular: 1 }));
jest.mock('@expo-google-fonts/figtree/500Medium', () => ({ Figtree_500Medium: 1 }));
jest.mock('@expo-google-fonts/figtree/600SemiBold', () => ({ Figtree_600SemiBold: 1 }));
jest.mock('@expo-google-fonts/figtree/700Bold', () => ({ Figtree_700Bold: 1 }));
jest.mock('@expo-google-fonts/figtree/800ExtraBold', () => ({ Figtree_800ExtraBold: 1 }));

describe('familyForWeight', () => {
  test('maps numeric and named weights onto the loaded faces', () => {
    expect(familyForWeight(undefined)).toBe('Figtree_400Regular');
    expect(familyForWeight('300')).toBe('Figtree_300Light');
    expect(familyForWeight('500')).toBe('Figtree_500Medium');
    expect(familyForWeight('600')).toBe('Figtree_600SemiBold');
    expect(familyForWeight('bold')).toBe('Figtree_700Bold');
    expect(familyForWeight('900')).toBe('Figtree_800ExtraBold');
  });
});

describe('fontStyleFor', () => {
  test('adds the family for the weight and neutralises fontWeight', () => {
    expect(fontStyleFor([{ fontSize: 12 }, { fontWeight: '700' }])).toEqual({ fontFamily: 'Figtree_700Bold', fontWeight: 'normal' });
  });
  test('leaves an explicit non-Figtree family alone', () => {
    expect(fontStyleFor({ fontFamily: 'Menlo' })).toBeNull();
    expect(fontStyleFor({ fontFamily: 'MaterialCommunityIcons' })).toBeNull();
  });
});

describe('installGlobalFont', () => {
  test('every Text imported from react-native renders with the Figtree family', () => {
    installGlobalFont();
    // eslint-disable-next-line global-require
    const { Text, TextInput } = require('react-native');
    expect(Text.__turtleFont).toBe(true);
    expect(TextInput.__turtleFont).toBe(true);
    expect(typeof TextInput.State).toBe('object');
    let tree;
    TestRenderer.act(() => { tree = TestRenderer.create(<Text style={{ fontWeight: '600' }}>hi</Text>); });
    const bold = tree.root.findByType(Text.__original);
    expect(StyleSheet.flatten(bold.props.style)).toMatchObject({ fontFamily: 'Figtree_600SemiBold', fontWeight: 'normal' });
    TestRenderer.act(() => { tree = TestRenderer.create(<Text style={{ fontFamily: 'Menlo' }}>code</Text>); });
    const mono = tree.root.findByType(Text.__original);
    expect(StyleSheet.flatten(mono.props.style).fontFamily).toBe('Menlo');
  });
});
