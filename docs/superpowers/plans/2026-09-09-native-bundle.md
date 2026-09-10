# Native rebuild bundle — build 4 (roadmap item 5)

Every native change is a new fingerprint, and a new fingerprint is a new OTA
baseline: phones on the old build stop receiving updates published against
the new one. So native changes are BATCHED into one build, and that build
lives on its own branch until it is installed.

Branch: `feat/native-bundle` (off `feat/photo-viewer-rewrite`). It is NOT
merged into `release/preview` until the build is installed on the phone —
the R730 publish script checks `fingerprint:compare` against the current
baseline (build 3, `555ba54a…`) and every OTA published from `release/preview`
must keep matching it until then.

## What is in the bundle

| change | why | status |
|---|---|---|
| `react-native-keyboard-controller` 1.18.5 + `KeyboardProvider` at the app root | native keyboard tracking on both platforms; screens adopt `useReanimatedKeyboardAnimation` / `KeyboardAwareScrollView` one at a time afterwards (header-preserving avoidance) | installed + provider wired; no screen adopts it yet, so nothing changes on screen |
| `expo-updates` ~29.0.20, `expo-local-authentication` ~17.0.9 | `expo install --check` flagged them behind SDK 54's expected versions | aligned |
| `react-native-share` 12.3 (batch share, ONE OS sheet) | already a dependency → already in build 3; nothing to add | in |
| iOS `buildNumber` 4, Android `versionCode` 3 | new binaries | bumped |
| Android build | first Android binary of the OTA era; same channel/runtime model | eas.json profiles are platform-agnostic — build with `--platform android` |

## Runbook (R730, PowerShell)

The desktop cannot run EAS (cold mirror, no token); every build runs from the
release checkout `C:\turtle-dev\mobile-release`.

```powershell
cd C:\turtle-dev\mobile-release
git fetch origin
git checkout feat/native-bundle
git pull --ff-only origin feat/native-bundle
npm ci
$env:EXPO_TOKEN = (Get-Content C:\turtle-dev\home\expo-token.txt -Raw).Trim()
$env:CI = 'true'
# iOS — INTERACTIVE (the distribution certificate is not validated for --non-interactive):
npx eas-cli@latest build --platform ios --profile production
# Android — first run creates the keystore through EAS credentials (interactive):
npx eas-cli@latest build --platform android --profile production
```

Both builds report a build id. Note the new fingerprint (`eas fingerprint:compare
--build-id <new-ios-id>` from the same checkout must say MATCHES).

## After the phone has the new build

1. Install build 4 from the EAS build page (same bundle id — data persists).
2. Merge `feat/native-bundle` into `release/preview` and push (origin + r730dev).
3. Point the publish script at the new baseline: in
   `C:\turtle-dev\home\ota-publish-viewer.ps1` replace the build id in the
   `fingerprint:compare --build-id …` line with the new iOS build id.
4. `git checkout release/preview` in `C:\turtle-dev\mobile-release` again.
5. Publish a preview OTA as usual; the runtime in the publish output must
   equal the new fingerprint. Old build-3 phones keep the last OTA published
   for `f8969806…` (like build-2 phones kept 12043250).
6. Update memory `mobile-ota-updates-setup` with the new build id + runtime.

## Adoption candidates once build 4 is live (each is an OTA)

- Chat composer: replace `useAnimatedKeyboard` (Reanimated) with
  `useReanimatedKeyboardAnimation` from keyboard-controller — same shared
  value, native progress on Android.
- Task / note composers: `KeyboardAwareScrollView` from keyboard-controller
  in place of `react-native-keyboard-aware-scroll-view`
  (`components/KeyboardSafeView`), keeping headers pinned.
- ViewerSheet's "only lift if covered" rule stays; it just gets a smoother
  height source.
