/**
 * Native push payloads (FCM data / APNs JSON) as the bundled mobile app reads
 * them. Built by packages/api notify/push-device.ts (buildFcmMessage) and
 * notify/push-apns.ts (buildApnsBody).
 *
 * Every push carries what it always did: FCM `data` = { url?, notificationId?,
 * category }, APNs = { aps: { alert: { title, body }, sound }, url?,
 * notificationId?, category } (`category` is the Klorn notification category).
 * A MAIL-driven push (firewall PUSH / MEETING, or an urgent sweep about one
 * mail) also carries the fields below; a push without them is not about one
 * email. All values are opaque ids and an in-app route.
 */
export interface NativePushMailFields {
  /** The Klorn EmailMessage id (the reader / by-email Done and Later key). */
  emailId: string;
  /** The open firewall attention item, when one exists. */
  attentionItemId?: string;
  /** A reply draft / approval, when one exists at send time (none today). */
  pendingActionId?: string;
  /** In-app route: `/mail/<emailId>` (URI-encoded). */
  route: string;
}

/** APNs `aps.category` of a mail push: lock-screen action sets the app registers. */
export type ApnsMailCategory = "KLORN_PUSH_MAIL" | "KLORN_PUSH_MAIL_DRAFT";
