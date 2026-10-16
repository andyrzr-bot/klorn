# Submission checklist — founder run-book (iOS + Android)

Revised 2026-10-16 for the bundled app and the CI release flow. This file is
the **order of operations**; `apps/mobile/STORE_SUBMISSION.md` is the status
and the why; `docs/launch/mobile-store-setup.md` has the console click-paths
and secret names. Do the phases in order; inside a phase the boxes can run in
parallel.

How builds reach the stores now: push a tag `mobile-v<x.y.z>` →
`.github/workflows/mobile-release.yml` builds the bundled app
(`npm run build` → `cap sync`), signs it, and uploads iOS to **TestFlight**
and Android to the Play **internal** track. Each platform job skips with a
notice while its secrets are missing. Every PR touching `apps/mobile/**` runs
`.github/workflows/mobile.yml` (typecheck, tests, build, Playwright
screenshots → artifact `mobile-screenshots`, Android debug APK, iOS simulator
build). There is no Xcode archive / Organizer upload step any more.

---

## Phase 0 — Accounts (start now; some take days)

- [ ] Apple Developer Program (individual or organization) active; App Store
      Connect → **Agreements, Tax, and Banking**: the **Paid Apps** agreement
      signed and banking + tax filled in (needed before any subscription can
      be sold or even tested outside sandbox).
- [ ] Google Play developer account. A **personal** account created after
      Nov 2023 must run a **closed test with at least 12 opted-in testers for
      14 days** before it can apply for production (Google's current rule —
      check Play Console's dashboard for the exact numbers); an organization
      account is exempt. Start that clock as soon as the first build is on a
      testing track. Payments profile / merchant account for subscriptions.
- [ ] RevenueCat account and project (iOS + Android apps, bundle / package
      `ai.klorn.app`).

## Phase 1 — Code items still open (one PR, before the first store build)

Each is small; none can be done from the store consoles.

- [ ] **Push entitlement (iOS)**: the project has no `.entitlements` file and
      no `CODE_SIGN_ENTITLEMENTS`, so CI-signed builds carry no
      `aps-environment` and APNs registration fails. In Xcode → App target →
      Signing & Capabilities → **+ Push Notifications** (Background Modes →
      Remote notifications is already in `Info.plist`) → commit
      `App/App.entitlements` and the `project.pbxproj` change.
- [ ] **Privacy manifest in the target**: add `App/PrivacyInfo.xcprivacy` to
      the App target and apply the data-type additions listed in
      `privacy-labels.md` §2. Commit.
- [ ] **IAP keys in the release build**: `mobile-release.yml` runs
      `npm run build` with no `VITE_REVENUECAT_IOS_KEY` /
      `VITE_REVENUECAT_ANDROID_KEY`, so release builds have IAP switched off.
      Add them as `env:` on both "Build the app and sync" steps (from GitHub
      secrets or variables — they are public SDK keys, a variable is fine).
- [ ] **Plans screen disclosures (3.1.2)**: show the subscription length, an
      auto-renew sentence and links to Terms of Use and Privacy Policy next to
      "Subscribe" (`src/screens/settings/PlansScreen.tsx`).
- [ ] **Welcome copy**: `welcome.body` and the illustration chips name
      Outlook / work mail "with one sign-in"; Outlook is dark in production.
      Align with the landing (Gmail, Google Calendar, Naver Mail and iCloud
      Mail in beta).
- [ ] **Store fixtures**: remove the Outlook account and real brand names from
      the screenshot fixtures (`src/api/mock/`), or plan frames without them
      (`screenshots-plan.md`, "Check before you upload").
- [ ] **Unused calendar plugin**: `@ebarooni/capacitor-calendar` is still a
      dependency (only `probe/` uses it), so it is linked into both binaries
      (`ios/App/CapApp-SPM/Package.swift`, `android/capacitor.settings.gradle`).
      On iOS that links EventKit while `Info.plist` has no calendar usage
      string — App Store Connect can reject the upload with ITMS-90683
      ("Missing purpose string"). Remove the plugin from store builds (keep
      the probe on a branch) rather than adding a calendar string for a
      feature that does not exist (5.1.1).
- [ ] Optional privacy hardening: `clearHidden()` on sign-out; Android
      `allowBackup` (`privacy-labels.md` §5). The privacy-policy additions in
      `privacy-labels.md` §4 are a web PR.

## Phase 2 — Signing, secrets and server env (≈1 h; `docs/launch/mobile-store-setup.md`)

iOS:

- [ ] App ID `ai.klorn.app` with Push Notifications (+ Sign in with Apple on
      the Services ID used by the web flow) and the App Store Connect app
      record (setup §1).
- [ ] App Store Connect API key → GitHub secrets `APPLE_TEAM_ID`,
      `ASC_KEY_ID`, `ASC_ISSUER_ID`, `ASC_KEY_P8_BASE64` (setup §2).
- [ ] APNs key → Render `APNS_KEY_P8`, `APNS_KEY_ID`, `APNS_TEAM_ID`,
      `APNS_BUNDLE_ID=ai.klorn.app`, `APNS_PRODUCTION=true` (TestFlight and
      the App Store use production APNs) (setup §3).
- [ ] **Sign in with Apple in production** (needed for Guideline 4.8 because
      Google sign-in is offered): Render `APPLE_CLIENT_ID`, `APPLE_TEAM_ID`,
      `APPLE_KEY_ID`, `APPLE_PRIVATE_KEY`, `APPLE_REDIRECT_URI`, then
      `APPLE_LOGIN_ENABLED=true`. The app shows the Apple button by itself
      once `GET /api/auth/providers` lists it.

Android:

- [ ] Upload keystore → `ANDROID_KEYSTORE_BASE64`,
      `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`,
      `ANDROID_KEY_PASSWORD` (setup §2).
- [ ] Firebase Android app `ai.klorn.app` → `ANDROID_GOOGLE_SERVICES_JSON_BASE64`;
      Render `FIREBASE_SERVICE_ACCOUNT` (setup §5). Without it the build works
      but Android has no push.
- [ ] Play service account → `PLAY_SERVICE_ACCOUNT_JSON` (setup §3).

Purchases (both):

- [ ] App Store Connect: an auto-renewable subscription group with the Pro
      product(s); Play Console: the matching subscription + base plan.
- [ ] RevenueCat: import both products, one entitlement, a **current
      offering** whose first package is what "Subscribe" buys
      (`src/platform/iap.ts` takes `offerings.current.availablePackages[0]`).
- [ ] RevenueCat webhook → `https://klorn-api.onrender.com/api/webhook/revenuecat`
      with an Authorization value; the same value as Render
      `REVENUECAT_WEBHOOK_AUTH`.
- [ ] RevenueCat public SDK keys → the variables used in Phase 1's workflow
      change.

## Phase 3 — First release build (≈30 min + processing)

- [ ] `git tag mobile-v1.0.0 && git push origin mobile-v1.0.0`.
- [ ] iOS: the run uploads to TestFlight; wait for "processing completed".
      `ITSAppUsesNonExemptEncryption=false` answers export compliance.
- [ ] Android: download the `klorn-android-release` artifact and upload the
      `.aab` **once by hand** (Play Console → Testing → Internal testing →
      Create release) — Google's rule for a new app. Later tags upload
      themselves. Then: Play Console → Setup → App integrity → copy the **app
      signing** key SHA-256 into `website/.well-known/assetlinks.json` (it
      holds one fingerprint today; add the Play one) so verified App Links
      work for the release build.

## Phase 4 — Device pass (≈1 h; the only end-to-end test of a signed build)

On a real iPhone (TestFlight) and a real Android phone (internal track),
ideally also an iPad and a Galaxy Fold / Flip:

- [ ] Sign in with Google, Apple and email; relaunch (Keychain / Keystore
      session survives); sign out (cache and token gone).
- [ ] Push: priming → OS prompt → send yourself a PUSH-lane mail → a visible
      notification with the app closed → tap opens that message. Foreground
      banner while the app is open.
- [ ] Mail: swipe right (Done, undo), swipe left (lane sheet), long-press
      select; open a mail, links open in the system browser, an attachment
      opens in the share sheet; Edit draft → Review & send → receipt.
- [ ] Airplane mode cold start: cached Today with the offline banner.
- [ ] Plans: sandbox purchase → plan becomes Pro within a minute → Restore →
      Manage opens the store page.
- [ ] Settings › Delete account on a throwaway account: account gone, app back
      at Welcome.
- [ ] Android back: sheet → detail → previous tab → background. Fold flat /
      half-folded / rotated, Flip cover, iPad Split View and Stage Manager,
      Dynamic Type large sizes.
- [ ] If anything fails: fix → new tag (`mobile-v1.0.1`) → repeat.

The full list lives in `apps/mobile/README.md` → "Verify on device / CI".

## Phase 5 — Listings (≈2 h; can start any time after Phase 0)

- [ ] Demo account per `review-notes.md` §1 (demo Gmail seeded and linked).
- [ ] Screenshots: `npx playwright test --config store-pack/capture/playwright.store.config.ts`
      (`screenshots-plan.md`); Play feature graphic 1024×500 and 512×512 icon.
- [ ] App Store Connect: name, subtitle, promo text, description, keywords,
      URLs, category, age rating from `metadata.md` (EN + KO); App Privacy from
      `privacy-labels.md` §2; App Review Information from `review-notes.md` §2;
      price **Free**; the subscription's own metadata, review screenshot and
      localized names; attach the subscription to version 1.0.
- [ ] Play Console: store listing from `metadata.md` (EN + KO); App content —
      privacy policy `https://klorn.ai/privacy/`, App access
      (`review-notes.md` §3), Ads: none, Content rating, Target audience 18+,
      Data safety (`privacy-labels.md` §3); countries; free app with
      subscriptions.
- [ ] Privacy policy updated per `privacy-labels.md` §4 before submitting the
      Data safety form.

## Phase 6 — Submit

- [ ] App Store: version 1.0 → the tested build → **Manually release** after
      approval (recommended) → **Add for Review** → **Submit**. Keep the
      contact phone reachable.
- [ ] Play: promote the tested release from internal → closed (12 testers ×
      14 days, if your account needs it) → production → **Send for review**.
- [ ] Open the demo account the day you submit.

## Phase 7 — After the verdict

- **Approved** → release → install from the store and repeat the Phase 4
  smoke test → rotate the demo password.
- **Rejected** → read the message; likely ones and the prepared answers:
  - **4.8** → Sign in with Apple not visible: `APPLE_LOGIN_ENABLED` off.
  - **3.1.2** → missing subscription disclosures on Plans (Phase 1).
  - **2.1** → demo account empty or Gmail link expired: refresh, reply in
    Resolution Center (no new build needed).
  - **4.2** → reply with the "Native functionality" block of
    `review-notes.md` §2 and the demo video.
  - **5.1.1(v)** → point to Settings › Delete account (path in the notes).
