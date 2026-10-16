/**
 * A short status line at the bottom of the screen ("Sent — the receipt is in
 * Activity"), announced politely to screen readers. One at a time; anything
 * can raise one through `notify()`, the host renders it.
 */
import { useEffect, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { Icon } from "./Icon";

export type NoteTone = "ok" | "info" | "error";

interface Note {
  id: number;
  text: string;
  tone: NoteTone;
  action?: { label: string; run: () => void };
}

let current: Note | null = null;
let seq = 0;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

export function notify(text: string, tone: NoteTone = "ok", action?: Note["action"]): void {
  seq += 1;
  current = { id: seq, text, tone, action };
  emit();
}

export function clearNote(): void {
  current = null;
  emit();
}

const HIDE_AFTER_MS = 4500;

export function StatusNoteHost() {
  const note = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => current,
    () => null,
  );
  const [shown, setShown] = useState<Note | null>(null);
  useEffect(() => {
    setShown(note);
    if (!note) return;
    const timer = setTimeout(() => {
      if (current?.id === note.id) clearNote();
    }, HIDE_AFTER_MS);
    return () => clearTimeout(timer);
  }, [note]);
  return createPortal(
    <div className="status-note-host" role="status" aria-live="polite">
      {shown ? (
        <div className={`status-note status-note--${shown.tone}`} key={shown.id}>
          <Icon
            name={shown.tone === "error" ? "alert" : shown.tone === "info" ? "info" : "check"}
            size={18}
            strokeWidth={2}
          />
          <span className="status-note__text">{shown.text}</span>
          {shown.action ? (
            <button
              type="button"
              className="status-note__action"
              onClick={() => {
                shown.action?.run();
                clearNote();
              }}
            >
              {shown.action.label}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>,
    document.body,
  );
}
