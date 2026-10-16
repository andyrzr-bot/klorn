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

> **Status (2026-10-16).** Shell at every size class, auth, data layer,
> offline cache, i18n, Today, Calendar, Assistant (chat / Approvals /
> Activity), Files, Accounts & sources, Settings, push (priming, registration,
> tap routing, iOS action categories), in-app purchase (RevenueCat) and
> self-service account deletion are built. Store builds still need the
> device / CI checks listed below (see `STORE_SUBMISSION.md`).

## Commands

```bash
cd apps/mobile
npm ci
npm run dev          # Vite dev server against http://localhost:3001 (local API)
npm run dev:mock     # Vite dev server against the in-app mock API (fixtures)
npm run typecheck
npm test             # vitest: router, size classes, API client, i18n parity, screen models, push routing
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
  screens/                     today, cover (Flip), login (Welcome), mail, calendar,
                               assistant, files, accounts, settings (+ plans, delete)
  push/                        priming screen, foreground banner, tap/action routing
  api/queries-hub.ts           hooks for calendar/assistant/files/accounts/settings
  api/mock/*-hub.ts            fixtures + stateful mock routes for those screens
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
| `GET /api/calendar?start&end` · `GET /:id` · `POST /` · `POST /parse-event` | routes/calendar.ts | week agenda, event detail; **the only calendar write** (after the confirm card); "Describe it" prefill |
| `GET /api/teams` · `GET /:id/availability` | routes/teams.ts | "Team free time" (403 TEAM_REQUIRED → hidden) |
| `GET` / `POST /api/chat/conversations` · `GET` / `POST /:id/messages` | routes/chat-conversations.ts | chat (resumes the latest thread; `context.emailId`; `eventDraft` → confirm card) |
| `POST /api/chat/pending-actions/:id/approve` · `/reject` · `/snooze` | routes/chat-pending-actions.ts | Approvals (a send mints its ActionReceipt server-side) |
| `GET /api/inbox/receipt/today` · `GET /api/briefing/status` | routes/receipt.ts, routes/briefing | Activity |
| `GET /api/drive/files` · `/files/:id` · `POST /files/:id/summarize` · `GET /files/:id/download` · `GET /limits` · `POST /files` | routes/drive.ts, klorn-drive.ts | Files (404 while the drive flags are off → source hidden) |
| `GET /api/drive/google/accounts` · `POST /link` · `DELETE /accounts/:id` | routes/google-drive-link.ts | Google Drive source and account rows |
| `GET /api/email?filter=attachments` · `GET /api/email/:id` | routes/email.ts | the "Mail attachments" source |
| `POST /api/auth/google/{start,link-inbox,link-calendar}` · `POST /api/auth/outlook/link-inbox` (`?appScheme=ai.klorn.app`) · `POST /api/auth/link/complete` | routes/auth.ts, outlook-auth.ts, link-complete.ts | add Gmail / Outlook / calendar / Drive in the system browser, finished by the `link-complete` deep link |
| `GET /api/{naver,icloud,generic}-imap/status` · `POST /connect` · `POST /disconnect` | routes/imap-connect.ts | Naver / iCloud / other IMAP (beta; 404 → hidden) |
| `DELETE /api/auth/google` · `/google/linked-inboxes/:id` · `/outlook/linked-inboxes/:id` · `…/linked-calendars[/:id]` | routes/auth.ts, outlook-*.ts, caldav-calendar.ts | disconnect (behind a confirmation) |
| `GET` / `PATCH /api/automations` | routes/automations.ts | notification toggles, quiet hours, notification language |
| `DELETE /api/auth/account` | routes/auth.ts | account deletion (typed address; App Store 5.1.1(v)) |
| `POST /api/notifications/push/device-token/register` · `DELETE /push/device-token` | routes/notifications.ts | push token (FCM Android / APNs iOS); removed on sign-out |
| `GET /api/billing/status` | routes/billing.ts | Plans (never a web checkout on native — App Store 3.1.1) |

### Calendar · Assistant · Files · Accounts · Settings

- **Writes need a confirmation, always.** New event and team free slots go
  form → confirm card ("which calendar, who is invited") → `POST
  /api/calendar`. Chat only ever drafts. Approvals approve/reject one card at a
  time; reject asks for an optional reason in a sheet. Disconnect and account
  deletion are two-step. "Send draft" from a notification opens the approval
  card — it never sends.
- **Flag-gated sources hide on 404** (drive, Google Drive, Outlook, iCloud,
  generic IMAP, CalDAV) and team mode on 403; the mock's `?scenario=featuresOff`
  reproduces production's default flags.
- Calendar: week strip (swipe; arrows on wide layouts and for screen readers),
  legend per connected calendar (colour = the account's SourceBadge colour),
  current-time line, past events dimmed, overlap chip → the assistant with a
  pre-filled (not sent) question (`screens/assistant/handoff.ts`).
- Assistant: the expanded layout's floating button opens the same thread in a
  side sheet; on a vertical hinge chat and Activity sit one per segment.
  Voice input uses `@capacitor-community/speech-recognition` (hidden where the
  plugin is not linked, e.g. iOS SPM) or the Web Speech API.
- Files: one list across Klorn Drive / Google Drive / mail attachments, search
  by name and content (drive: server `q`, which matches summaries while D4 is
  on; attachments: client-side), open = system browser (Google page, Klorn
  signed download link) or the mail. Upload: `<input type=file>` → Klorn Drive.
- Accounts: Outlook, Naver and iCloud are marked beta; the device calendar row
  explains it is coming and asks for no permission.

### Push payload (what the server should send)

Today the device payload carries only `url` (a web path) and a top-level
`category`; the app maps `/email/:id`, `/inbox/firewall`, `/briefing`,
`/chat`, `/inbox` to its routes (`src/push/route.ts`). For the full design:

```jsonc
{
  "aps": { "alert": { "title": "…", "body": "…" }, "category": "KLORN_PUSH_DRAFT" }, // or KLORN_PUSH
  "route": "/mail/<emailId>",          // an app path; wins over everything else
  "emailId": "<EmailMessage.id>",
  "attentionItemId": "<AttentionItem.id>", // needed by "In 1 hour" / "Done"
  "pendingActionId": "<PendingAction.id>"  // needed by "Send draft" (opens the approval)
}
```

iOS registers `KLORN_PUSH_DRAFT` (Send draft · In 1 hour · Done) and
`KLORN_PUSH` (In 1 hour · Done) in `AppDelegate.swift`; "Send draft" is
`.authenticationRequired + .foreground`. Android FCM *notification* messages
cannot carry action buttons through `@capacitor/push-notifications`; they need
data-only messages displayed by `@capacitor/local-notifications` with actions
(not installed) — until then an Android tap opens the route.

### Server gaps found while building these screens

- No attachment index: Files reads `GET /api/email?filter=attachments` and then
  `GET /api/email/:id` for the newest 8 mails.
- `GET /api/drive/files` has no summaries; the first 10 rows read
  `GET /api/drive/files/:id` each (rate limit 60/min).
- Chat returns one `eventDraft`, not structured slots, so the artboard's slot
  picker appears in Calendar's "Team free time" (from `/api/teams/:id/availability`)
  rather than in the thread.
- The device push payload lacks `emailId` / `attentionItemId` /
  `pendingActionId` / `aps.category` (above), so lock-screen actions only work
  once the server sends them.
- `GET /api/teams` needs a saved team; teams are created on the web only.

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
- Account links: Gmail / Outlook / Google Drive consent in the system browser
  returns through `ai.klorn.app://link-complete?h=…` (new Android intent
  filter; iOS already registers the scheme), the browser closes and the row
  appears.
- Push: priming → OS prompt → token registered (Android FCM, iOS APNs);
  foreground banner; tap routing; iOS long-press actions (Send draft asks for
  unlock and opens the approval; In 1 hour / Done run without opening the app
  — verify the WebView wakes for them, else switch them to `.foreground`).
  `AppDelegate.swift` was edited without a Swift toolchain here.
- RevenueCat purchase / restore / manage with `VITE_REVENUECAT_IOS_KEY` /
  `_ANDROID_KEY` set; plan refresh after the webhook.
- Multipart upload through CapacitorHttp (`POST /api/drive/files`, `size`
  before `file`) and the `<input type=file>` picker on both platforms.
- Keyboard: the composer rides above the keyboard, the tab bar hides.
- Speech recognition on Android; hidden on iOS while the plugin is unlinked.

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

