# Klorn Mobile (bundled app)

Native Android + iOS app for Klorn: a **React 19 + TypeScript + Vite SPA bundled
into the binary** (`src/`), inside a **Capacitor 8** shell (`appId ai.klorn.app`,
committed `android/` and `ios/` projects). It talks to the Klorn API directly —
it no longer loads `app.klorn.ai` in a WebView. Only Klorn's colour/type tokens
are shared with the web (`src/styles/tokens.css` mirrors
`packages/web/src/app/globals.css`).

> **Standalone package** — NOT in the pnpm workspace. Use **npm** here (like
> `apps/desktop-mac`). Wire types come from `packages/contract` through a
> tsconfig path alias, as `import type` only (pinned by `src/config.test.ts`).

> **Status (2026-10-16): foundation.** Shell at every size class, auth, data
> layer, offline cache, i18n and the Today screen are built. Mail, Calendar,
> Files and Assistant are placeholder routes. The previous WebView shell got
> push registration, IAP and account deletion from the web app — those are
> **not yet** in the bundled app, so do not submit a store build from here
> until they are (see `STORE_SUBMISSION.md`).

## Commands

```bash
cd apps/mobile
npm ci
npm run dev          # Vite dev server against http://localhost:3001 (local API)
npm run dev:mock     # Vite dev server against the in-app mock API (fixtures)
npm run typecheck
npm test             # vitest: router, size classes, API client, i18n parity, Today model, tokens
npm run lint         # biome with the repo-root biome.json, errors only
npm run build        # typecheck + vite build → dist/ (what Capacitor bundles)
npm run e2e          # Playwright screenshots + behaviour against the mock build
npm run sync         # build + `cap sync` (copies dist/ into android/ and ios/)
npm run open:android # / open:ios — then Run in Android Studio / Xcode
```

API base: `VITE_KLORN_API_URL` at build time (https only, or http to
localhost / `10.0.2.2` for the Android emulator); unset → dev
`http://localhost:3001`, production build `https://klorn-api.onrender.com` (the
origin the web app and the Mac app ship with; `api.klorn.ai` is a CNAME to the
same Render service).

Screenshots: `KLORN_SHOTS_DIR=/some/dir npm run e2e` (default
`test-results/shots`). Specs cover 390×844, 412×915, 360×400 (Flip cover),
884×1104 (Fold flat, with an emulated vertical hinge, and half-folded
tabletop), 744×1133, 1024×1366 and 1366×1024, light and dark, plus Welcome and
the loading / empty / error / no-account / offline states. The hinge is
emulated with Chromium's display-feature override, so the real Viewport
Segments API is exercised. Mock builds accept `?insets=top,right,bottom,left`
to fake safe areas and `?scenario=` to pick a fixture set
(`src/api/mock/transport.ts`). `@playwright/test` is pinned to the Chromium
revision preinstalled in our images — never run `playwright install` there.

## Architecture

```
src/
  main.tsx, app/App.tsx        boot: services → providers → Root (Welcome | Cover | Shell)
  app/services.ts              API client singleton + in-memory session token
  app/theme.tsx                light/dark (OS default, override in Accounts), system bars
  config.ts, config-shared.ts  API base resolution + validation
  api/client.ts                fetch transport (CapacitorHttp on native), Bearer, timeouts, typed errors
  api/endpoints.ts             every route the app calls, typed from @klorn/contract (+ api/wire.ts)
  api/queries.ts               TanStack Query hooks + keys
  api/query-client.ts          offline-first cache persisted 24 h (Preferences / localStorage)
  api/mock/                    fetch shim + fixtures (`--mode mock`; never in `npm run build`)
  auth/                        session (Keychain/Keystore), OAuth relay/poll, PKCE
  i18n/                        en ko ja zh es fr de; device locale default; plural forms
  router/                      typed routes + deep links, tab memory, Android back decision
  layout/                      size classes, fold posture, Shell (tabs / rail / sidebar), ListDetail
  screens/                     today (built), cover (Flip), login (Welcome), mail (scaffold),
                               accounts, placeholder
  ui/                          icons (artboard paths), states, pull-to-refresh, source badges
  styles/                      tokens.css (light + dark), base.css
  assets/fonts/                Geist + Instrument Serif woff2 (OFL 1.1, licences alongside)
```

### Size classes and folds (`src/layout/size-class.ts`)

| Class | Rule | Chrome |
|---|---|---|
| cover | width < 420 && height < 450 | Flip cover screen: one PUSH item, two big buttons |
| compact | width < 600 | bottom tab bar (49 + home-indicator inset, translucent blur) |
| medium | 600–840 | 76px navigation rail + list / detail |
| expanded | > 840 | list + detail; 248px sidebar from 1024 (rail below — Fold unfolded is ~884), floating "Ask the assistant" |

Two viewport segments side by side (vertical hinge) put one pane on each side
of the fold; stacked segments (tabletop) put reading on top and the rest below.
The selected item lives in the route (`/mail/:id`), so rotation, folding and
window resizes re-lay out without losing it. Without the Viewport Segments API
the app is simply "flat". Android back: close sheet → close detail → previous
tab → background the app.

### Auth (`src/auth/`)

- **Google / Apple**: system browser (`@capacitor/browser`) → the server's
  desktop flow (`/api/auth/desktop-nonce` with a PKCE challenge →
  `/api/auth/{google,apple}/login?source=desktop&appScheme=ai.klorn.app`) → the
  relay deep link `ai.klorn.app://oauth-callback?code=…` →
  `POST /api/auth/exchange-code`. No native Sign in with Apple plugin is needed;
  the Apple button shows only when `GET /api/auth/providers` lists it. In a
  browser (dev) the PKCE poll (`/api/auth/desktop-token/:nonce`) is used.
- **Email/password**: `POST /api/auth/login`.
- The JWT is stored with `@aparajita/capacitor-secure-storage` (Keychain /
  Keystore, not iCloud-synced) — never localStorage on native. A 401 on a data
  call signs out and Welcome says the session ended.

### Endpoints used

| Route | Server file | Used for |
|---|---|---|
| `GET /api/auth/providers` · `POST /login` · `GET /me` · `POST /logout` | routes/auth.ts | Welcome, session |
| `GET /api/auth/desktop-nonce` · `GET /desktop-token/:nonce` · `POST /exchange-code` | routes/auth.ts | Google / Apple sign-in |
| `GET /api/auth/{google,apple}/login` | routes/auth.ts, routes/social-auth.ts | system-browser leg |
| `GET /api/inbox/firewall` | routes/firewall.ts | "Needs you now" (PUSH/MEETING items + reasons), replies owed, cover screen |
| `GET /api/email/lane-counts` | routes/email-lanes.ts | lane strip (falls back to the firewall summary while MAIL_V2 / UNIFIED_HOME are off) |
| `GET /api/calendar?start&end` | routes/calendar.ts | next event, meeting count |
| `GET /api/chat/pending-actions` | routes/chat-pending-actions.ts | Approvals |
| `GET /api/email/inboxes` | routes/email.ts | connected accounts (sidebar, Accounts) |
| `GET /api/email?tier&page&inbox&search` · `GET /api/email/:id` | routes/email.ts | Mail scaffold |
| `GET /api/briefing/status` | routes/briefing | typed, not rendered yet |
| `POST /api/inbox/firewall/:id/dismiss` · `/:id/snooze` · `/email/:emailId` · `/:id/undo` | routes/firewall.ts | typed for Mail's swipe rows / lane sheet (next) |
| `POST` / `DELETE /api/email/:id/pin-tier` | routes/email.ts | "keep this sender here" (next) |

## PROBE mode (diagnostics only)

`KLORN_PROBE=1 npx cap sync` packages the self-contained Samsung-calendar probe
(`probe/index.html`, its own web dir) instead of the app. Store builds must not
set it.

## Native configuration

- **iOS**: `TARGETED_DEVICE_FAMILY = "1,2"`, all orientations on iPad, no
  `UIRequiresFullScreen` (Split View / Slide Over / Stage Manager); the stale
  `armv7` `UIRequiredDeviceCapabilities` is removed. Dynamic Type is adopted
  through `-apple-system-body` (text sizes are rem-based). `cap sync` rewrites
  `ios/App/CapApp-SPM/Package.swift` (`speech-recognition` has no
  Package.swift — pre-existing).
- **Android**: `resizeableActivity`, no orientation lock, configChanges cover
  screen size / layout / smallest width (fold, unfold, multi-window),
  `adjustResize` for the keyboard, `READ_CALENDAR` removed (no feature uses it).
  Capacitor 8 SystemBars injects `--safe-area-inset-*` for edge-to-edge.

### Verify on device / CI (cannot run in a container without the Android SDK / Xcode)

- Android `./gradlew assembleDebug` and an iOS archive build with the new
  plugins (secure-storage, haptics, keyboard, preferences, share, splash-screen).
- Google sign-in round trip on both platforms (relay deep link arrives, the
  browser closes, Today loads); Apple once `APPLE_LOGIN_ENABLED` is on.
- Keychain / Keystore persistence across relaunch; sign-out wipes token + cache.
- Airplane-mode cold start shows the cached Today with the offline banner.
- Android back: sheet → detail → previous tab → background.
- Galaxy Z Fold (flat / half-folded / rotated), Z Flip cover screen, Samsung
  pop-up window, iPad Split View + Stage Manager, Dynamic Type at 200%.
- Safe areas on notch / Dynamic Island / gesture-nav devices.

## Native setup (unchanged from the WebView shell)

### Prerequisites (one-time, for building/iterating)

> **JDK 21 required** — Capacitor 8's Android libraries compile to Java 21.
> Building with JDK 17 fails (`invalid source release: 21`). Android Studio's
> bundled JDK is fine; for CLI builds: `brew install openjdk@21` and set
> `JAVA_HOME` to it.

```bash
# 1. Android Studio (installs the Android SDK + platform-tools through its wizard)
brew install --cask android-studio
#    Launch it once → "Standard" setup → let it download the SDK.

# 2. Put adb on PATH
echo '\nexport ANDROID_HOME="$HOME/Library/Android/sdk"\nexport PATH="$ANDROID_HOME/platform-tools:$PATH"' >> ~/.zshrc
source ~/.zshrc && adb version
```

**Galaxy device:** Settings → About phone → Software info → tap **Build number 7×**
(enables Developer options) → Settings → Developer options → **USB debugging ON**
→ connect by USB → approve the prompt → verify with `adb devices`.

---

### Enable native push (FCM) — once the app registers for push again

1. Firebase console → add an **Android app** with package name **`ai.klorn.app`**.
2. Download **`google-services.json`** → `apps/mobile/android/app/` (gitignored).
3. Firebase → Project settings → Service accounts → generate a key; set it on the
   API (Render) as `FIREBASE_SERVICE_ACCOUNT` (the full JSON as one string).
4. `npx cap sync android` and rebuild.
5. In the app, sign in, then `POST /api/notifications/push/device-test` rings the phone.

For iOS later: also upload an APNs auth key (.p8) to Firebase + `npx cap add ios`.

---

### iOS push (implemented — provide an APNs key to activate)

`@capacitor/push-notifications` returns an **APNs token** on iOS (not an FCM
token), so iOS delivery goes **straight to APNs** (`packages/api/src/push-apns.ts`,
HTTP/2 + an ES256 provider JWT) rather than through FCM. This was the chosen path
(over unified `@capacitor-firebase/messaging`) because it keeps the Android probe
Firebase-free and the web bundle lean. Both channels run after the same gates in
`sendPushNotification` — FCM for Android, APNs for iOS.

To activate iOS push, create an **APNs auth key (.p8)** in the Apple Developer
portal and set on the API (Render):

```
APNS_KEY_P8=<.p8 contents>   APNS_KEY_ID=<10-char key id>   APNS_TEAM_ID=<team id>
APNS_BUNDLE_ID=ai.klorn.app  APNS_PRODUCTION=false   # true for TestFlight/App Store
```

Absent → iOS push is skipped (logged), like missing VAPID/FCM. An iOS device
token registers harmlessly either way. Use `APNS_PRODUCTION=false` for Xcode
debug builds (they get sandbox APNs tokens); `true` for TestFlight/App Store.

