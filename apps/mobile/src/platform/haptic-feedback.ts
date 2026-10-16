/**
 * Haptics (canvas notes.gestures: approve / send → success haptic). Native
 * only, never awaited, never throws — a missing engine is silence, not an error.
 */
import { isNative } from "./native";

export function successHaptic(): void {
  if (!isNative()) return;
  void import("@capacitor/haptics")
    .then(({ Haptics, NotificationType }) =>
      Haptics.notification({ type: NotificationType.Success }),
    )
    .catch(() => {});
}

export function lightHaptic(): void {
  if (!isNative()) return;
  void import("@capacitor/haptics")
    .then(({ Haptics, ImpactStyle }) => Haptics.impact({ style: ImpactStyle.Light }))
    .catch(() => {});
}
