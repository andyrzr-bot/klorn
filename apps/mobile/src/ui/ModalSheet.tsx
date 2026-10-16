/**
 * A modal sheet: a bottom sheet on phones (radius 28, canvas notes.system),
 * a centred dialog from 600px, or a full-height side sheet (`side`, the
 * expanded layout's assistant). Android back and Escape close it (the router's
 * sheet stack), focus moves in on open and back to the opener on close, and
 * the page behind is inert while it is up.
 */
import { type ReactNode, useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { useI18n } from "../i18n/I18nProvider";
import { useRouter } from "../router/Router";
import { Icon } from "./Icon";
import "./sheet.css";

interface ModalSheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  /** Shown under the title. */
  subtitle?: string;
  children: ReactNode;
  /** Pinned under the scrolling body (primary actions). */
  footer?: ReactNode;
  variant?: "auto" | "side";
  /** Visually hide the title (it still names the dialog). */
  hideTitle?: boolean;
  className?: string;
}

export function ModalSheet({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  variant = "auto",
  hideTitle = false,
  className,
}: ModalSheetProps) {
  const { t } = useI18n();
  const { registerSheet } = useRouter();
  const titleId = useId();
  const panel = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const opener = document.activeElement as HTMLElement | null;
    const unregister = registerSheet(() => closeRef.current());
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        closeRef.current();
      }
    };
    document.addEventListener("keydown", onKey);
    const root = document.getElementById("root");
    root?.setAttribute("inert", "");
    const frame = requestAnimationFrame(() => {
      const first =
        panel.current?.querySelector<HTMLElement>("[data-autofocus]") ??
        panel.current?.querySelector<HTMLElement>("input:not([type=hidden]), textarea, select");
      (first ?? panel.current)?.focus({ preventScroll: true });
    });
    return () => {
      cancelAnimationFrame(frame);
      unregister();
      document.removeEventListener("keydown", onKey);
      root?.removeAttribute("inert");
      opener?.focus?.({ preventScroll: true });
    };
  }, [open, registerSheet]);

  if (!open) return null;
  return createPortal(
    <div className="sheet-layer" data-variant={variant}>
      <button
        type="button"
        className="sheet-layer__scrim"
        aria-label={t("settings.ui.close")}
        tabIndex={-1}
        onClick={onClose}
      />
      <div
        ref={panel}
        className={`sheet ${className ?? ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        <span className="sheet__grabber" aria-hidden="true" />
        <header className={`sheet__head${hideTitle ? " sheet__head--bare" : ""}`}>
          <span className="sheet__titles">
            <h2 id={titleId} className={hideTitle ? "sr-only" : "sheet__title"}>
              {title}
            </h2>
            {subtitle ? <span className="sheet__subtitle">{subtitle}</span> : null}
          </span>
          <button type="button" className="sheet__close" onClick={onClose}>
            <Icon name="close" size={20} strokeWidth={2} label={t("settings.ui.close")} />
          </button>
        </header>
        <div className="sheet__body">{children}</div>
        {footer ? <footer className="sheet__foot">{footer}</footer> : null}
      </div>
    </div>,
    document.body,
  );
}
