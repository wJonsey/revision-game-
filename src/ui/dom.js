/**
 * Tiny DOM helper: h("button", { class: "btn", on: { click } }, "Label").
 * Text is always added with textContent/text nodes, never innerHTML, so
 * question content and imported packs cannot inject HTML.
 */
export function h(tag, props = {}, ...children) {
  const element = document.createElement(tag);
  for (const [key, value] of Object.entries(props ?? {})) {
    if (value === undefined || value === null || value === false) continue;
    if (key === "class") element.className = value;
    else if (key === "text") element.textContent = value;
    else if (key === "on") for (const [event, handler] of Object.entries(value)) element.addEventListener(event, handler);
    else if (key === "style") Object.assign(element.style, value);
    else if (key === "value" || key === "checked" || key === "disabled" || key === "selected") element[key] = value;
    else element.setAttribute(key, value === true ? "" : String(value));
  }
  appendChildren(element, children);
  return element;
}

function appendChildren(element, children) {
  for (const child of children.flat(Infinity)) {
    if (child === null || child === undefined || child === false) continue;
    element.append(child instanceof Node ? child : String(child));
  }
}

export function clear(element, ...children) {
  element.replaceChildren();
  appendChildren(element, children);
  return element;
}

export const percentText = (value) => (value === null || value === undefined ? "–" : `${Math.round(value * 100)}%`);

/** Standard screen layout with a title bar and a back button. */
export function screenLayout(title, { navigate, back = "menu", subtitle } = {}) {
  const body = h("div", { class: "screen-body" });
  const header = h("header", { class: "screen-header" },
    back ? h("button", { class: "btn btn-ghost", on: { click: () => navigate(back) } }, "< Back") : null,
    h("div", {}, h("h1", { class: "screen-title" }, title), subtitle ? h("p", { class: "screen-subtitle" }, subtitle) : null),
  );
  const element = h("section", { class: "screen" }, header, body);
  return { element, body };
}

/** Progress bar with a visible text value (never colour alone). */
export function bar(value, { label, max = 1 } = {}) {
  const fraction = value === null || value === undefined ? 0 : Math.max(0, Math.min(1, value / max));
  return h("div", { class: "bar", role: "progressbar", "aria-valuemin": 0, "aria-valuemax": 100, "aria-valuenow": Math.round(fraction * 100), "aria-label": label ?? "progress" },
    h("div", { class: "bar-fill", style: { width: `${fraction * 100}%` } }));
}

/** Triggers a file download from text. */
export function downloadText(filename, text, type = "application/json") {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = h("a", { href: url, download: filename });
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Reads a user-selected file as text. */
export function readFileText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("The file could not be read."));
    reader.readAsText(file);
  });
}
