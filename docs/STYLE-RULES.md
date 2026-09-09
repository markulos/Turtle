# Turtle mobile — styling rules

These are the rules every new or changed screen, sheet, bar and button follows. They exist because the
same handful of mistakes kept coming back: dark-on-dark chips, labels running past the edge of a card,
tap targets too small to hit, sheets that fight the keyboard. Enforced by the `turtle-style-rules`
repo skill (loaded before any UI work) and by review.

## 1. Contrast: a surface is either white-on-black or black-on-white

- Every surface declares which it is. On a **white-on-black** surface (the photo viewer, its chrome
  and sheets, anything over media) text is `#fff` at 100 / 70 / 45 % opacity for primary / secondary /
  muted, and interactive pills INVERT: white fill, black text. On a **black-on-white / themed** surface
  use the theme tokens (`textPrimary`, `textSecondary`, `textMuted`, `surface`, `border`, `primary`);
  pills are `primary` fill with `background` text.
- Never a "slightly different dark on dark" element. A chip, badge or button must contrast with its
  card: minimum 4.5:1 for body text, 3:1 for ≥18pt text and for icon-only controls.
- Text over a photo or video always sits on a scrim (gradient band, blurred card, or `rgba(0,0,0,.55)`)
  and carries a text shadow. Never bare white on an unknown picture.
- The mobile theme has no `accentPrimary`; use `primary`, `accentInfo`, `accentSuccess`. An undefined
  token renders black on black.
- Frosted surfaces over media: `expo-blur` `BlurView` (`tint="dark"`, `intensity` 45–60,
  `experimentalBlurMethod="dimezisBlurView"` for Android) under an `rgba(10,10,12,.5–.6)` tint so
  white text stays legible whatever is behind it.

## 2. Text never overflows its container

- A `Text` inside a row gets `flexShrink: 1`. Single-line labels also get `numberOfLines={1}`;
  values that may be long get `numberOfLines={2}`.
- A row of buttons gets `flexWrap: 'wrap'`; each button `flexShrink: 1, maxWidth: '100%'`. A
  fixed-height container never holds wrapping text — if the text can wrap, the height comes from it.
- Button labels are short: ≤ 22 characters, verb first ("Promote to production", not
  "Promote preview → production"). Long explanations go in the caption under the button.
- Check every new layout at 375 pt width (iPhone SE / mini) with the largest label and the longest
  real value (a 40-character album name, a 1:02:05 duration, a 2,150,000-byte size).
- Chips: `maxWidth: '100%'`, `flexShrink: 1`, `numberOfLines={1}`.

## 3. Touch targets and feedback

- Every tappable is ≥ 44 × 44 pt, using `hitSlop` when the glyph is smaller. Pressed state:
  opacity 0.6 (`Pressable` style function). Action buttons fire the press-in haptic from
  `utils/haptics`.
- Icon-only buttons carry `accessibilityRole="button"` and an `accessibilityLabel` that names the
  action AND its state ("Remove from favourites", "Pause").
- Overlays that must not eat swipes are `pointerEvents="box-none"` while shown and `"none"` while
  hidden; only their buttons are targets.

## 4. Sheets and overlays

- A sheet over an open Modal is an in-tree overlay, never a sibling `Modal` (iOS drops it silently).
  Sheets render LAST in their tree and carry `zIndex` so they draw over chrome and cards.
- Every card that pops up from below has TWO DETENTS through `utils/useSheetDetents`: it opens at
  COLLAPSED (60 % of the screen), a drag up takes it to EXPANDED (92 %), a drag down past collapsed
  closes it; a flick decides faster than distance. Grab region = the whole card; the scrim fades with a
  closing pull; an inner list scrolls only once the sheet is expanded and hands back a downward drag at its
  top. (`utils/useSheetDismiss` is the legacy single-detent hook — migrate, do not add new users.)
- Keyboard-aware sheets: no KeyboardAvoidingView. The sheet listens to the keyboard, jumps to EXPANDED,
  lifts by the keyboard height on a native-driver transform and caps its height below the status bar; it
  drops back when the keyboard goes. Search / add fields go at the TOP of a sheet.
- Every sheet/page `ScrollView` sets `scrollIndicatorInsets={{ right: 1 }}` and `indicatorStyle`,
  or iOS parks the indicator mid-page.

## 5. Inputs

- An inline `TextInput` in an icon row: explicit `height`, `paddingVertical: 0`,
  `textAlignVertical: 'center'` — never vertical padding (glyphs ride high).
- Placeholders describe the action ("Search or add a tag…"), in `textMuted`.

## 6. Motion

- Shared-element moves (a photo growing out of / flying back into its tile) use the swift curve
  `Easing.bezier(0.2, 0.9, 0.25, 1)`, 300–340 ms: fast out of the gate, soft landing. On the way out
  the picture does NOT fade in flight: it stays opaque and switches off the instant it is on its target.
- Timelines and progress: drive a shared value and glide it between reports on the UI thread; while
  the finger owns a control it IS the value (no React state per frame); throttle the work you send
  (seeks) and ignore stale reports until the target is confirmed.
- Gesture-thrown surfaces settle with `R_TIMING.settle` (`utils/motionReanimated`). Reduced motion is
  Reanimated's job; never gate it by hand.
- Never animate a layout prop (`height`, `width`, `padding`) on the JS thread; use a transform, or
  a Reanimated shared value if the layout genuinely has to move.
- Sheets enter in 240 ms ease-out-cubic and leave in 200 ms ease-in-quad.

## 7. State and data

- Every mutation is optimistic: update local state now, persist in the background, revert on
  failure, always with functional updaters.
- Loading never blanks a screen: the resting tile / row IS the placeholder; content fades in over it.

## Checklist before shipping any UI change

1. Which surface is it — white-on-black or black-on-white — and does every element on it contrast?
2. Longest label, longest value, 375 pt width: nothing clipped, nothing past the edge.
3. Every tappable ≥ 44 pt with a label; pressed state; haptic on action buttons.
4. Sheets: in-tree, two detents (opens at 60 %, drag up to 92 %, drag down closes), top search, keyboard lift, scroll-indicator inset.
5. Motion on the UI thread only; swift curve for shared-element moves.
6. Ran `turtle-mobile-verify` (parse, jest, undef-audit, bundle) and listed the on-device checks.
