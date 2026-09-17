import { h } from "./dom.js";

/**
 * Toast notifications and sound captions. Messages go to an aria-live region
 * so screen readers announce them.
 */
let region = null;

function getRegion() {
  if (!region || !document.body.contains(region)) {
    region = h("div", { class: "toasts", "aria-live": "polite", role: "status" });
    document.body.append(region);
  }
  return region;
}

export function toast(message, kind = "info", durationMs = 3500) {
  const item = h("div", { class: `toast toast-${kind}` }, message);
  getRegion().append(item);
  setTimeout(() => item.remove(), durationMs);
}
