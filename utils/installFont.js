// Side-effect module: makes Figtree the app-wide typeface. Imported FIRST in
// App.js (right after react-native-gesture-handler) so it runs before any
// library captures the original Text (Reanimated builds Animated.Text at
// import time). See utils/fonts.js.
import { installGlobalFont } from './fonts';

installGlobalFont();
