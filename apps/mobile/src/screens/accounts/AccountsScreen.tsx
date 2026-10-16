/**
 * Accounts & sources — foundation version: who is signed in, the connected
 * inboxes (accounts), app language, appearance, sign out. Connecting a new
 * account still happens on the web for now.
 */
import { useInboxes, useMe } from "../../api/queries";
import { useTheme } from "../../app/theme";
import { useSession } from "../../auth/session";
import { isLocale, LOCALE_NAMES, LOCALES } from "../../i18n";
import { useI18n } from "../../i18n/I18nProvider";
import { SourceBadge } from "../../ui/SourceBadge";
import "./accounts.css";

export function AccountsScreen() {
  const { t, locale, override, setOverride } = useI18n();
  const { choice, setChoice } = useTheme();
  const { signOut } = useSession();
  const me = useMe();
  const inboxes = useInboxes().data?.inboxes ?? [];

  return (
    <div className="screen">
      <div className="accounts">
        <h1 className="screen-title">{t("accounts.title")}</h1>
        {me.data ? (
          <p className="accounts__who">{t("accounts.signedInAs", { email: me.data.email })}</p>
        ) : null}

        {inboxes.length > 0 ? (
          <section className="accounts__group" aria-labelledby="acc-inboxes">
            <h2 id="acc-inboxes" className="accounts__heading">
              {t("accounts.connected")}
            </h2>
            <ul className="accounts__list card">
              {inboxes.map((inbox) => (
                <li key={inbox.id ?? "primary"} className="accounts__row">
                  <SourceBadge inbox={inbox} size={28} />
                  <span className="accounts__email">{inbox.email ?? inbox.provider}</span>
                  {inbox.needsReconnect ? (
                    <span className="accounts__warn">{t("accounts.needsReconnect")}</span>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <section className="accounts__group card accounts__settings">
          <label className="accounts__field">
            <span>{t("accounts.language")}</span>
            <select
              value={override ?? "device"}
              onChange={(e) => setOverride(isLocale(e.target.value) ? e.target.value : null)}
            >
              <option value="device">
                {t("accounts.theme.system")} ({LOCALE_NAMES[locale]})
              </option>
              {LOCALES.map((l) => (
                <option key={l} value={l}>
                  {LOCALE_NAMES[l]}
                </option>
              ))}
            </select>
          </label>
          <label className="accounts__field">
            <span>{t("accounts.theme")}</span>
            <select
              value={choice}
              onChange={(e) => setChoice(e.target.value as "system" | "light" | "dark")}
            >
              <option value="system">{t("accounts.theme.system")}</option>
              <option value="light">{t("accounts.theme.light")}</option>
              <option value="dark">{t("accounts.theme.dark")}</option>
            </select>
          </label>
        </section>

        <button
          type="button"
          className="button button--quiet accounts__signout"
          onClick={() => void signOut()}
        >
          {t("accounts.signOut")}
        </button>
      </div>
    </div>
  );
}
