/**
 * Applies accessibility and display settings to the document.
 * All visual settings are CSS classes/variables so every screen follows them.
 */
export function applySettings(settings, root = document.documentElement) {
  root.style.setProperty("--text-scale", String(settings.textScale));
  root.classList.toggle("high-contrast", Boolean(settings.highContrast));
  root.classList.toggle("reduced-motion", Boolean(settings.reducedMotion));
  root.classList.toggle("readable-font", Boolean(settings.readableFont));
  root.classList.toggle("colour-blind", Boolean(settings.colourBlindPalette));
}

/** Respect the operating system's reduced-motion preference on first run. */
export function systemPrefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}
