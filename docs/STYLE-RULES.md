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

- TASK CARDS are INSET panels (`screens/TasksScreen/utils/cardPalette.js`): a surface one step BELOW the page
  (dark: #0E0E10 on black; light: #F3F3F5 on white), radius 16, a hairline rim a touch lighter than the panel with
  the TOP edge lit a little more (`edge` / `edgeTop`) — the light catching a recess. No drop shadow. Inside:
  bold value, muted caption, small icon TILE (`tile`) — the Teenage-Engineering / Scandinavian read of the
  reference tile. Everything drawn inside the card (badges, sub-lines, progress tracks, inline inputs) takes
  its colour from that palette, never from the theme's page tokens. Completion rings are full-contrast
  against whatever they sit on (black on light, white on dark; the card's text colour inside a card), 2 pt,
  never grey.

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
- Every card that pops up from below whose CONTENT CAN EXCEED its collapsed height (tags, details, filters
  with long lists) has TWO DETENTS through `utils/useSheetDetents`: it opens at
  COLLAPSED (60 % of the screen), a drag up takes it to EXPANDED (the full screen: corners square off, content clears the status bar), a drag down past collapsed
  closes it; a flick decides faster than distance. Grab region = the whole card; the scrim fades with a
  closing pull; an inner list scrolls only once the sheet is expanded and hands back a downward drag at its
  top. (`utils/useSheetDismiss` is the legacy single-detent hook — migrate, do not add new users.)
  A COMPACT menu that sizes to its content (album / track actions, a time wheel, a short filter list) has
  nothing to expand into: it stays single-detent (pull down to close) — `useSheetDismiss` is fine there.
- The HEADER (handle + title row) is a grab bar in its own right: a drag there moves the sheet from ANY
  scroll position (down closes, up expands), and a TAP on it flips between the two detents. Use
  `headerPanHandlers` + `toggle` from useSheetDetents; `PhotoViewer/ViewerSheet` has it built in, so
  reuse it for any dark sheet. The Done button keeps its own press (claim on move, never on start).
- Dark sheets are FROSTED: rgba(10,10,12,.55) over a dark BlurView so what is underneath shows through,
  softened; white text, pills invert to white / black text.
- The TAGS sheet, whenever it is open, sits above EVERY other overlay on the screen (selection bar,
  filter sheet, headers, chrome): mount it LAST in the screen root with its own zIndex (ViewerSheet
  carries 1000), never inside a page or bar that another overlay can outrank.
- Keyboard-aware sheets: no KeyboardAvoidingView. The sheet listens to the keyboard and — ONLY IF the
  keyboard would COVER the field it opened for (measure the field, compare with the keyboard's top) —
  jumps to EXPANDED, lifts by the keyboard height on a native-driver transform and caps its height below
  the status bar. If the field is already clear of the keyboard, the card does NOT lift and its height is
  not capped — it only rises to its expanded detent (so the content under the field gets the room above
  the keyboard) and the body gains bottom padding so what sits under the keyboard stays reachable. Drops back when
  the keyboard goes. Search / add fields go at the TOP of a sheet (`PhotoViewer/ViewerSheet` does all this).
- Keyboard + a scrolling list (the chat): the list keeps scrolling with the keyboard up
  (`keyboardDismissMode="none"`); the keyboard closes on a SWIFT pull DOWN (≥ 48 pt at ≥ 1.2 pt/ms) or a
  tap on the background — never on an ordinary scroll, never proportionally ("interactive").
- Keyboard + a PAGE or a plain list (forms, settings, search results, profile): the same rule, no
  KeyboardAvoidingView anywhere. The scroll body pads its bottom by the keyboard height
  (`utils/useKeyboardHeight`; an iOS ScrollView may also set `automaticallyAdjustKeyboardInsets`, which scrolls
  the focused field into view ONLY if the keyboard covers it). Anything pinned at the bottom (a Save bar, a
  composer) lifts on a native-driver transform matched to the keyboard's own `e.duration` (RN Animated
  in a Modal, `useAnimatedKeyboard` in-tree). Never fire a global `LayoutAnimation.configureNext` on a
  keyboard event — it captures every unrelated layout change in flight and drags sheets and chips behind the
  keyboard. `keyboardDismissMode` is `"on-drag"` on both platforms (or `"none"` + swift pull for chat
  lists); never `"interactive"`.
- Assistant text renders MARKDOWN (`components/MarkdownText` over `utils/markdownLite`): headings, lists,
  code, bold / italic / strike, links, quotes. Never show raw markers in a bubble.
- Every sheet/page `ScrollView` sets `scrollIndicatorInsets={{ right: 1 }}` and `indicatorStyle`,
  or iOS parks the indicator mid-page.

## 4b. Screen headers

- A screen header is ONE row of keys: the view toggle, the status keys (To do · Done · All), the filter
  key, the Boards key — no dropdowns, no stats chips, no second row of pills, no header + (the day panel
  and the list's inline field add tasks). The Boards key is a hairline pill that reads the selected board
  (dot + name, or "Boards") and lights (text colour as fill) while a board is selected or the rail is open.
  What the list is scoped to lives in an inset-card RAIL that the key toggles under the row
  (`TasksScreen/components/BoardRail`), HIDDEN by default and closing on a pick: "All" first, one card
  per board carrying its own progress (done / total, a hairline track, the overdue count), a dashed + key
  last. The selected card inverts like a lit key; tap scopes, long-press opens the board manager
  (`BoardManagerSheet`) on that board. Any horizontal rail ScrollView sets `flexGrow: 0` — RN's default
  flexGrow 1 makes it swallow the column.
- Header type is two sizes only: small caps 10.5 pt / letter-spacing 0.9 for labels, bold tabular 18 pt
  for the figure. One accent per card (the board dot). Nothing else is coloured.

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
4. Sheets: in-tree, two detents (opens at 60 %, drag up to full screen, drag down closes), top search, keyboard lift, scroll-indicator inset.
   Keyboard anywhere: no KeyboardAvoidingView, no LayoutAnimation on the event, body pads / pinned bar lifts on a native transform.
5. Motion on the UI thread only; swift curve for shared-element moves.
6. Ran `turtle-mobile-verify` (parse, jest, undef-audit, bundle) and listed the on-device checks.
