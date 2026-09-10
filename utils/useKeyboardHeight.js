/**
 * useKeyboardHeight — the live keyboard height as plain React state.
 *
 * The house keyboard rule (docs/STYLE-RULES.md, "keyboard cover"): a surface
 * reacts to the keyboard by PADDING its scrollable body so content can scroll
 * clear, and by lifting only what the keyboard actually covers. It never wraps
 * itself in a KeyboardAvoidingView (a layout prop animated from JS, a beat
 * behind the keyboard) and never fires a global LayoutAnimation on the event
 * (which captures every unrelated layout change in flight — the "overlay lags
 * behind" symptom).
 *
 * iOS reports `keyboardWillShow` with the final frame before the keyboard
 * moves, so padding set here lands before the first keyboard frame. Android
 * only has the Did events.
 */
import { useEffect, useState } from 'react';
import { Keyboard, Platform } from 'react-native';

export default function useKeyboardHeight() {
  const [height, setHeight] = useState(0);
  useEffect(() => {
    const ios = Platform.OS === 'ios';
    const show = Keyboard.addListener(ios ? 'keyboardWillShow' : 'keyboardDidShow', (e) => {
      setHeight(e?.endCoordinates?.height || 0);
    });
    const hide = Keyboard.addListener(ios ? 'keyboardWillHide' : 'keyboardDidHide', () => setHeight(0));
    return () => { show.remove(); hide.remove(); };
  }, []);
  return height;
}
