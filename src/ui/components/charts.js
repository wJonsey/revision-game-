import { h } from "../dom.js";

/**
 * Small SVG charts following the dataviz method: one hue for single series (validated
 * against the game's dark panel), 2px lines, ≤24px bars with 4px rounded ends, hairline
 * grid, hover/focus tooltips, and a table view so no value depends on hovering.
 */

const SVG = "http://www.w3.org/2000/svg";
const SERIES = "#3987e5";
const RAMP = ["#262d36", "#184f95", "#256abf", "#3987e5", "#6da7ec", "#9ec5f4"];

function s(tag, attributes = {}, ...children) {
  const element = document.createElementNS(SVG, tag);
  for (const [key, value] of Object.entries(attributes)) {
    if (value !== undefined && value !== null) element.setAttribute(key, String(value));
  }
  for (const child of children) if (child) element.append(child);
  return element;
}

function tooltipLayer() {
  const tip = h("div", { class: "chart-tooltip", hidden: true, role: "status" });
  return {
    element: tip,
    show(container, x, y, value, label) {
      tip.replaceChildren(h("strong", {}, value), h("span", {}, label));
      tip.hidden = false;
      const box = container.getBoundingClientRect();
      tip.style.left = `${Math.min(Math.max(0, x), box.width - 140)}px`;
      tip.style.top = `${Math.max(0, y - 52)}px`;
    },
    hide() {
      tip.hidden = true;
    },
  };
}

function tableView(caption, rows, columns) {
  return h("details", { class: "chart-table" },
    h("summary", {}, "Show as table"),
    h("div", { class: "table-wrap" }, h("table", {},
      h("caption", {}, caption),
      h("thead", {}, h("tr", {}, columns.map((c) => h("th", {}, c)))),
      h("tbody", {}, rows.map((row) => h("tr", {}, row.map((cell) => h("td", {}, cell))))))));
}

const shortDay = (key) => {
  const [, month, day] = key.split("-");
  return `${Number(day)}/${Number(month)}`;
};

/**
 * Line chart for a single series over time. Missing values (null) break the line.
 * @param {{ title: string, points: Array<{ key: string, value: number|null }>, max: number, format: (v: number) => string, ticks: number[] }} options
 */
export function lineChart({ title, points, max, format, ticks }) {
  const width = 560, height = 220, left = 44, right = 44, top = 16, bottom = 28;
  const plotW = width - left - right, plotH = height - top - bottom;
  const x = (i) => left + (points.length === 1 ? plotW / 2 : (i * plotW) / (points.length - 1));
  const y = (v) => top + plotH - (v / max) * plotH;

  const svg = s("svg", { viewBox: `0 0 ${width} ${height}`, class: "chart", role: "img", "aria-label": title });
  for (const tick of ticks) {
    svg.append(s("line", { x1: left, x2: width - right, y1: y(tick), y2: y(tick), class: "chart-grid" }));
    const label = s("text", { x: left - 8, y: y(tick) + 4, class: "chart-axis", "text-anchor": "end" });
    label.textContent = format(tick);
    svg.append(label);
  }
  points.forEach((p, i) => {
    if (i % Math.ceil(points.length / 7) !== 0 && i !== points.length - 1) return;
    const label = s("text", { x: x(i), y: height - 8, class: "chart-axis", "text-anchor": "middle" });
    label.textContent = shortDay(p.key);
    svg.append(label);
  });

  let segment = [];
  const flush = () => {
    if (segment.length > 1) svg.append(s("polyline", { points: segment.join(" "), fill: "none", stroke: SERIES, "stroke-width": 2, "stroke-linejoin": "round", "stroke-linecap": "round" }));
    segment = [];
  };
  points.forEach((p, i) => {
    if (p.value === null) return flush();
    segment.push(`${x(i)},${y(p.value)}`);
  });
  flush();
  points.forEach((p, i) => {
    if (p.value === null) return;
    const lonely = (points[i - 1]?.value ?? null) === null && (points[i + 1]?.value ?? null) === null;
    const last = i === points.length - 1 || points.slice(i + 1).every((q) => q.value === null);
    if (lonely || last) svg.append(s("circle", { cx: x(i), cy: y(p.value), r: 4, fill: SERIES, stroke: "#131a22", "stroke-width": 2 }));
    if (last) {
      const label = s("text", { x: x(i) + 8, y: y(p.value) + 4, class: "chart-value" });
      label.textContent = format(p.value);
      svg.append(label);
    }
  });

  const crosshair = s("line", { y1: top, y2: top + plotH, class: "chart-crosshair", visibility: "hidden" });
  svg.append(crosshair);
  const hit = s("rect", { x: left, y: top, width: plotW, height: plotH, fill: "transparent", tabindex: 0 });
  svg.append(hit);
  const wrapper = h("div", { class: "chart-wrap" });
  const tip = tooltipLayer();
  const showIndex = (index) => {
    const p = points[index];
    crosshair.setAttribute("x1", x(index));
    crosshair.setAttribute("x2", x(index));
    crosshair.setAttribute("visibility", "visible");
    const rect = svg.getBoundingClientRect();
    const scale = rect.width / width;
    tip.show(wrapper, x(index) * scale + 8, (p.value === null ? top + plotH / 2 : y(p.value)) * scale, p.value === null ? "No answers" : format(p.value), shortDay(p.key));
  };
  let focusIndex = points.length - 1;
  hit.addEventListener("pointermove", (event) => {
    const rect = svg.getBoundingClientRect();
    const px = ((event.clientX - rect.left) / rect.width) * width;
    focusIndex = Math.max(0, Math.min(points.length - 1, Math.round(((px - left) / plotW) * (points.length - 1))));
    showIndex(focusIndex);
  });
  hit.addEventListener("focus", () => showIndex(focusIndex));
  hit.addEventListener("keydown", (event) => {
    if (event.key === "ArrowLeft") focusIndex = Math.max(0, focusIndex - 1);
    else if (event.key === "ArrowRight") focusIndex = Math.min(points.length - 1, focusIndex + 1);
    else return;
    event.preventDefault();
    showIndex(focusIndex);
  });
  const hide = () => { crosshair.setAttribute("visibility", "hidden"); tip.hide(); };
  hit.addEventListener("pointerleave", hide);
  hit.addEventListener("blur", hide);

  wrapper.append(svg, tip.element);
  return h("figure", { class: "chart-figure" }, h("figcaption", {}, title), wrapper,
    tableView(title, points.map((p) => [p.key, p.value === null ? "–" : format(p.value)]), ["Day", "Value"]));
}

/** Column chart for a single series by day. */
export function columnChart({ title, points, format }) {
  const width = 560, height = 220, left = 44, right = 12, top = 20, bottom = 28;
  const plotW = width - left - right, plotH = height - top - bottom;
  const rawMax = Math.max(1, ...points.map((p) => p.value));
  const step = 10 ** Math.floor(Math.log10(rawMax));
  const max = Math.ceil(rawMax / step) * step;
  const band = plotW / points.length;
  const barWidth = Math.min(24, band - 2);
  const y = (v) => top + plotH - (v / max) * plotH;
  const svg = s("svg", { viewBox: `0 0 ${width} ${height}`, class: "chart", role: "img", "aria-label": title });
  for (const tick of [0, max / 2, max]) {
    svg.append(s("line", { x1: left, x2: width - right, y1: y(tick), y2: y(tick), class: tick === 0 ? "chart-baseline" : "chart-grid" }));
    const label = s("text", { x: left - 8, y: y(tick) + 4, class: "chart-axis", "text-anchor": "end" });
    label.textContent = format(tick);
    svg.append(label);
  }
  const wrapper = h("div", { class: "chart-wrap" });
  const tip = tooltipLayer();
  const peak = points.reduce((best, p, i) => (p.value > (points[best]?.value ?? -1) ? i : best), 0);
  points.forEach((p, i) => {
    const cx = left + band * i + band / 2;
    if (i % Math.ceil(points.length / 7) === 0 || i === points.length - 1) {
      const label = s("text", { x: cx, y: height - 8, class: "chart-axis", "text-anchor": "middle" });
      label.textContent = shortDay(p.key);
      svg.append(label);
    }
    const barHeight = (p.value / max) * plotH;
    if (barHeight > 0) {
      const r = Math.min(4, barHeight, barWidth / 2);
      const x0 = cx - barWidth / 2, x1 = cx + barWidth / 2, yb = top + plotH, yt = yb - barHeight;
      svg.append(s("path", { d: `M${x0},${yb} V${yt + r} Q${x0},${yt} ${x0 + r},${yt} H${x1 - r} Q${x1},${yt} ${x1},${yt + r} V${yb} Z`, fill: SERIES, class: "chart-bar" }));
      if (i === peak) {
        const label = s("text", { x: cx, y: yt - 6, class: "chart-value", "text-anchor": "middle" });
        label.textContent = format(p.value);
        svg.append(label);
      }
    }
    const hit = s("rect", { x: left + band * i, y: top, width: band, height: plotH, fill: "transparent", tabindex: 0, "aria-label": `${shortDay(p.key)}: ${format(p.value)}` });
    const show = () => {
      const rect = svg.getBoundingClientRect();
      const scale = rect.width / width;
      tip.show(wrapper, cx * scale, y(p.value) * scale, format(p.value), shortDay(p.key));
    };
    hit.addEventListener("pointerenter", show);
    hit.addEventListener("focus", show);
    hit.addEventListener("pointerleave", () => tip.hide());
    hit.addEventListener("blur", () => tip.hide());
    svg.append(hit);
  });
  wrapper.append(svg, tip.element);
  return h("figure", { class: "chart-figure" }, h("figcaption", {}, title), wrapper,
    tableView(title, points.map((p) => [p.key, format(p.value)]), ["Day", "Value"]));
}

/** Horizontal bars (0–100%) with the value at each bar tip. */
export function barList({ title, rows }) {
  return h("figure", { class: "chart-figure" }, h("figcaption", {}, title),
    h("div", { class: "bar-list" }, rows.map((row) => h("div", { class: "bar-list-row", tabindex: 0, title: `${row.label}: ${row.detail}` },
      h("span", { class: "bar-list-label" }, row.label),
      h("span", { class: "bar-list-track" }, row.value === null ? null : h("span", { class: "bar-list-fill", style: { width: `${Math.max(0, Math.min(1, row.value)) * 100}%` } })),
      h("span", { class: "bar-list-value" }, row.detail)))),
    tableView(title, rows.map((r) => [r.label, r.detail]), ["Topic", "Value"]));
}

/** Calendar heatmap of attempts per day (8 weeks × 7 days), sequential blue ramp. */
export function calendarHeatmap({ title, days }) {
  const max = Math.max(1, ...days.map((d) => d.attempts));
  const level = (n) => (n === 0 ? 0 : Math.min(RAMP.length - 1, 1 + Math.floor(((n - 1) / max) * (RAMP.length - 1))));
  const cell = 16, gap = 3;
  const firstWeekday = (new Date(`${days[0].day}T12:00:00`).getDay() + 6) % 7;
  const columns = Math.ceil((days.length + firstWeekday) / 7);
  const width = 30 + columns * (cell + gap), height = 7 * (cell + gap) + 4;
  const svg = s("svg", { viewBox: `0 0 ${width} ${height}`, class: "chart chart-calendar", role: "img", "aria-label": title });
  ["Mon", "Wed", "Fri"].forEach((name, i) => {
    const label = s("text", { x: 0, y: (i * 2) * (cell + gap) + cell - 3, class: "chart-axis" });
    label.textContent = name;
    svg.append(label);
  });
  const wrapper = h("div", { class: "chart-wrap" });
  const tip = tooltipLayer();
  days.forEach((d, index) => {
    const position = index + firstWeekday;
    const cx = 30 + Math.floor(position / 7) * (cell + gap);
    const cy = (position % 7) * (cell + gap);
    const rect = s("rect", { x: cx, y: cy, width: cell, height: cell, rx: 3, fill: RAMP[level(d.attempts)], tabindex: 0, class: "chart-cell", "aria-label": `${d.day}: ${d.attempts} questions` });
    const show = () => {
      const box = svg.getBoundingClientRect();
      const scale = box.width / width;
      tip.show(wrapper, cx * scale, cy * scale, `${d.attempts} question${d.attempts === 1 ? "" : "s"}`, d.day);
    };
    rect.addEventListener("pointerenter", show);
    rect.addEventListener("focus", show);
    rect.addEventListener("pointerleave", () => tip.hide());
    rect.addEventListener("blur", () => tip.hide());
    svg.append(rect);
  });
  wrapper.append(svg, tip.element);
  const legend = h("div", { class: "heat-legend" }, h("span", {}, "Fewer"), RAMP.map((colour) => h("span", { class: "heat-swatch", style: { background: colour } })), h("span", {}, "More"));
  return h("figure", { class: "chart-figure" }, h("figcaption", {}, title), wrapper, legend,
    tableView(title, days.filter((d) => d.attempts > 0).map((d) => [d.day, String(d.attempts)]), ["Day", "Questions answered"]));
}
