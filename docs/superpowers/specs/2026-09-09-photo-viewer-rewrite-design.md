# Photo viewer rewrite — design

Date: 2026-09-09. Repo: `mobile-app` (Turtle-mobile). Branch: `feat/photo-viewer-rewrite`.
Approved by the user in chat on 2026-09-09 with three amendments (swipe-up metadata stays;
tags become an Instagram-comments-style page; the overlay logic stays as flat as possible).

## 1. Goal

Replace the vault's full-screen photo viewer with one whose photo-to-photo swipe behaves exactly
like iOS Photos: the page follows the finger 1:1, one page per swipe, snappy settle, interruptible,
rubber-banded at the ends, and never eaten by another gesture. Keep every concept the current viewer
has (tags, favourite, timestamp + resolution, share, edit, swipe-down dismiss, swipe-up details,
pinch/double-tap zoom, video pages) but rebuild them on one gesture system with the least possible
overlay logic in the touch path.

### Non-goals

- Shared-element open from the exact grid cell rect (parity plan Phase C). The pop still originates
  from the tap point.
- Long-press context menus, Live Photos, landscape layouts.
- The links/exposure badge and selection sharing: both exist only in uncommitted WIP, not on
  `master`, and are out of scope here. They can be re-added on top of the new chrome later.
- Changing the grid, the scrubber, the HD manager, or the data layer.

## 2. Diagnosis of the current viewer

The current viewer (`MediaGallery.jsx` `renderFullScreenViewer`, `viewerMedia.jsx`,
`ZoomableView.jsx`) runs three gesture systems on the same finger:

1. the pager's native `UIScrollView` pan (an `Animated.FlatList` with `snapToInterval`);
2. Gesture Handler recognizers inside every page cell (tap, double-tap, pinch, and a pan that is
   enabled while zoomed);
3. a JS `PanResponder` on the container for pull-to-dismiss, the swipe-up drawer and the left-edge
   back gesture.

On iOS a recognizer sitting in the `began` state may cancel a scroll view's pan; a tap recognizer
sits there for up to 260 ms on every touch, so a swipe that starts on the photo is unreliable while
a swipe that starts on the bands above and below it always pages. The PanResponder claims any
drag whose vertical travel exceeds 1.2× the horizontal and cancels the native scroll mid-flight.
Paging is also gated by React state (`scrollEnabled={zoomScale <= 1.05}`) and page adoption
re-renders a 7,200-line component; a touch arriving during that render is lost. Every earlier fix
tuned the arbitration; none removed the competition. The uncommitted WIP found in the working tree
(`capture/desktop-2026-09-09-viewer-wip`) is one more arbitration patch.

## 3. Architecture

Everything new lives in `screens/TurtleScreen/components/PhotoViewer/`. `MediaGallery.jsx` keeps
the data, the stores, the HD manager and the actions, and renders `<PhotoViewer>`.

| File | Responsibility |
| --- | --- |
| `PhotoViewer.jsx` | The shell. `Modal` (transparent, no animation) → `GestureHandlerRootView` → backdrop → `ViewerStage` → `ViewerChrome` → sheets → `children`. Owns React state that changes only at rest: `activeIndex`, `chromeVisible`, `zoomed`, `tagsOpen`, `detailsOpen`. Owns the open/close pop. |
| `ViewerStage.jsx` | The gesture engine and page layout. One `GestureDetector` at the stage root. Shared values: `pagerX`, `activeIndex`, `scale`, `tx`, `ty`, `dragX`, `dragY`, `openProgress`, `settling`. Mounts the active page ±1. No React state on the gesture path. |
| `ViewerPage.jsx` | One page. A dumb cell: one `expo-image` whose URI is `hdReady ? display : fast` from the existing HD store, or an `expo-video` view for a video. Computes its own transform from the stage's shared values in `useAnimatedStyle`. |
| `ViewerChrome.jsx` | Top bar (back, edit, tags) and bottom bar (date/time, resolution, share, favourite; play/pause and mute for a video). One animated opacity. `pointerEvents` is `box-none` when shown, `none` when hidden. Buttons are plain `Pressable`s. |
| `ViewerSheet.jsx` | The shared bottom-sheet shell for the two sheets below: scrim, card, handle, entrance animation, pull-down-to-close via `utils/useSheetDismiss` (app-wide rule). Mounted only while open. |
| `TagsSheet.jsx` | Instagram-comments-style tags page: current tags as removable chips, suggestion chips from the album list, a composer input at the bottom that rises with the keyboard. Every add/remove commits immediately through `onCommitTags`. |
| `DetailsSheet.jsx` | Swipe-up metadata: date and time, filename, dimensions and size, type, tags (read-only) with an "Edit tags" button that swaps to the tags sheet. |
| `utils/viewerGestureMath.js` | Pure, worklet-safe functions: axis lock, page target, end rubber band, dismiss commit, dismiss interpolations, zoom-edge spill, settle duration. Jest-tested. |
| `utils/zoomMath.js` | Unchanged. Reused for pinch focal math, pan bounds, rubber-banding, fill/native max scale. |

Deleted: `ZoomableView.jsx`, `viewerMedia.jsx` (their behaviour moves into `ViewerStage` and
`ViewerPage`). Removed from `MediaGallery.jsx`: the `Animated.FlatList` pager, `swipeResponder`,
the drag/pop `Animated.Value`s, the chrome JSX, the inline tag editor overlay and its state, the
metadata drawer, the pager-quiet/adoption machinery, the progress bar values, `scrollX`,
`zoomScale` state. Roughly 1,000 lines.

### 3.1 Props contract (`PhotoViewer`)

```js
<PhotoViewer
  visible={boolean}
  items={MediaItem[]}            // the viewer list: MediaGallery's reversed grid list, or [soloItem]
  initialIndex={number}          // index of the tapped item in `items`
  origin={{ x, y } | null}       // tap point in window coords; null → centre pop
  activeStore={store}            // MediaGallery's viewerActiveStore ({ get, set, subscribe })
  hdStore={store}                // MediaGallery's viewerHdStore ({ get(id), subscribe, mark })
  dragStore={store}              // MediaGallery's pagerDragStore ({ get, set, subscribe })
  getFullUrl={(path) => url}
  tagSuggestions={string[]}      // MediaGallery's globalAlbums minus system albums
  onIndexSettled={(item, index) => void}   // fired only at rest → MediaGallery setSelectedMedia
  onCommitTags={(mediaId, tags) => void}   // MediaGallery commitTags (optimistic)
  onToggleFavourite={(item) => void}
  onShare={(item) => void}
  onEditImage={(item) => void}
  onClosed={() => void}          // after the close animation; MediaGallery clears selectedMedia
  theme={theme}
  insets={insets}
  bottomInset={number}           // tab dock height + 20, so the bottom bar clears the dock
>
  {/* MediaGallery-owned overlays that must live inside the viewer's Modal:
      the share-quality chooser and the "preparing" overlay. */}
</PhotoViewer>
```

`items` may change identity while open (tag spreads, sparse pages landing). The stage keys pages by
media id and reads `items` through a ref inside gesture callbacks, so a new array never touches a
gesture in flight. If the active item disappears from `items` (deleted), the viewer closes.

### 3.2 Data flow

- Open: MediaGallery `openViewer(item, origin)` sets `selectedMedia`, the origin and the initial
  index (index into the reversed list, or a solo list when the item is not in it). `visible` follows
  `selectedMedia !== null`.
- Page settle: the stage calls `runOnJS(settled)(index)` once, when the finger is up and the page
  animation has finished. The shell sets `activeIndex` state, `activeStore.set(item.id)`,
  `dragStore.set(false)`, and calls `onIndexSettled(item, index)`. MediaGallery's existing HD
  manager subscribes to `activeStore` and warms the display variant of the active photo and its
  neighbours exactly as today; `flushHdMarks` still drains on `dragStore` false.
- Gesture start: the stage calls `runOnJS(dragStore.set)(true)` once per pan begin. Nothing else
  crosses to JS during a gesture.
- Close: the shell runs the close animation, then `onClosed()`; MediaGallery sets `selectedMedia`
  to null and the Modal hides.

## 4. Gesture model

One gesture tree on the stage root:

```
Race(
  Simultaneous(pinch, pan),
  Exclusive(doubleTap, singleTap),
)
```

All handlers are worklets over shared values. `pan` has `minDistance(4)`; the mode is decided once
per gesture, at the first update whose travel exceeds `AXIS_LOCK_DISTANCE` (8 pt), and never changes
until release.

| State at lock | Travel | Mode |
| --- | --- | --- |
| not zoomed, start x < 24 pt, dx > 0 and dominant | — | `edgeBack` |
| not zoomed | `|dy| > |dx| × 1.2` and dy > 0 | `dismiss` |
| not zoomed | `|dy| > |dx| × 1.2` and dy < 0 | `details` (swipe up) |
| not zoomed | otherwise | `page` |
| zoomed | any | `zoomPan` |

Rules per mode:

- **page** — `pagerX = dx`, rubber-banded past the first and last page with the UIScrollView bounce
  curve (`rubberBand(overflow, width, 0.55)`). Release: target is `+1`/`-1` when
  `|vx| > PAGE_FLICK_VELOCITY` (400 pt/s) in that direction, else when `|dx| > width × 0.5`, else
  `0`. Exactly one page per swipe. The stage re-bases (`activeIndex += target;
  pagerX -= target × PAGE_W`) and settles `pagerX → 0` with `withTiming`, ease-out cubic, duration
  from `settleDuration(remaining, velocity)` (200–320 ms). A new touch during the settle cancels the
  animation and continues from the current offset (interruptible).
- **dismiss** — `dragX = dx`, `dragY = dy` (two-axis follow). Derived on the UI thread:
  scale `1 → 0.7` over `0.55 × height`, backdrop opacity `1 → 0` over `0.45 × height`, chrome opacity
  `1 → 0` over 60 pt. Release: commit when `dy > 100` or (`dy > 30` and `vy > 700 pt/s`); the photo
  flies back to the tap origin while the backdrop fades (the same retreat as a button close); else
  spring home carrying the release velocity.
- **details** — release with `dy < -50` or `vy < -500 pt/s` opens the details sheet; otherwise
  nothing. The photo does not move on an upward drag (iOS lifts it; we keep the sheet simple).
- **edgeBack** — the photo follows the finger like `dismiss`; release with `dx > 80` or
  `vx > 500 pt/s` closes, else springs home.
- **zoomPan** — `tx/ty = saved + translation`, rubber-banded past the letterboxed image bounds from
  `zoomMath.panBound`. Horizontal overflow past the bound flows into `pagerX` (zoomed-edge handoff),
  rubber-banded at the ends of the list. Release: a page change when `|pagerX| > width × 0.3` or a
  flick in that direction with `pagerX` already non-zero; otherwise `pagerX` springs to 0 and the
  photo settles with `withDecay` inside its bounds. When a zoomed page is swiped away its zoom
  resets the moment the page change settles (it is off-screen by then).
- **pinch** — focal-anchored scale with two-finger drag, `rubberScale` past the limits (0.9
  resistance below 1× so the photo tracks the fingers toward the grid). A pinch that starts unzoomed
  and releases below `PINCH_DISMISS_SCALE` (0.72, raw) closes the viewer. The number of pointers can
  change mid-gesture; the pan re-baselines on that change (`zoomMath.absorbTouchJump` semantics,
  implemented locally) so lifting one finger does not throw the photo.
- **doubleTap** — zoom to `fillScale` at the tapped point (or `DOUBLE_TAP_SCALE` when the aspect is
  unknown), clamped by `nativeMaxScale` from the source pixels; when zoomed, back to 1× centred.
- **singleTap** — `maxDistance(12)`, `maxDuration(260)`; toggles the chrome. Ignored when
  `settling` is true or `pagerX ≠ 0` (a tap on a moving page is a failed swipe, not a request).

`zoomed` (scale > 1.01) is mirrored to React once per flip through `useAnimatedReaction` +
`runOnJS`, because the chrome must hide and stop accepting touches while zoomed. That is the only
JS hop tied to zoom.

## 5. Page layout and direction

Pages are absolutely positioned views of width `width`, separated by `GUTTER = 24` (`PAGE_W =
width + 24`). A page's transform, computed in its own `useAnimatedStyle`:

```
translateX = (index − activeIndex) × PAGE_W + pagerX + (isActive ? dragX : 0)
translateY = isActive ? dragY : 0
scale      = isActive ? dragScale × scale : 1
opacity    = isActive ? 1 : (dragY > 0 ? 0 : 1)   // neighbours vanish during a dismiss drag
```

The zoom transform (`scale`, `tx`, `ty`) applies to the active page only.

**Direction invariant.** `items` is the same reversed list the FlatList paged, and index maps to
x exactly as the FlatList laid it out (index increases to the right, `initialIndex` opens at
offset 0). Swiping left therefore reveals the next index, as before. The device-confirmed rule
"swipe-right → latest" holds by construction; nothing is re-derived. If the phone ever disagrees,
`PAGE_DIRECTION` in `viewerGestureMath.js` (default `1`) is the single place to flip.

## 6. Chrome

Two absolutely positioned bands, both `pointerEvents="box-none"` while shown so only the buttons
are targets and every other touch reaches the stage:

- Top: a black-to-transparent gradient (`insets.top + 68` tall); back chevron on the left; edit
  pencil (images only) and tags icon on the right.
- Bottom (`bottomInset` above the bottom edge): left, the timestamp on one line
  (`originalDate` → `Sep 9, 2026, 10:03 AM`; else `uploadDate` → date only) and, under it,
  `W × H` (+ ` · Video`); right, a translucent pill with share and favourite (heart filled red when
  `tags` contains `Favourites`). For a video the pill also has play/pause and mute; the page itself
  has no buttons.

Opacity is one animated style: `openProgress × chromeOpacity(state) × dragChrome(dragY)`, where
`chromeOpacity` is a shared value driven `withTiming(200 ms)` from `chromeVisible && !zoomed`. The
status bar hides with the chrome. No other opacity products, no per-element `pointerEvents`
expressions, no measurements.

## 7. Sheets

Both sheets are in-tree overlays inside the viewer's Modal (never a sibling `Modal`: iOS drops it),
mounted only while open, so a closed sheet costs the gesture path nothing. Both use
`ViewerSheet`: scrim `Pressable` that closes on tap, card anchored to the bottom, handle, slide-up
entrance (`Animated.timing`, 240 ms), and `useSheetDismiss` for pull-down-to-close (grab region =
the whole card; the scrim fades with the drag).

- **Tags sheet** (tags button, or "Edit tags" in details). Header "Tags" + Done. Body: the photo's
  current tags as chips with an ✕ (tap removes); below, "Add to album" suggestion chips from
  `tagSuggestions` not already on the photo (tap adds); bottom: a composer row with a text input
  ("Add a tag…") and a send button, keyboard-aware through `KeyboardAvoidingView` (padding). Every
  add/remove calls `onCommitTags(mediaId, nextTags)` immediately; the chips reflect `item.tags`
  from props, so the optimistic update flows back through `items`. `Favourites` is never removable
  here (it belongs to the heart). Input is trimmed; empty and duplicate entries are ignored.
- **Details sheet** (swipe up). Rows: date and time, filename, `W × H · N MB`, type; then "Tags"
  with read-only chips and an "Edit tags" button that closes this sheet and opens the tags sheet.

## 8. Open, close, and the HD discipline

- Open: `openProgress` runs `0 → 1` (200 ms, ease-out); the stage scales `0.85 → 1` and translates
  from the tap origin to centre; the backdrop fades in over 120 ms. The initial page mounts at
  `pagerX = 0` with the fast URI; the HD manager warms it immediately and its neighbours after
  250 ms, exactly as today (unchanged code).
- Close (back button, edge back, pinch-in, drag commit, item removed): `openProgress → 0` (150 ms
  ease-in) with `dragX/dragY` springing to 0 concurrently, backdrop → 0; then `onClosed()`.
- HD rules kept verbatim from the current design: the page renders one image; the URI flips only
  when the per-photo flag flips; flags flip only on quiet frames (the manager checks `dragStore`);
  warming is prefetch-only. The page never mounts a second image and never subscribes to the drag.

## 9. Video pages

`ViewerPage` renders `expo-video` (`contentFit="contain"`, muted, `audioMixingMode:
'mixWithOthers'`, loops) and plays only while active (from `activeStore`). Play/pause and mute are
chrome buttons; unmuting sets `doNotMix` and pauses the music player, as today. Videos do not zoom
(pinch and double-tap are no-ops on a video page); page, dismiss, details and edge-back work.

## 10. Edge cases

- Empty `items` or `initialIndex` out of range → clamp to `[0, length − 1]`; empty list closes.
- Active item deleted while open → the viewer closes.
- First/last page: rubber band only; no wrap.
- Android: the same gesture tree runs (Gesture Handler + Reanimated are cross-platform). The Modal
  is full screen on both; `StatusBar hidden` toggles with the chrome.
- Reduced motion: Reanimated honours the system switch for `withTiming`/`withSpring`.
- A gesture interrupted by an unmount (close during drag) leaves no timers or listeners: all state
  is shared values reset on open.

## 11. Testing and verification

- `utils/__tests__/viewerGestureMath.test.js`: axis lock (bias, edge zone, up/down), page target
  (flick, distance, ends), rubber band monotonic and bounded, dismiss commit rule, interpolations at
  their anchors, zoom-edge spill split, settle duration bounds.
- `screens/TurtleScreen/components/PhotoViewer/__tests__/PhotoViewer.test.jsx`: smoke render with
  Reanimated's jest mock and Gesture Handler's `jestSetup`: renders the active page's fast URI,
  the timestamp text, the heart state; pressing the tags button mounts the tags sheet; committing a
  tag calls `onCommitTags` with the merged list.
- Repo gates (`turtle-mobile-verify`): babel parse of every touched file, full jest suite, the AST
  undef-audit on `MediaGallery.jsx` and every new file, and an `expo export --platform ios` bundle
  of the worktree.
- On-device (the only real test; the user runs it after an OTA to the preview channel): swipe
  direction (swipe-right → latest), one page per flick, grab a page mid-flight, end-of-list bounce,
  swipe that starts on the photo vs. on the bands, tap toggles chrome once, double-tap fill and
  back, pinch with focal tracking, pan a zoomed photo past its edge into the next one, pinch-in to
  close, drag-down dismiss with fly-back, swipe-up details, tags sheet add/remove with the keyboard
  up, favourite heart, share, video play/mute, Android sanity.

## 12. Rollout

Work happens in the worktree `mobile-app/.worktrees/photo-viewer` on `feat/photo-viewer-rewrite`
(the main working tree carries another session's uncommitted WIP; its viewer edits are snapshotted
on `capture/desktop-2026-09-09-viewer-wip`). When the gates pass: merge into `master` and
`release/preview`, push to `r730dev`, pull the R730 release checkout, and publish an OTA to the
preview channel from the pond. The user flips "This phone follows preview" to test.

## 13. Constants

| Name | Value | Meaning |
| --- | --- | --- |
| `GUTTER` | 24 | black gap between pages (unchanged) |
| `AXIS_LOCK_DISTANCE` | 8 pt | travel before the mode is decided |
| `VERTICAL_BIAS` | 1.2 | `|dy| > |dx| × bias` → vertical mode |
| `EDGE_BACK_ZONE` | 24 pt | start x for the edge-back mode |
| `EDGE_BACK_COMMIT_DX` / `_VX` | 80 pt / 500 pt/s | commit thresholds |
| `PAGE_FLICK_VELOCITY` | 400 pt/s | flick → page |
| `PAGE_DISTANCE_RATIO` | 0.5 | drag past half a page → page |
| `END_RUBBER` | 0.55 | UIScrollView bounce coefficient |
| `SETTLE_MIN_MS` / `SETTLE_MAX_MS` | 200 / 320 | page settle duration bounds |
| `DISMISS_COMMIT_DY` | 100 pt | drag commit |
| `DISMISS_FLICK_VY` / `DISMISS_FLICK_MIN_DY` | 700 pt/s / 30 pt | flick commit |
| `DISMISS_SCALE_MIN` / `DISMISS_SCALE_SPAN` | 0.7 / 0.55 × height | shrink during the pull |
| `DISMISS_BACKDROP_SPAN` | 0.45 × height | backdrop fade span |
| `DISMISS_CHROME_SPAN` | 60 pt | chrome fade span |
| `DETAILS_COMMIT_DY` / `_VY` | −50 pt / −500 pt/s | swipe-up commit |
| `ZOOM_HANDOFF_RATIO` | 0.3 | zoomed-edge spill past this fraction of width pages |
| `ZOOMED_EPSILON` | 1.01 | scale above this counts as zoomed |
| `PINCH_DISMISS_SCALE` | 0.72 | pinch-in below this (raw) closes |
| `UNDERSCALE_RUBBER` | 0.9 | pinch resistance below 1× |
| `OPEN_MS` / `CLOSE_MS` | 200 / 150 | pop durations |
| `CHROME_FADE_MS` | 200 | chrome toggle |
| `PAGE_DIRECTION` | 1 | the only knob for swipe direction |
