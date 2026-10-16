/**
 * Plans: the current plan (GET /api/billing/status) and, natively, the store
 * purchase through RevenueCat (platform/iap.ts). There is never a web
 * checkout or an external purchase link in the app (App Store 3.1.1) — the
 * price, the purchase sheet and the subscription page are the store's own.
 * Without a RevenueCat key (or in a browser) the screen shows the plan only.
 */
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useMe } from "../../api/queries";
import { hk, useBillingStatus } from "../../api/queries-hub";
import { useI18n } from "../../i18n/I18nProvider";
import { openExternal } from "../../platform/external";
import {
  currentOffer,
  iapAvailable,
  managementUrl,
  restoreNativePurchases,
  type StoreOffer,
  startNativePurchase,
} from "../../platform/iap";
import { Icon } from "../../ui/Icon";
import { ProblemState, SkeletonRows } from "../../ui/StateView";
import { notify } from "../../ui/StatusNote";
import { SettingsBack } from "./parts";

const PRO_PLANS = new Set(["PRO", "TEAM", "BUSINESS", "ENTERPRISE"]);

export function PlansScreen() {
  const { t, intlTag } = useI18n();
  const queryClient = useQueryClient();
  const me = useMe();
  const billing = useBillingStatus();
  const [offer, setOffer] = useState<StoreOffer | null>(null);
  const [manage, setManage] = useState<string | null>(null);
  const [busy, setBusy] = useState<"buy" | "restore" | null>(null);
  const store = iapAvailable();
  const userId = me.data?.id;

  useEffect(() => {
    if (!store || !userId) return;
    void currentOffer(userId).then(setOffer);
    void managementUrl(userId).then(setManage);
  }, [store, userId]);

  const refresh = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: hk.billing }),
      queryClient.invalidateQueries({ queryKey: ["auth", "me"] }),
    ]);

  const buy = async () => {
    if (!userId) return;
    setBusy("buy");
    const outcome = await startNativePurchase(userId);
    setBusy(null);
    if (outcome === "purchased") {
      notify(t("plans.purchased"));
      await refresh();
    } else if (outcome === "error") notify(t("plans.purchaseFailed"), "error");
    else if (outcome === "unavailable") notify(t("plans.unavailable"), "info");
  };

  const restore = async () => {
    if (!userId) return;
    setBusy("restore");
    const restored = await restoreNativePurchases(userId);
    setBusy(null);
    notify(t(restored ? "plans.restored" : "plans.nothingToRestore"), restored ? "ok" : "info");
    if (restored) await refresh();
  };

  const data = billing.data;
  const pro = data ? PRO_PLANS.has(data.plan) : false;
  const date = (iso: string | null) =>
    iso
      ? new Intl.DateTimeFormat(intlTag, { year: "numeric", month: "long", day: "numeric" }).format(
          new Date(iso),
        )
      : "";

  return (
    <div className="settings">
      <SettingsBack to={{ name: "settings" }} label={t("settings.title")} />
      <h1 className="screen-title">{t("plans.title")}</h1>
      {billing.isError && !data ? (
        <ProblemState kind="error" onRetry={() => void billing.refetch()} />
      ) : !data ? (
        <SkeletonRows rows={2} />
      ) : (
        <section className="plan-card card" aria-labelledby="plan-h">
          <span className="plan-card__label">{t("plans.current")}</span>
          <h2 id="plan-h" className="plan-card__name">
            {data.planName}
          </h2>
          {data.cancelAt ? (
            <p className="plan-card__line">{t("plans.endsOn", { date: date(data.cancelAt) })}</p>
          ) : data.renewsAt ? (
            <p className="plan-card__line">{t("plans.renewsOn", { date: date(data.renewsAt) })}</p>
          ) : null}
        </section>
      )}

      <section className="plan-benefits card" aria-labelledby="pro-h">
        <h2 id="pro-h" className="plan-benefits__title">
          {t("plans.pro.title")}
        </h2>
        <ul>
          {(["accounts", "calendar", "assistant", "files"] as const).map((k) => (
            <li key={k}>
              <Icon name="check" size={18} strokeWidth={2.2} />
              {t(`plans.pro.${k}`)}
            </li>
          ))}
        </ul>
      </section>

      {store ? (
        <div className="plan-actions">
          {!pro ? (
            <button
              type="button"
              className="button button--primary"
              disabled={busy !== null}
              onClick={() => void buy()}
            >
              {busy === "buy"
                ? t("plans.working")
                : offer
                  ? t("plans.subscribePrice", { price: offer.priceString })
                  : t("plans.subscribe")}
            </button>
          ) : null}
          <button
            type="button"
            className="button button--quiet"
            disabled={busy !== null}
            onClick={() => void restore()}
          >
            {busy === "restore" ? t("plans.working") : t("plans.restore")}
          </button>
          {manage ? (
            <button
              type="button"
              className="button button--plain"
              onClick={() => void openExternal(manage)}
            >
              {t("plans.manage")}
            </button>
          ) : null}
          <p className="set-group__foot">{t("plans.storeNote")}</p>
        </div>
      ) : (
        <p className="set-group__foot">{t("plans.notInApp")}</p>
      )}
    </div>
  );
}
