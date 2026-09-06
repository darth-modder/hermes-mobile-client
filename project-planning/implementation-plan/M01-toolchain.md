# M01 — Toolchain

**Status:** todo
**Depends on:** M00
**Goal:** An Expo dev-client build runs on a physical Android device from this machine.

## Facts

- Machine has Node 24.16 and npm 11.13.
- Machine has **no Android SDK, JDK, or adb** (`ANDROID_HOME` unset, no `platform-tools`).

## Tasks

- [ ] Install Android Studio (SDK 35+, platform-tools) and JDK 17; set `ANDROID_HOME`; add `platform-tools` to `PATH`; enable USB debugging on the phone.
      Alternative: EAS account and `eas build -p android --profile development`, then install the APK.
- [ ] Scaffold: `npx create-expo-app@latest . --template blank-typescript` (latest SDK), add `expo-router`, `expo-dev-client`
- [ ] `app.config.ts`: scheme `hermes-android`, `android.package` `com.nousresearch.hermes.mobile`, plugin list
- [ ] Copy repo conventions from hermes-agent: `.prettierrc` (no semicolons, single quotes, 120 cols, `arrowParens: avoid`, `trailingComma: none`); ESLint flat config with `typescript-eslint`, `perfectionist`, `react-hooks`, `unused-imports`
- [ ] `package.json` scripts: `typecheck`, `lint`, `lint:fix`, `test` (vitest), `check` (= typecheck + test + lint), `start` (`expo start --dev-client`), `android` (`expo run:android`), `prebuild`, `apk:release`
- [ ] `vitest.config.ts` for pure logic only (react-native aliased to a stub)
- [ ] `npm run android` installs and launches the blank app

## Deliverables

- Expo project skeleton with lint/format/test wiring
- `docs/CONNECTING.md` stub with the toolchain setup steps

## Exit criteria

- Blank app visible on the device.
- `npm run check` green.
- `adb devices` lists the phone (or the EAS dev build installs).
