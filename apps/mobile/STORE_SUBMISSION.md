# Klorn — App Store + Google Play submission status

Status of getting the bundled app (`ai.klorn.app`) onto both stores, as of
2026-10-16. Three kinds of item: **[CODE — done]** (in the repo),
**[CODE — open]** (a repo change still needed) and **[YOU]** (accounts,
consoles, secrets — only the founder can do them).

Where things are:

| Need | File |
|---|---|
| Step-by-step order to "Waiting for Review" | `store-pack/submission-checklist.md` |
| Console click-paths and the exact GitHub / Render secret names | `docs/launch/mobile-store-setup.md` |
| Listing text, EN + KO, with character counts | `store-pack/metadata.md` |
| App Privacy + Data safety answers, privacy-manifest edit | `store-pack/privacy-labels.md` |
| App Review notes, Play app-access text, demo account | `store-pack/review-notes.md` |
| Screenshot sizes, captions, the capture command | `store-pack/screenshots-plan.md`, `store-pack/capture/` |
| What the app does, its endpoints, the device checks | `README.md` |

---

## What changed: the bundled app

The app is a React + TypeScript SPA built into the binary (`src/` →
`dist/`), talking to the API directly. It no longer loads `app.klorn.ai` in a
WebView (`capacitor.config.ts` has no `server.url`), so the old notes about
"the shell shows whatever web is deployed", `allowNavigation`, the bundled
offline error page and `NEXT_PUBLIC_*` build variables no longer apply. Web
deploys do not change the mobile app; only a new `mobile-v*` build does.

## Release flow

- **Every PR / push to `main` touching `apps/mobile/**`** →
  `.github/workflows/mobile.yml`: typecheck, vitest, build, Playwright
  screenshots (artifact **`mobile-screenshots`**), Android debug APK
  (`klorn-android-debug`), iOS simulator build. No secrets.
- **Tag `mobile-v<x.y.z>`** (or run it by hand) →
  `.github/workflows/mobile-release.yml`: version from the tag, build number
  from the run number; signed `.aab` → Play **internal** track (artifact
  `klorn-android-release`), archive → **TestFlight**. Each job skips with a
  notice until its secrets exist. Google requires the very first `.aab` to be
  uploaded by hand.
- Promotion to review / production is done in the consoles.

---

## [CODE — done]

Verified in `apps/mobile/src` on 2026-10-16:

| Store requirement | Where |
|---|---|
| Native push: priming screen before the OS prompt, token registration (`POST /api/notifications/push/device-token/register`), removal on sign-out and account deletion, foreground banner, tap → route; iOS action categories | `src/platform/push.ts`, `src/push/`, `AppDelegate.swift` |
| In-app purchase (3.1.1): RevenueCat purchase / restore / manage; no web checkout or external purchase link anywhere | `src/platform/iap.ts`, `src/screens/settings/PlansScreen.tsx` |
| Account deletion (5.1.1(v)): Settings › Delete account, typed address, `DELETE /api/auth/account`, then wipe and sign-out | `src/screens/settings/DeleteAccountScreen.tsx` |
| Sign in with Apple / Google (system browser + `ai.klorn.app://oauth-callback` relay) and email; session in Keychain / Keystore | `src/auth/`, `src/screens/login/WelcomeScreen.tsx` |
| Offline: 24 h persisted cache, offline banner, wiped on sign-out | `src/api/query-client.ts`, `src/auth/session.tsx` |
| Phones, foldables (Fold book / tabletop, Flip cover), tablets (iPad all orientations, Split View, Stage Manager); Dynamic Type | `src/layout/`, `README.md` "Native configuration" |
| Privacy / terms links in Welcome and Settings (`https://klorn.ai/privacy/`, `/terms/`) | `WelcomeScreen.tsx`, `src/screens/settings/parts.tsx` |
| Export compliance in-binary (`ITSAppUsesNonExemptEncryption=false`); remote-notification background mode | `ios/App/App/Info.plist` |
| Android: `resizeableActivity`, no orientation lock, minimal permissions (INTERNET, POST_NOTIFICATIONS, RECORD_AUDIO for dictation), target SDK 36 | `android/` |
| CI build + signed release + store upload | `.github/workflows/mobile.yml`, `mobile-release.yml` |
| Probe kept out of store builds (`KLORN_PROBE=1` only) | `capacitor.config.ts` |

Resolved since the WebView-era list: native push in the app itself, IAP and
account deletion inside the bundled app, settings, the "thin wrapper" profile
(4.2) and the WebView offline page. **Google OAuth verification for the Gmail
scopes is complete** (CASA Tier 2, 2026-10-03 per the landing), so it no longer
gates the stores.

## [CODE — open] (details and exact steps: `store-pack/submission-checklist.md` Phase 1)

1. **iOS push entitlement** — no `.entitlements` / `aps-environment` in the
   project; add the Push Notifications capability in Xcode and commit.
2. **`PrivacyInfo.xcprivacy`** — not in the App target, and missing Emails,
   User ID, Device ID, Product Interaction (+ Purchase History when IAP
   ships). Exact XML in `store-pack/privacy-labels.md` §2.
3. **IAP keys in `mobile-release.yml`** — the release build does not receive
   `VITE_REVENUECAT_IOS_KEY` / `_ANDROID_KEY`, so IAP is off in store builds.
4. **Plans screen (3.1.2)** — add subscription length, auto-renew text, Terms
   and Privacy links.
5. **Welcome copy** — names Outlook, which production cannot connect.
6. **Unused `@ebarooni/capacitor-calendar`** — linked into the iOS binary
   without a calendar usage string (ITMS-90683 risk); remove from store builds.
7. **Screenshot fixtures** — Outlook account and real brand names in frame.
8. Privacy hardening (optional): clear the Done / Later list on sign-out;
   Android `allowBackup`.
9. Android App Links: add the Play **app signing** SHA-256 to
   `website/.well-known/assetlinks.json` after the first Play upload.

Not blockers, tracked in `README.md` → "Gaps": lock-screen push actions need
ids in the server payload; Android notifications have no action buttons yet;
voice input is hidden on iOS (speech plugin not linked under SPM).

## [YOU] (order and click-paths: `submission-checklist.md` Phases 0, 2, 5–6 and `docs/launch/mobile-store-setup.md`)

1. Apple Developer Program + Paid Apps agreement, banking, tax. Google Play
   developer account (personal accounts: closed test with 12 testers for 14
   days before production — confirm the current numbers in the console).
2. App Store Connect API key and Play upload keystore + service account →
   GitHub secrets.
3. APNs key and Firebase → Render env (`APNS_*`, `FIREBASE_SERVICE_ACCOUNT`)
   and `ANDROID_GOOGLE_SERVICES_JSON_BASE64`.
4. **Sign in with Apple in production** (`APPLE_*` env, then
   `APPLE_LOGIN_ENABLED=true`) — needed for Guideline 4.8 because Google
   sign-in is offered.
5. Subscription products in both consoles, RevenueCat offering, webhook +
   `REVENUECAT_WEBHOOK_AUTH`.
6. Tag `mobile-v1.0.0`; upload the first `.aab` by hand; run the device pass.
7. Demo account, screenshots, listings, privacy answers, privacy-policy
   additions (`privacy-labels.md` §4).
8. Submit.

## Build commands (local)

```bash
cd apps/mobile
npm ci
npm run build && npx cap sync   # = npm run sync
npm run open:ios                # Xcode (signing, capabilities)
npm run open:android            # Android Studio
# store screenshots
npx playwright test --config store-pack/capture/playwright.store.config.ts
# diagnostics only, never for the store:
npm run sync:probe              # KLORN_PROBE=1 — Samsung calendar probe
```
