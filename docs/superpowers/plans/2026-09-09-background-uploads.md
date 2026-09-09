# Background uploads — phased plan

Goal: photos and videos queued in the vault keep uploading when the app is backgrounded or closed,
with the least native change first and the honest limits of each platform written down.

## Where we stand (2026-09-09)

- Uploads go through `services/streamMultipartUpload.js` → `expo-file-system/legacy`
  `createUploadTask(...)`. The legacy API's `sessionType` defaults to `BACKGROUND`, so on iOS every
  upload already runs on a background `NSURLSession`: a file that is IN FLIGHT when the app goes to the
  background keeps transferring, and if the system kills the app mid-transfer iOS finishes the transfer
  and relaunches the app in the background to be told (expo-file-system implements the app-delegate
  hook). A user force-quit still cancels background sessions.
- `context/VaultUploadContext.jsx` runs ONE item at a time from JavaScript, checkpoints the queue to
  AsyncStorage after every item, and resumes from the first un-uploaded item on foreground. So once the
  app is suspended nothing NEW starts: the in-flight file finishes, the rest wait for the next launch.
- `app.json` declares only `UIBackgroundModes: ["audio"]`. No `expo-background-task` /
  `expo-task-manager`. Android has no background execution at all once the activity is gone.

## Phase 1 — fan out before suspending (JS only, ships as an OTA)

What: when the app is about to background (`AppState` → `background`) — or simply always — hand the
background session SEVERAL files instead of one. Create upload tasks for the next N queued items
(N ≈ 6–10; NSURLSession queues and runs them itself, a few at a time), record each task's item id in
the persisted queue as `in-flight`, and let the session carry them while the app sleeps. On foreground,
reconcile: promises that resolved while suspended are handled as today; items still marked in-flight
whose promise never returned (app was killed) are re-queued — the server's dedupe (content hash on
`/media/upload`; verify it exists, add it if not) makes a repeat upload idempotent.
- Files: `context/VaultUploadContext.jsx` (concurrency + in-flight bookkeeping + reconcile),
  `services/streamMultipartUpload.js` (expose the task so it can be tracked; keep the retry/stall
  logic per task), server `/media/upload` (dedupe by SHA-256 of the file if missing).
- Limits: iOS only. Works while suspended and across a system kill; not across a user force-quit.
  Nothing wakes the app to add MORE files after those N; that is Phase 2.
- Verify: queue 20 photos, background the app, wait, foreground → all 20 uploaded with no duplicates;
  same with the app swiped away 30 s in (the in-flight batch completes; the rest resume on launch).
- No rebuild, no new permission.

## Phase 2 — a background task that drains the queue (native rebuild)

What: add `expo-background-task` (+ `expo-task-manager`). Register a task that, when iOS grants a
`BGProcessingTask` window (system-scheduled, minutes to hours apart, needs power/network), loads the
persisted queue and starts the next batch through Phase 1's fan-out. Also run it from
`handleEventsForBackgroundURLSession` completion so one finished batch can start the next.
- Permissions / config: `app.json` → plugin `expo-background-task`; `ios.infoPlist.UIBackgroundModes`
  add `"processing"` (and `"fetch"`); `BGTaskSchedulerPermittedIdentifiers` (the plugin writes it).
- Rebuild: YES — new native module + plist keys change the runtime fingerprint. Steps: bump
  `ios.buildNumber`, `npx eas-cli build --platform ios --profile production --non-interactive` from
  `C:\turtle-dev\mobile-release` (proven to work without an Apple login), install, then every OTA is
  published against the new fingerprint (`fingerprint:compare` first, as always).
- Limits: iOS decides WHEN the task runs; Low Power Mode and a force-quit stop it. Realistic outcome:
  a queue drains within the hour of the phone being idle on Wi-Fi/charger, not instantly.

## Phase 3 — Android: a foreground service for the queue (native rebuild)

What: Android kills background JS quickly and has no equivalent of background NSURLSession. The
reliable path is a foreground service with a persistent "Uploading n of m" notification that owns the
transfer loop. Options, in order of preference: (a) `expo-background-task` for periodic drains (WorkManager,
same limits as iOS: not immediate), (b) a small custom Expo module wrapping a `ForegroundService` +
`WorkManager` upload worker, (c) a third-party native uploader (`react-native-background-upload` is
unmaintained; treat as last resort).
- Permissions: `FOREGROUND_SERVICE`, `FOREGROUND_SERVICE_DATA_SYNC`, `POST_NOTIFICATIONS`
  (Android 13+), `INTERNET`; a notification channel.
- Rebuild: YES (Android build; we currently ship iOS only, so this phase waits for an Android target).

## Phase 4 — resumable, deduplicated transfers (server + client)

What: chunked/resumable uploads (tus-style or a simple `PUT /media/upload/:sessionId/chunk`) so a
transfer interrupted by a kill continues from its last chunk instead of restarting, plus server-side
content-hash dedupe so a retried file never lands twice. Reduces wasted bytes on cellular and makes
Phases 1–3 safe to retry aggressively.
- Files: server `routes/media.js` (upload session table, chunk endpoint, hash index), client
  `streamMultipartUpload.js` (chunk loop with `Range`), queue bookkeeping (`sessionId`, `offset`).
- No native change.

## Phase 5 — auto-upload new camera photos while closed (the iCloud-like goal)

What: `expo-media-library` change listener while the app runs; while closed, the Phase 2 task scans
for assets newer than the last upload watermark and queues them. Needs the Photos permission at
"All Photos" level (already requested) and the user's opt-in switch.
- Limits: iOS never runs a third-party app on "new photo taken"; the scan happens only in the Phase 2
  windows. This is the same constraint every non-Apple photo app lives with.

## Order and effort

| Phase | Rebuild | Effort | Delivers |
| --- | --- | --- | --- |
| 1 | no | 1 session | iOS: several files continue after backgrounding; clean resume after kill |
| 2 | yes (iOS) | 1 session + build | iOS: queue drains while closed, on the system's schedule |
| 4 | no (server+client) | 1–2 sessions | no restarts from zero, no duplicates |
| 3 | yes (Android) | 1–2 sessions | Android background uploads |
| 5 | no (on top of 2) | 1 session | camera roll auto-upload while closed |

Start with Phase 1 after the viewer round is promoted, then Phase 2 with the next native build.
