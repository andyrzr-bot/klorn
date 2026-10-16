/**
 * Sheet — the modal surface Mail's lane / account / snooze / confirm panels
 * use (LaneSheet artboard). One component, two shapes:
 *
 *   compact (phones, Flip unfolded, tabletop)  bottom sheet, r28 top corners,
 *                                              grabber, drag down to dismiss
 *   medium / expanded                          centred dialog (r20), same content
 *
 * Accessibility: role=dialog + aria-modal, labelled by its title; focus moves
 * in and is trapped (the app root is `inert` while open, with a Tab-wrap
 * fallback); Escape, the scrim and Android back (router.registerSheet) close
 * it; focus returns to the opener. Reduced motion → fade only.
 */
import {
  type CSSProperties,
  type ReactNode,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { useLayout } from "../layout/LayoutContext";
import { useRouter } from "../router/Router";
import "./sheet.css";

/** Drag past this (or fling down) to dismiss. */
export const SHEET_DISMISS_DISTANCE = 96;
const SHEET_DISMISS_VELOCITY = 0.5;

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export interface SheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  /** Visually hide the title (it still labels the dialog). */
  hideTitle?: boolean;
  /** A line under the title (the mail the sheet acts on). */
  subtitle?: ReactNode;
  children: ReactNode;
  /** Sticky footer (the primary button). */
  footer?: ReactNode;
  /** Wide layouts: dialog width. */
  width?: number;
  /** Element to focus first (else the first focusable). */
  initialFocus?: () => HTMLElement | null;
  className?: string;
  /** "full" on compact: the composer — fills the screen above the keyboard. */
  size?: "auto" | "full";
  /** Extra CSS variables on the sheet root (e.g. --kb-inset). */
  style?: CSSProperties;
}

function reducedMotion(): boolean {
  return (
    typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
  );
}

export function Sheet(props: SheetProps) {
  const { open } = props;
  // Keep it mounted through the exit transition.
  const [mounted, setMounted] = useState(open);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (open) {
      setMounted(true);
      const raf = requestAnimationFrame(() => setVisible(true));
      return () => cancelAnimationFrame(raf);
    }
    setVisible(false);
    const t = setTimeout(() => setMounted(false), reducedMotion() ? 0 : 160);
    return () => clearTimeout(t);
  }, [open]);
  if (!mounted || typeof document === "undefined") return null;
  return createPortal(<SheetBody {...props} visible={visible && open} />, document.body);
}

function SheetBody({
  open,
  visible,
  onClose,
  title,
  hideTitle,
  subtitle,
  children,
  footer,
  width = 440,
  initialFocus,
  className,
  size = "auto",
  style: extraStyle,
}: SheetProps & { visible: boolean }) {
  const plan = useLayout();
  const { registerSheet } = useRouter();
  const bottom =
    plan.sizeClass === "compact" || plan.sizeClass === "cover" || plan.posture === "tabletop";
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const subtitleId = useId();
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const [drag, setDrag] = useState(0);
  const dragStart = useRef<{ y: number; t: number; lastY: number; lastT: number } | null>(null);

  // Android back + Escape close the sheet; the app behind is inert.
  useEffect(() => {
    if (!open) return;
    const unregister = registerSheet(() => closeRef.current());
    const opener = document.activeElement as HTMLElement | null;
    const root = document.getElementById("root");
    root?.setAttribute("inert", "");
    root?.setAttribute("aria-hidden", "true");
    const focusFirst = () => {
      const target =
        initialFocus?.() ??
        panelRef.current?.querySelector<HTMLElement>(FOCUSABLE) ??
        panelRef.current;
      target?.focus({ preventScroll: true });
    };
    const raf = requestAnimationFrame(focusFirst);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        closeRef.current();
        return;
      }
      if (e.key !== "Tab" || !panelRef.current) return;
      const items = [...panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
        (el) => el.offsetParent !== null || el === document.activeElement,
      );
      const first = items[0];
      const last = items[items.length - 1];
      if (!first || !last) return;
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      cancelAnimationFrame(raf);
      unregister();
      document.removeEventListener("keydown", onKey);
      // Another sheet may still be open (stacked confirm); only the last one restores.
      if (!document.querySelector(".sheet[data-open='true']:not([data-closing])")) {
        root?.removeAttribute("inert");
        root?.removeAttribute("aria-hidden");
      }
      opener?.focus?.({ preventScroll: true });
    };
    // initialFocus is read once, when the sheet opens.
  }, [open, registerSheet]);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (!bottom) return;
      dragStart.current = { y: e.clientY, t: e.timeStamp, lastY: e.clientY, lastT: e.timeStamp };
      (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    },
    [bottom],
  );
  const onPointerMove = useCallback((e: React.PointerEvent) => {
    const s = dragStart.current;
    if (!s) return;
    s.lastY = e.clientY;
    s.lastT = e.timeStamp;
    setDrag(Math.max(0, e.clientY - s.y));
  }, []);
  const onPointerUp = useCallback(
    (e: React.PointerEvent) => {
      const s = dragStart.current;
      dragStart.current = null;
      if (!s) return;
      const dy = Math.max(0, e.clientY - s.y);
      const dt = Math.max(1, e.timeStamp - s.t);
      if (dy > SHEET_DISMISS_DISTANCE || (dy > 24 && dy / dt > SHEET_DISMISS_VELOCITY)) {
        setDrag(0);
        onClose();
        return;
      }
      setDrag(0);
    },
    [onClose],
  );

  const style = {
    ...extraStyle,
    "--sheet-drag": `${drag}px`,
    "--sheet-width": `${width}px`,
  } as CSSProperties;

  return (
    <div
      className={`sheet ${bottom ? "sheet--bottom" : "sheet--dialog"} sheet--${size} ${className ?? ""}`}
      data-open={visible ? "true" : "false"}
      data-dragging={drag > 0 ? "true" : undefined}
      style={style}
    >
      <div className="sheet__scrim" aria-hidden="true" onClick={onClose} />
      <div
        ref={panelRef}
        className="sheet__panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={subtitle ? subtitleId : undefined}
        tabIndex={-1}
      >
        {bottom ? (
          <div
            className="sheet__grab"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            aria-hidden="true"
          >
            <span className="sheet__grabber" />
          </div>
        ) : null}
        <div
          className={`sheet__head${hideTitle ? " sheet__head--hidden" : ""}`}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          <h2 id={titleId} className={hideTitle ? "sr-only" : "sheet__title"}>
            {title}
          </h2>
          {subtitle ? (
            <span id={subtitleId} className="sheet__subtitle">
              {subtitle}
            </span>
          ) : null}
        </div>
        <div className="sheet__body">{children}</div>
        {footer ? <div className="sheet__footer">{footer}</div> : null}
      </div>
    </div>
  );
}
