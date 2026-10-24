import type { DisplayStatus } from "./sunTimeline";

export const SUN_STATUS_LABEL: Record<DisplayStatus, string> = {
  sun: "☀️ In the sun",
  partial: "⛅ Partly sunny",
  shade: "☁️ In shade",
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

// Map pin glyphs: same icons as the timeline segments. Closed cafés get a plain dot
// on the map (no glyph), so they aren't listed here.
export const SUN_STATUS_ICON: Record<Exclude<DisplayStatus, "closed">, string> = {
  sun: "☀️",
  partial: "⛅",
  shade: "☁️",
};

export const SUN_STATUS_PIN_FILL: Record<Exclude<DisplayStatus, "closed">, string> = {
  sun: "#fff1c9",
  partial: "#fdf1d3",
  shade: "#cfd6e0",
};
