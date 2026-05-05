import { NativeModules, Platform } from "react-native";

const { FocusMode } = NativeModules;

export async function enableFocusMode(): Promise<void> {
  if (Platform.OS !== "android") return;
  await FocusMode?.setActive(true);
}

export async function disableFocusMode(): Promise<void> {
  if (Platform.OS !== "android") return;
  await FocusMode?.setActive(false);
}

export async function isFocusModeEnabled(): Promise<boolean> {
  if (Platform.OS !== "android") return false;
  return FocusMode?.isAccessibilityEnabled() ?? false;
}

export function openAccessibilitySettings(): void {
  if (Platform.OS !== "android") return;
  console.log("[FocusMode] native module:", NativeModules.FocusMode);
  if (!FocusMode) {
    console.warn("[FocusMode] Native module not available — rebuild required");
    return;
  }
  FocusMode?.openAccessibilitySettings();
}
