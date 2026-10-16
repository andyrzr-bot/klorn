/**
 * English — the source of truth for message keys. Every other locale is typed
 * `Messages` (Record<MessageKey, string>), so a missing key fails typecheck;
 * the parity test (src/i18n/i18n.test.ts) also pins placeholders.
 *
 * Vocabulary (docs/product-vocabulary.md): the five lanes are PUSH / MEETING /
 * QUEUE / INFO / SILENT and are never translated; "inbox" means a connected
 * mail account, never a screen; the approval surface is "Approvals" under
 * "Assistant". Plural forms use `.one` / `.other` (Intl.PluralRules).
 */
export const en = {
  "app.name": "Klorn",

  "tab.today": "Today",
  "tab.mail": "Mail",
  "tab.calendar": "Calendar",
  "tab.files": "Files",
  "tab.assistant": "Assistant",

  "nav.primary": "Main menu",
  "nav.lanes": "Lanes",
  "nav.accounts": "Accounts",
  "nav.approvalsBadge": "{count} to approve",
  "nav.assistantFab": "Ask the assistant",
  "nav.accountButton": "Accounts and settings",

  "today.title": "Today",
  "today.replies.one": "{count} email needs a reply",
  "today.replies.other": "{count} emails need a reply",
  "today.meetings.one": "{count} meeting",
  "today.meetings.other": "{count} meetings",
  "today.summary.both": "{replies}, and you have {meetings} today.",
  "today.summary.repliesOnly": "{replies}.",
  "today.summary.meetingsOnly": "You have {meetings} today.",
  "today.summary.none": "Nothing needs you right now.",
  "today.brief.title": "Needs you now",
  "today.brief.emptyTitle": "PUSH is clear",
  "today.brief.emptyBody":
    "Nothing worth interrupting you for. We'll tell you the moment something arrives.",
  "today.brief.emptyCta": "See QUEUE ({count})",
  "today.lanes.label": "Mail by lane",
  "today.lanes.count.one": "{lane}: {count} email",
  "today.lanes.count.other": "{lane}: {count} emails",
  "today.next.label": "Next on your calendar",
  "today.next.now": "Now",
  "today.next.join": "Join",
  "today.next.open": "View",
  "today.next.allDay": "All day",
  "today.next.empty": "Nothing else on your calendar today.",
  "today.approvals.title": "Waiting for approval",
  "today.approvals.seeAll": "See all",
  "today.approvals.review": "Review",
  "today.approvals.reviewItem": "Review: {title}",
  "today.approvals.empty": "Nothing to approve right now.",

  "approval.kind.email": "Reply draft",
  "approval.kind.emailTo": "Reply draft to {name}",
  "approval.kind.calendar": "Calendar change",
  "approval.kind.other": "Requested action",

  "calendar.primary": "Primary calendar",

  "state.offline.banner": "You're offline. Showing saved mail; syncing as soon as you're back.",
  "state.offline.title": "You're offline",
  "state.offline.body": "Klorn will sync as soon as you're connected again.",
  "state.error.title": "Couldn't load this",
  "state.error.body": "Something went wrong on our side. Try again in a moment.",
  "state.retry": "Try again",
  "state.loading": "Loading",
  "state.pull": "Pull to refresh",
  "state.release": "Release to refresh",
  "state.refreshing": "Refreshing",
  "state.noAccounts.title": "Connect a mail account",
  "state.noAccounts.body":
    "Klorn sorts mail from the accounts you connect. Add one on the web at app.klorn.ai for now.",

  "placeholder.body": "This screen is on its way.",
  "mail.selectPrompt": "Pick an email to read it here.",

  "accounts.title": "Accounts & sources",
  "accounts.signedInAs": "Signed in as {email}",
  "accounts.connected": "Connected inboxes",
  "accounts.needsReconnect": "Needs reconnecting",
  "accounts.language": "App language",
  "accounts.theme": "Appearance",
  "accounts.theme.system": "Match device",
  "accounts.theme.light": "Light",
  "accounts.theme.dark": "Dark",
  "accounts.signOut": "Sign out",

  "welcome.headline.before": "Your mail, calendars and files,",
  "welcome.headline.em": "in one place",
  "welcome.headline.after": "— calmly.",
  "welcome.body":
    "Gmail, work mail, Outlook, Naver and iCloud with one sign-in. Only what matters gets through, and we show you why.",
  "welcome.card.label": "Today · in one place",
  "welcome.card.line": "We only flag the 2 emails that need a reply",
  "welcome.apple": "Continue with Apple",
  "welcome.google": "Continue with Google",
  "welcome.email": "Continue with email",
  "welcome.legal": "By continuing you agree to the {terms} and the {privacy}.",
  "welcome.terms": "Terms of Service",
  "welcome.privacy": "Privacy Policy",
  "welcome.language": "Language: {name}",

  "login.title": "Sign in with email",
  "login.email": "Email",
  "login.password": "Password",
  "login.submit": "Sign in",
  "login.back": "Back",
  "login.forgot": "Forgot your password?",
  "login.waiting": "Finish signing in in your browser…",
  "login.cancel": "Cancel",
  "login.error.invalid": "That email and password don't match.",
  "login.error.rateLimited": "Too many attempts. Try again in a few minutes.",
  "login.error.network": "Can't reach Klorn. Check your connection.",
  "login.error.timeout": "Sign-in timed out. Try again.",
  "login.error.generic": "Sign-in didn't work. Try again.",
  "session.expired": "Your session ended. Please sign in again.",

  "cover.review": "Review",
  "cover.later": "Later",
  "cover.hint": "Unfold to pick up the full email",
} as const satisfies Record<string, string>;

export type MessageKey = keyof typeof en;
export type Messages = Record<MessageKey, string>;
