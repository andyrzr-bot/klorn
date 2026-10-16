/** A tab that is not built yet: the right title, the shell around it, nothing more. */

import type { MessageKey } from "../../i18n";
import { useI18n } from "../../i18n/I18nProvider";
import type { IconName } from "../../ui/Icon";
import { EmptyState } from "../../ui/StateView";
import "./placeholder.css";

export function PlaceholderScreen({ title, icon }: { title: MessageKey; icon: IconName }) {
  const { t } = useI18n();
  return (
    <div className="screen">
      <div className="placeholder">
        <h1 className="screen-title">{t(title)}</h1>
        <EmptyState tone="neutral" icon={icon} title={t(title)} body={t("placeholder.body")} />
      </div>
    </div>
  );
}
