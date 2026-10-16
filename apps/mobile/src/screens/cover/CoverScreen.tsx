/**
 * Galaxy Z Flip cover screen (FlipCover artboard, < 420 × 450): one job only —
 * the top PUSH item and two big buttons. "Review" selects the mail in the
 * route, so unfolding continues straight into it; "Later" moves to the next
 * item locally (it changes nothing on the server).
 */
import { useState } from "react";
import { useEvents, useFirewall, useLaneCounts } from "../../api/queries";
import { formatClock } from "../../i18n/format";
import { useI18n } from "../../i18n/I18nProvider";
import { useRouter } from "../../router/Router";
import { dayRangeInZone, nextEvent } from "../today/model";
import "./cover.css";

function senderName(from: string | null | undefined): string {
  if (!from) return "";
  return from.replace(/\s*<[^>]*>\s*$/, "").replace(/^"|"$/g, "");
}

export function CoverScreen() {
  const { t, intlTag } = useI18n();
  const { navigate } = useRouter();
  const [skipped, setSkipped] = useState(0);
  const now = new Date();
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  const range = dayRangeInZone(now, zone);
  const firewall = useFirewall();
  const counts = useLaneCounts();
  const events = useEvents(range.start, range.end);

  const push = [...(firewall.data?.tiers.PUSH ?? [])].sort((a, b) => b.priority - a.priority);
  const item = push[skipped % Math.max(push.length, 1)];
  const pushCount = counts.data?.counts.PUSH.total ?? push.length;
  const next = events.data ? nextEvent(events.data, now) : null;

  return (
    <main className="cover">
      <div className="cover__top">
        <span className="cover__lane">PUSH {pushCount}</span>
        {next ? (
          <span className="cover__next">
            {formatClock(new Date(next.startTime), intlTag)} {next.title}
          </span>
        ) : null}
      </div>
      {item ? (
        <>
          <div className="cover__body">
            <span className="cover__from">{senderName(item.email?.from)}</span>
            <span className="cover__title">{item.title}</span>
            {item.tierReason ? <span className="cover__why">{item.tierReason}</span> : null}
          </div>
          <div className="cover__spacer" />
          <div className="cover__actions">
            <button
              type="button"
              className="cover__button"
              onClick={() => setSkipped((n) => n + 1)}
              disabled={push.length < 2}
            >
              {t("cover.later")}
            </button>
            <button
              type="button"
              className="cover__button cover__button--primary"
              onClick={() =>
                item.email?.emailDbId
                  ? navigate({ name: "mail", id: item.email.emailDbId })
                  : navigate({ name: "mail", lane: "PUSH" })
              }
            >
              {t("cover.review")}
            </button>
          </div>
          <span className="cover__hint">{t("cover.hint")}</span>
        </>
      ) : (
        <div className="cover__body">
          <span className="cover__title">{t("today.brief.emptyTitle")}</span>
          <span className="cover__why">{t("today.brief.emptyBody")}</span>
        </div>
      )}
    </main>
  );
}
