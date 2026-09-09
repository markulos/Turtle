# Photo Viewer Rewrite Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the vault's full-screen viewer with a single-gesture-tree, Reanimated-driven viewer whose paging, dismiss, zoom and sheets behave like iOS Photos, per `docs/superpowers/specs/2026-09-09-photo-viewer-rewrite-design.md`.

**Architecture:** New `screens/TurtleScreen/components/PhotoViewer/` (shell, stage, page, chrome, sheets) plus two pure utils; `MediaGallery.jsx` keeps data, stores, HD manager and actions and renders `<PhotoViewer>`. `ZoomableView.jsx` and `viewerMedia.jsx` are deleted.

**Tech Stack:** React Native 0.81 / Expo 54, react-native-reanimated 4.1 (worklets), react-native-gesture-handler 2.28, expo-image, expo-video, jest-expo.

## Global Constraints

- All gesture math is worklet-safe (`'worklet'` directive, plain numbers, no JS-thread helpers).
- No React state on the gesture path; one `runOnJS` at pan begin, one at rest, one per zoom flip.
- Pages: one `expo-image` per page; URI = `hdReady ? display : fast`; never subscribe to the drag.
- `items` is the reversed viewer list; index → x is `(index − active) × PAGE_W × PAGE_DIRECTION + pagerX`; `PAGE_DIRECTION = 1`.
- Every bottom sheet uses `utils/useSheetDismiss` and is an in-tree overlay (never a sibling `Modal`).
- Every mutation is optimistic (commit immediately, revert on failure — MediaGallery's `commitTags` already does this).
- Work only in the worktree `mobile-app/.worktrees/photo-viewer` on `feat/photo-viewer-rewrite`. Run jest as `npx jest --testPathIgnorePatterns node_modules <paths>` (the repo config ignores `.worktrees/`).
- Commit messages: repo convention (`feat(viewer): …`), no co-author trailers, heredoc via `git commit -F -`.

Spec: `docs/superpowers/specs/2026-09-09-photo-viewer-rewrite-design.md` (constants table = §13).

---

### Task 1: Pure gesture math and formatting helpers

**Files:**
- Create: `utils/viewerGestureMath.js`
- Create: `utils/viewerFormat.js`
- Test: `utils/__tests__/viewerGestureMath.test.js`, `utils/__tests__/viewerFormat.test.js`

**Interfaces (produces):**
```js
// viewerGestureMath.js — all 'worklet'
export const MODE = { NONE: 0, PAGE: 1, DISMISS: 2, DETAILS: 3, EDGE_BACK: 4, ZOOM_PAN: 5 };
export const PAGE_DIRECTION = 1; GUTTER = 24; AXIS_LOCK_DISTANCE = 8; VERTICAL_BIAS = 1.2;
export const EDGE_BACK_ZONE = 24; EDGE_BACK_COMMIT_DX = 80; EDGE_BACK_COMMIT_VX = 500;
export const PAGE_FLICK_VELOCITY = 400; PAGE_DISTANCE_RATIO = 0.5; END_RUBBER = 0.55;
export const SETTLE_MIN_MS = 200; SETTLE_MAX_MS = 320;
export const DISMISS_COMMIT_DY = 100; DISMISS_FLICK_VY = 700; DISMISS_FLICK_MIN_DY = 30;
export const DISMISS_SCALE_MIN = 0.7; DISMISS_SCALE_SPAN_RATIO = 0.55; DISMISS_BACKDROP_SPAN_RATIO = 0.45; DISMISS_CHROME_SPAN = 60;
export const DETAILS_COMMIT_DY = -50; DETAILS_COMMIT_VY = -500; ZOOM_HANDOFF_RATIO = 0.3;
export const ZOOMED_EPSILON = 1.01; PINCH_DISMISS_SCALE = 0.72; UNDERSCALE_RUBBER = 0.9;
export const OPEN_MS = 200; CLOSE_MS = 150; CHROME_FADE_MS = 200;
export function lockMode({ dx, dy, startX, zoomed }) → MODE.*      // NONE until AXIS_LOCK_DISTANCE
export function rubberBand(overflow, dim, coeff = END_RUBBER) → number   // signed, |out| < dim
export function pagerOffset(dx, index, count, width) → number      // dx, rubber-banded past the ends
export function pageTarget({ dx, vx, index, count, width }) → -1 | 0 | 1   // already clamped to range
export function pageTranslate(index, activeIndex, pagerX, pageW) → number
export function settleDuration(remaining, velocity) → ms in [200, 320]
export function shouldCommitDismiss(dy, vy) → boolean
export function shouldOpenDetails(dy, vy) → boolean
export function shouldCommitEdgeBack(dx, vx) → boolean
export function dismissScale(dy, height) → [0.7, 1]
export function dismissBackdrop(dy, height) → [0, 1]
export function dismissChrome(dy) → [0, 1]
export function splitZoomPan(desired, bound) → { inside, spill }
export function shouldHandoff(pagerX, vx, width) → -1 | 0 | 1
export function clampIndex(index, count) → number

// viewerFormat.js
export function formatViewerTimestamp(item) → 'Sep 9, 2026, 2:03 PM' | 'Sep 9, 2026' | ''
export function formatViewerResolution(item) → '4032 × 3024' | '4032 × 3024 · Video' | ''
export function parseTags(item) → string[]     // tolerant of bad JSON / missing
export function isFavourite(item) → boolean
export const FAVOURITES_TAG = 'Favourites'
```

- [ ] Step 1: Write the failing tests (the two test files, full content in the repo).
- [ ] Step 2: `npx jest --testPathIgnorePatterns node_modules utils/__tests__/viewerGestureMath.test.js utils/__tests__/viewerFormat.test.js` → fails "Cannot find module".
- [ ] Step 3: Implement both modules to the interfaces above. `lockMode` returns `NONE` while both |dx| and |dy| are below `AXIS_LOCK_DISTANCE`; vertical when `|dy| > |dx| × VERTICAL_BIAS`; `EDGE_BACK` when not vertical, `startX < EDGE_BACK_ZONE` and `dx > 0`. `rubberBand` is the UIScrollView curve `sign × (1 − 1 / (|o| × c / dim + 1)) × dim`. `pageTarget` prefers velocity, then distance, returns 0 when the target leaves `[0, count − 1]`; the step is multiplied by `PAGE_DIRECTION`. `settleDuration = clamp(200 + |remaining| × 0.3 − |v| × 0.04, 200, 320)`. `shouldHandoff` returns 0 for `pagerX === 0`, else the spill direction when `|pagerX| > width × ZOOM_HANDOFF_RATIO` or a flick (`|vx| > PAGE_FLICK_VELOCITY`) with the same sign as `pagerX`.
- [ ] Step 4: Run the tests → pass.
- [ ] Step 5: Commit — `feat(viewer): pure paging, dismiss and zoom-handoff math for the new viewer`.

### Task 2: ViewerPage — the dumb cell

**Files:**
- Create: `screens/TurtleScreen/components/PhotoViewer/ViewerPage.jsx`
- Create: `screens/TurtleScreen/components/PhotoViewer/stageValues.js` (`useStageValues`)
- Create: `screens/TurtleScreen/components/PhotoViewer/stores.js` (`useIsActive`, `useHdReady`, moved verbatim from `viewerMedia.jsx`)

**Interfaces:**
- Consumes: `pageTranslate`, `GUTTER`, `dismissScale` from Task 1; `activeStore`/`hdStore` (`{ get, subscribe }`).
- Produces:
```js
export function useStageValues(width, height) → sv   // stable object of shared values:
  // pagerX, activeIndex, zoomIndex, scale, tx, ty, dragX, dragY, openProgress, settling, count,
  // aspect, chrome, originX, originY  + plain numbers pageW, width, height
export const ViewerPage = React.memo(({ item, index, sv, activeStore, hdStore, getFullUrl, onAspect, onVideoControls }))
  // onAspect(id, aspectRatio) from expo-image onLoad when the row lacks width/height
  // onVideoControls(id, controls | null): a video page registers { togglePlay, toggleMute, getState } while active
```
- Style per spec §5: `translateX = pageTranslate(index, sv.activeIndex.value, sv.pagerX.value, sv.pageW) + (active ? sv.dragX.value : 0)`; `translateY = active ? sv.dragY.value : 0`; `scale = active ? dismissScale(sv.dragY.value, sv.height) × (zoomOwner ? sv.scale.value : 1) : 1`; zoom translate `(zoomOwner ? sv.tx/ty : 0)`; `opacity = active ? 1 : (sv.dragY.value > 0 || sv.openProgress.value < 1 ? 0 : 1)`, with `active = index === sv.activeIndex.value`, `zoomOwner = index === sv.zoomIndex.value`.
- Image branch: the old `ImageViewer` URI policy (compressed > thumbnail > raw fast; `/api/media/display/<id>` when `hdReady`), `transition={160}`, `recyclingKey`, blurhash placeholder, `onLoad` → `onAspect` when `item.width/height` missing, `onError` → `console.warn`. Video branch: `useVideoPlayer` with `loop`, `muted`, `audioMixingMode: 'mixWithOthers'`; plays only while active; registers controls via `onVideoControls`; unmute → `doNotMix` + `useMusicPlayer().pause()`.

- [ ] Step 1: Write `stores.js`, `stageValues.js`, `ViewerPage.jsx`. Step 2: babel parse each. Step 3: Commit — `feat(viewer): page cell and shared stage values`.

### Task 3: ViewerStage — the gesture engine

**Files:**
- Create: `screens/TurtleScreen/components/PhotoViewer/ViewerStage.jsx`

**Interfaces:**
- Consumes: Task 1 math; `zoomMath` (`containSize`, `panBound`, `rubberClamp`, `rubberScale`, `clampScale`, `fillScale`, `focalTranslate`, `settle`, `MIN_SCALE`, `DOUBLE_TAP_SCALE`); `sv` from Task 2.
- Produces:
```js
export default function ViewerStage({ sv, children, zoomEnabled /* shared value 1|0 */, maxScale /* shared value */,
  onDragBegin, onRest, onDismiss, onEdgeBack, onOpenDetails, onSingleTap, onZoomedChange, onPinchDismiss })
```
- Gesture tree `Race(Simultaneous(pinch, pan), Exclusive(doubleTap, singleTap))`; `pan.minDistance(4).maxPointers(1)`; mode locked once per gesture with `lockMode`; handlers as spec §4. `commitPage(step, vx)`: `activeIndex += step; pagerX -= step × pageW × PAGE_DIRECTION; settling = 1; pagerX = withTiming(0, { duration: settleDuration(|pagerX|, vx), easing: Easing.out(Easing.cubic) }, finished → { settling = 0; if step ≠ 0 { scale = 1; tx = 0; ty = 0; zoomIndex = activeIndex } runOnJS(onRest)(activeIndex) })`. `onBegin` cancels the pagerX animation (interruptible). Pinch/double-tap are no-ops when `zoomEnabled.value === 0`. `useAnimatedReaction` on `scale > ZOOMED_EPSILON` → `runOnJS(onZoomedChange)`.
- Root: `<GestureDetector gesture={g}><Animated.View style={[StyleSheet.absoluteFill, popStyle]} collapsable={false}>{children}</Animated.View></GestureDetector>`, `popStyle` = `scale 0.85→1` and `translate origin × (1 − openProgress)`.

- [ ] Step 1: Write. Step 2: parse. Step 3: Commit — `feat(viewer): one gesture tree for paging, dismiss and zoom`.

### Task 4: ViewerChrome

**Files:** Create `screens/TurtleScreen/components/PhotoViewer/ViewerChrome.jsx`

```js
export default React.memo(function ViewerChrome({ sv, item, shown, insets, bottomInset, theme,
  onBack, onEdit, onTags, onShare, onToggleFavourite, video /* { playing, muted } | null */, onTogglePlay, onToggleMute }))
```
- Two `Animated.View` bands, `pointerEvents={shown ? 'box-none' : 'none'}`, opacity `sv.openProgress × sv.chrome × dismissChrome(sv.dragY)`; content per spec §6; icons from `react-native-vector-icons/MaterialCommunityIcons`.

- [ ] Step 1: Write. Step 2: parse. Step 3: Commit — `feat(viewer): flat two-band chrome`.

### Task 5: Sheets

**Files:** Create `PhotoViewer/ViewerSheet.jsx`, `PhotoViewer/TagsSheet.jsx`, `PhotoViewer/DetailsSheet.jsx`

```js
ViewerSheet({ visible, onClose, title, headerRight, heightRatio, keyboard, theme, children })
TagsSheet({ visible, item, suggestions, onCommitTags, onClose, theme })
DetailsSheet({ visible, item, onEditTags, onClose, theme })
```
- `ViewerSheet`: null when `!visible`; scrim `Pressable`; card slides up 240 ms; `{...panHandlers}` + `sheetDragStyle` on the card; `scrollProps` on the body `ScrollView`; `keyboard` → `KeyboardAvoidingView behavior="padding"`.
- `TagsSheet`: chips from `parseTags(item)` (`Favourites` shown, not removable), suggestion chips = `suggestions − current`, composer input + send; add/remove → `onCommitTags(item.id, next)` immediately; trim, dedupe, ignore empty.
- `DetailsSheet`: rows per spec §7; `formatBytes` from `utils/statsFormat`.

- [ ] Step 1: Write the three files. Step 2: parse. Step 3: Commit — `feat(viewer): tags and details sheets on the shared shell`.

### Task 6: PhotoViewer shell + smoke test

**Files:** Create `PhotoViewer/PhotoViewer.jsx`, `PhotoViewer/index.js`; Test `PhotoViewer/__tests__/PhotoViewer.test.jsx`

- Props: spec §3.1. State: `activeIndex`, `chromeVisible`, `zoomed`, `tagsOpen`, `detailsOpen`, `videoState`; `closingRef`.
- Effect on `visible`: reset sv (`pagerX 0`, `activeIndex/zoomIndex = clampIndex(initialIndex)`, zoom 1/0/0, drags 0, `chrome 1`, origin from the prop), `activeStore.set(id)`, `openProgress = withTiming(1, OPEN_MS)`.
- `close()`: once; `openProgress = withTiming(0, CLOSE_MS)`, `dragX/dragY = withSpring(0)`; on finish `runOnJS(onClosed)`.
- Item-removed effect: `visible` and the active id not in `items` → `close()`.
- Render: `Modal(transparent, animationType none, statusBarTranslucent, onRequestClose=close)` → `GestureHandlerRootView` → backdrop (opacity `openProgress × dismissBackdrop(dragY)`) → `ViewerStage` with the ±1 pages → `ViewerChrome` → `TagsSheet` → `DetailsSheet` → `{children}`; `StatusBar hidden={!chromeVisible || zoomed}`.
- Smoke test: mocks for `react-native-reanimated` (`/mock`), `react-native-gesture-handler` (pass-through detector + chainable `Gesture` stub), `expo-image`, `expo-video`, `expo-linear-gradient`, `MusicPlayerContext`. Asserts: fast URI of the active item rendered; timestamp text; heart label reflects `Favourites`; tags button opens the sheet; adding "Trip" calls `onCommitTags('m1', ['Favourites', 'Trip'])`.

- [ ] Step 1: Write the failing test. Step 2: Write the shell. Step 3: Test passes. Step 4: Commit — `feat(viewer): the PhotoViewer shell`.

### Task 7: MediaGallery integration and deletions

**Files:** Modify `screens/TurtleScreen/components/MediaGallery.jsx`; Delete `ZoomableView.jsx`, `viewerMedia.jsx`.

- [ ] Replace `{renderFullScreenViewer()}` with `<PhotoViewer …>`; move the share chooser `Modal` and the `sharePreparing` overlay into its children.
- [ ] `openViewer`: keep the large-file alert; set `viewerOrigin`, `viewerInitialIndex`, `viewerSoloItem`, `selectedMedia`; drop the animation lines.
- [ ] `handleViewerClosed`: `setSelectedMedia(null); setViewerSoloItem(null)`.
- [ ] `toggleFavourite(item = selectedMedia)`, `handleShare(item = selectedMedia)`, `openImageEditor(item = selectedMedia)`.
- [ ] Move the old tag editor overlay out of the viewer to the gallery root so bulk tagging (`executeBulkTagSave`, opened at MediaGallery:1343) keeps working; the viewer no longer opens it.
- [ ] Delete `renderFullScreenViewer` and everything only it used (list in the spec §3, "Removed from MediaGallery.jsx"); grep each name for remaining users before deleting.
- [ ] Keep verbatim: the stores, the HD manager, `viewerSourceItems`, `viewerItems`, `commitTags`.
- [ ] Gates: babel parse; undef-audit; full jest; `npx expo export --platform ios --output-dir <scratch>`.
- [ ] Commit — `feat(viewer): MediaGallery hands the viewer to PhotoViewer; old pager, responder and chrome removed`.

### Task 8: Review, docs, memory

- [ ] Code review of the branch diff (cavecrew-reviewer / ecc:react-reviewer); fix findings.
- [ ] Update memory notes (photo-viewer-* superseded, task log, MEMORY.md). Commit docs.

### Task 9: Rollout

- [ ] Merge `feat/photo-viewer-rewrite` into `master` and `release/preview` (via worktrees; the main tree is dirty).
- [ ] Push both to `origin` and `r730dev`; on the R730 `git -C C:\turtle-dev\mobile-release pull origin release/preview`; `npx eas-cli@latest fingerprint:compare --build-id 87cd34ac-acc7-46d8-8362-5166264e7845 --non-interactive` must match.
- [ ] Publish: `node C:\turtle\server\scripts\publish-mobile-update.mjs --project C:\turtle-dev\mobile-release --channel preview --message "photo viewer rewrite"`.
- [ ] Hand the on-device checklist (spec §11) to the user.
