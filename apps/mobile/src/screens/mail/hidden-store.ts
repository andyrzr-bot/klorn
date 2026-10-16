/**
 * Rows this device cleared (Done) or set aside (Later), with the time they may
 * show again. Needed because GET /api/email lists mail regardless of its
 * attention item's status: a dismissed or snoozed mail would reappear on the
 * next refresh. Persisted (kv) so a relaunch keeps them out; entries expire.
 * A tiny external store for useSyncExternalStore.
 */
import { useSyncExternalStore } from "react";
import { kv } from "../../platform/kv";

const KEY = "klorn-mail-hidden-v1";
/** How long a Done row stays out of this device's lists. */
export const DONE_HIDE_MS = 30 * 24 * 60 * 60 * 1000;

let hidden = new Map<string, number>();
const listeners = new Set<() => void>();
let loaded = false;

function emit() {
  for (const listener of listeners) listener();
}

function persist() {
  const now = Date.now();
  const live = [...hidden.entries()].filter(([, until]) => until > now);
  void kv.setItem(KEY, JSON.stringify(live));
}

export function loadHidden(): Promise<void> {
  if (loaded) return Promise.resolve();
  loaded = true;
  return kv.getItem(KEY).then((raw) => {
    if (!raw) return;
    try {
      const entries = JSON.parse(raw) as Array<[string, number]>;
      const now = Date.now();
      const merged = new Map(hidden);
      for (const [id, until] of entries) {
        if (typeof id === "string" && typeof until === "number" && until > now && !merged.has(id)) {
          merged.set(id, until);
        }
      }
      hidden = merged;
      emit();
    } catch {
      // A corrupt entry only means nothing is hidden.
    }
  });
}

export function hideMail(ids: readonly string[], until: number): void {
  const next = new Map(hidden);
  for (const id of ids) next.set(id, until);
  hidden = next;
  persist();
  emit();
}

export function unhideMail(ids: readonly string[]): void {
  const next = new Map(hidden);
  for (const id of ids) next.delete(id);
  hidden = next;
  persist();
  emit();
}

export function hiddenSnapshot(): ReadonlyMap<string, number> {
  return hidden;
}

export function clearHidden(): void {
  hidden = new Map();
  void kv.removeItem(KEY);
  emit();
}

export function useHiddenMail(): ReadonlyMap<string, number> {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => hidden,
    () => hidden,
  );
}
