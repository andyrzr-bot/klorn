/**
 * Mail — scaffold only (the full screen, swipe rows and the lane sheet come
 * next). It exists to prove the list/detail panes: the selected mail is the
 * route (/mail/:id), so it survives rotation, folding and window resizes, and
 * the Android back button closes the reader before leaving the tab.
 */
import type { EmailListItem } from "@klorn/contract";
import { useEmail, useEmailList } from "../../api/queries";
import { formatClock } from "../../i18n/format";
import { useI18n } from "../../i18n/I18nProvider";
import { ListDetail } from "../../layout/ListDetail";
import { useLinkProps, useRouter } from "../../router/Router";
import type { LaneParam } from "../../router/routes";
import { Icon } from "../../ui/Icon";
import { EmptyState, ProblemState, SkeletonRows } from "../../ui/StateView";
import "./mail.css";

function MailRow({
  email,
  lane,
  selected,
}: {
  email: EmailListItem;
  lane?: LaneParam;
  selected: boolean;
}) {
  const { intlTag } = useI18n();
  const link = useLinkProps(
    lane ? { name: "mail", lane, id: email.id } : { name: "mail", id: email.id },
  );
  return (
    <a className="mail-row" aria-current={selected ? "true" : undefined} {...link}>
      <span className="mail-row__top">
        <span className="mail-row__from">{email.from}</span>
        <span className="mail-row__time">{formatClock(new Date(email.date), intlTag)}</span>
      </span>
      <span className="mail-row__subject">{email.subject}</span>
      {email.tier ? (
        <span className="mail-row__meta">
          <span className={`lane-chip lane-chip--${email.tier.toLowerCase()}`}>{email.tier}</span>
          {email.summary ? <span className="mail-row__reason">{email.summary}</span> : null}
        </span>
      ) : null}
    </a>
  );
}

function Reader({ id, lane }: { id: string; lane?: LaneParam }) {
  const { t } = useI18n();
  const { navigate } = useRouter();
  const email = useEmail(id);
  return (
    <div className="reader screen">
      <button
        type="button"
        className="reader__back"
        onClick={() => navigate(lane ? { name: "mail", lane } : { name: "mail" })}
      >
        <Icon name="chevronLeft" size={24} strokeWidth={2.2} />
        {t("tab.mail")}
      </button>
      {email.isPending ? (
        <SkeletonRows rows={2} />
      ) : email.isError || !email.data ? (
        <ProblemState kind="error" onRetry={() => void email.refetch()} />
      ) : (
        <article className="reader__body selectable">
          <h1 className="reader__subject">{email.data.subject}</h1>
          <span className="reader__from">{email.data.from}</span>
          <p className="reader__text">{email.data.body ?? email.data.snippet}</p>
        </article>
      )}
    </div>
  );
}

export function MailScreen({ lane, id }: { lane?: LaneParam; id?: string }) {
  const { t } = useI18n();
  const list = useEmailList(lane ?? "ALL");
  const listPane = (
    <div className="screen mail-list">
      <h1 className="screen-title">{t("tab.mail")}</h1>
      {list.isPending ? (
        <SkeletonRows rows={4} />
      ) : list.isError && !list.data ? (
        <ProblemState kind="error" onRetry={() => void list.refetch()} />
      ) : (
        <div className="mail-list__rows">
          {(list.data?.emails ?? []).map((email) => (
            <MailRow key={email.id} email={email} lane={lane} selected={email.id === id} />
          ))}
        </div>
      )}
    </div>
  );
  return (
    <ListDetail
      list={listPane}
      detail={id ? <Reader id={id} lane={lane} /> : null}
      emptyDetail={
        <div className="screen reader reader--empty">
          <EmptyState tone="neutral" icon="mail" title={t("mail.selectPrompt")} />
        </div>
      }
      listLabel={t("tab.mail")}
      detailLabel={t("tab.mail")}
    />
  );
}
