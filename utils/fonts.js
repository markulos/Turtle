/**
 * App typeface.
 *
 * Artifakt Element (Production Type) is a commercial licence, so it can't be
 * bundled. Figtree is the closest openly-licensed match: the same low-contrast
 * humanist-geometric skeleton, open apertures and slightly squared bowls, at a
 * comparable optical size — it reads as the same kind of friendly, neutral UI
 * sans rather than a generic grotesque.
 *
 * React Native does NOT synthesise weights for custom fonts: `fontWeight` is
 * ignored once `fontFamily` names a bundled face, so every weight is its own
 * family name. Always pick from FONTS rather than pairing a family with a
 * numeric weight.
 *
 * APP-WIDE (2026-09-10): `installGlobalFont()` makes Figtree the face of every
 * <Text> and <TextInput> in the app without touching a single style. RN 0.81's
 * Text / TextInput are plain function components (no forwardRef `render` to
 * wrap, no defaultProps under React 19), so the install swaps the modules'
 * `default` export for a wrapper that reads the flattened `fontWeight` and
 * adds the matching Figtree family. `react-native`'s index exposes both
 * through lazy getters that re-read the module export on every access, so
 * every `import { Text } from 'react-native'` in the app sees the wrapper —
 * PROVIDED the install runs before any module captures the original (it is
 * imported first thing in App.js, before Reanimated builds its Animated.Text).
 * Anything that already names a family (the icon glyph font, the monospace
 * consoles) is left alone.
 *
 * Loading is centralised in App.js behind the existing startup gate, so no
 * screen ever paints text in a face that isn't ready.
 */
// Per-weight subpaths, NOT the package root. The root index re-exports all
// fourteen Figtree variants, so importing from it bundles every one of them
// (~570 kB of TTFs) even though six are used. Verified with `expo export`.
import React from 'react';
import { StyleSheet } from 'react-native';
import { useFonts } from 'expo-font';
import { Figtree_300Light } from '@expo-google-fonts/figtree/300Light';
import { Figtree_400Regular } from '@expo-google-fonts/figtree/400Regular';
import { Figtree_500Medium } from '@expo-google-fonts/figtree/500Medium';
import { Figtree_600SemiBold } from '@expo-google-fonts/figtree/600SemiBold';
import { Figtree_700Bold } from '@expo-google-fonts/figtree/700Bold';
import { Figtree_800ExtraBold } from '@expo-google-fonts/figtree/800ExtraBold';

export const FONTS = {
  light: 'Figtree_300Light',
  regular: 'Figtree_400Regular',
  medium: 'Figtree_500Medium',
  semibold: 'Figtree_600SemiBold',
  bold: 'Figtree_700Bold',
  extrabold: 'Figtree_800ExtraBold',
};

/** The Figtree family for a React Native fontWeight value. */
export function familyForWeight(weight) {
  const w = weight == null ? '400' : String(weight);
  switch (w) {
    case '100': case '200': case '300': case 'ultralight': case 'thin': case 'light': return FONTS.light;
    case '500': case 'medium': return FONTS.medium;
    case '600': case 'semibold': return FONTS.semibold;
    case '700': case 'bold': return FONTS.bold;
    case '800': case '900': case 'heavy': case 'black': return FONTS.extrabold;
    default: return FONTS.regular;
  }
}

/** Loads the app typeface. Returns true once every weight is registered. */
export const useAppFonts = () => {
  const [loaded] = useFonts({
    Figtree_300Light,
    Figtree_400Regular,
    Figtree_500Medium,
    Figtree_600SemiBold,
    Figtree_700Bold,
    Figtree_800ExtraBold,
  });
  return loaded;
};

/** The style addition for a given style prop: the family for its weight, or nothing. */
export function fontStyleFor(style) {
  const flat = StyleSheet.flatten(style) || {};
  // Respect an explicit family (icon glyph fonts, monospace consoles).
  if (flat.fontFamily && !String(flat.fontFamily).startsWith('Figtree')) return null;
  // The weight is carried by the family name; leave fontWeight at normal so
  // iOS does not synthesise a faux bold on top of the real bold face.
  return { fontFamily: familyForWeight(flat.fontWeight), fontWeight: 'normal' };
}

function makeWrapped(Orig, name) {
  function Wrapped(props) {
    const add = fontStyleFor(props.style);
    if (!add) return React.createElement(Orig, props);
    return React.createElement(Orig, { ...props, style: [props.style, add] });
  }
  // Statics (TextInput.State, …) travel with the wrapper.
  Object.assign(Wrapped, Orig);
  Wrapped.displayName = name;
  Wrapped.__turtleFont = true;
  Wrapped.__original = Orig;
  return Wrapped;
}

/**
 * Swap one export on react-native's index object. That object is a plain
 * literal of lazy GETTERS (`get Text() { return require(...).default }`), and
 * accessor properties of an object literal are configurable — so the getter
 * can be replaced with one that returns the wrapper. (The Text / TextInput
 * MODULES themselves are not an option: in the release bundle Metro emits
 * their `default` as a non-configurable getter, and assigning to it throws
 * under strict mode — that was a launch crash, which expo-updates answered
 * by falling back to the factory bundle.) Returns whether the swap took.
 */
function swapIndexExport(RN, name) {
  const desc = Object.getOwnPropertyDescriptor(RN, name);
  if (!desc || !desc.configurable) return false;
  const Orig = RN[name];
  if (typeof Orig !== 'function' || Orig.__turtleFont) return !!(Orig && Orig.__turtleFont);
  const Wrapped = makeWrapped(Orig, name);
  Object.defineProperty(RN, name, { configurable: true, enumerable: true, get: () => Wrapped });
  return RN[name] === Wrapped;
}

/**
 * Make Figtree the face of every Text / TextInput. Call once, first thing.
 * MUST NOT throw: it runs at module load, before anything is on screen, and
 * an exception here is a launch crash — expo-updates would then fall back to
 * the factory bundle (ON_ERROR_RECOVERY) and the phone would silently lose
 * every OTA since. A failed install just leaves the system face in place.
 */
export function installGlobalFont() {
  const result = { Text: false, TextInput: false };
  try {
    // eslint-disable-next-line global-require
    const RN = require('react-native');
    result.Text = swapIndexExport(RN, 'Text');
    result.TextInput = swapIndexExport(RN, 'TextInput');
  } catch (e) {
    console.warn('[fonts] global font install skipped:', e && e.message);
  }
  return result;
}
