/**
 * The undo snackbar (canvas: "5초 실행 취소"). One line, an Undo button, and
 * a close button; announced politely to screen readers. It sits above the
 * tab bar / reader toolbar and leaves on its own when the window closes.
 */
import { useI18n } from "../i18n/I18nProvider";
import { MailGlyph } from "./MailGlyph";
import "./snackbar.css";

export interface SnackbarProps {
  message: string | null;
  /** Shown as the action button when set. */
  actionLabel?: string;
  onAction?: () => void;
  onClose?: () => void;
  /** "error": a refusal the user must see (role=alert). */
  tone?: "neutral" | "error";
}

export function Snackbar({
  message,
  actionLabel,
  onAction,
  onClose,
  tone = "neutral",
}: SnackbarProps) {
  const { t } = useI18n();
  return (
    <div className="snackbar-region" aria-live={tone === "error" ? "assertive" : "polite"}>
      {message ? (
        <div className={`snackbar snackbar--${tone}`} role={tone === "error" ? "alert" : "status"}>
          <span className="snackbar__text">{message}</span>
          {actionLabel && onAction ? (
            <button type="button" className="snackbar__action" onClick={onAction}>
              {actionLabel}
            </button>
          ) : null}
          {onClose ? (
            <button
              type="button"
              className="snackbar__close"
              onClick={onClose}
              aria-label={t("mail.snackbar.close")}
            >
              <MailGlyph name="close" size={18} strokeWidth={2} />
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
