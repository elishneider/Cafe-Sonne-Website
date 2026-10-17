import type { DisplayStatus } from "./sunTimeline";

export const SUN_STATUS_LABEL: Record<DisplayStatus, string> = {
  sun: "☀️ In the sun",
  partial: "⛅ Partly sunny",
  shade: "🌥️ In shade",
  closed: "🔒 Closed",
};

export const SUN_STATUS_BADGE_CLASS: Record<DisplayStatus, string> = {
  sun: "badge-sun",
  partial: "badge-partial",
  shade: "badge-shade",
  closed: "badge-closed",
};

export const SUN_STATUS_DOT_COLOR: Record<DisplayStatus, string> = {
  sun: "#e08a1f",
  partial: "#c99a2e",
  shade: "#6b7a8f",
  closed: "#a39b8f",
};
