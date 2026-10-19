import { useEffect, useRef, useState } from "react";
import { subscribeConnections } from "../api";
import useTheme from "../useTheme";

let globalLastSnapshot = {};

function loadTraffic(key) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || "{}");
    return value && typeof value === "object" && !Array.isArray(value)
      ? value
      : {};
  } catch {
    return {};
  }
}

let globalHostTraffic = loadTraffic("hostTraffic");
let globalNodeTraffic = loadTraffic("nodeTraffic");

function currentSource() {
  return `${localStorage.getItem("apiBaseUrl") || ""}|${localStorage.getItem("apiSecret") || ""}`;
}

let statsSource = currentSource();
const listeners = new Set();
const MAX_TRACKED = 200;
const PERSIST_INTERVAL = 5000;
let persistTimer = null;

window.addEventListener("api-config-cleared", () => {
  clearTimeout(persistTimer);
  persistTimer = null;
  globalHostTraffic = {};
  globalNodeTraffic = {};
  globalLastSnapshot = {};
});

function pruneTraffic(traffic) {
  const entries = Object.entries(traffic);
  if (entries.length <= MAX_TRACKED) return traffic;
  entries.sort((a, b) => b[1] - a[1]);
  return Object.fromEntries(entries.slice(0, MAX_TRACKED));
}

function schedulePersist() {
  if (persistTimer) return;
  persistTimer = setTimeout(() => {
    persistTimer = null;
    try {
      localStorage.setItem("hostTraffic", JSON.stringify(globalHostTraffic));
      localStorage.setItem("nodeTraffic", JSON.stringify(globalNodeTraffic));
    } catch (err) {
      // Quota exceeded or storage disabled: keep stats in memory.
      console.error("Failed to persist traffic stats", err);
    }
  }, PERSIST_INTERVAL);
}

function handleStats(data) {
  const source = currentSource();
  if (source !== statsSource) {
    statsSource = source;
    globalHostTraffic = {};
    globalNodeTraffic = {};
    globalLastSnapshot = {};
  }
  const snapshot = {};
  for (const c of data.connections || []) {
    const rule = c.chains?.at(-1) || "UNKNOWN";
    const host = c.metadata?.host?.trim()
      ? `${rule} | ${c.metadata.host}`
      : `${rule} | ${c.metadata?.destinationIP || "unknown"}:${c.metadata?.destinationPort || ""}`;
    const node = c.chains?.[0] || "UNKNOWN";
    const total = (c.upload || 0) + (c.download || 0);
    const previous = globalLastSnapshot[c.id];
    if (previous !== undefined) {
      globalHostTraffic[host] = (globalHostTraffic[host] || 0) + Math.max(0, total - previous);
      globalNodeTraffic[node] = (globalNodeTraffic[node] || 0) + Math.max(0, total - previous);
    }
    snapshot[c.id] = total;
  }
  globalLastSnapshot = snapshot;
  globalHostTraffic = pruneTraffic(globalHostTraffic);
  globalNodeTraffic = pruneTraffic(globalNodeTraffic);
  schedulePersist();
  listeners.forEach((fn) => fn());
}

const formatBytes = (n) => {
  if (!n) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.min(Math.floor(Math.log(n) / Math.log(1024)), units.length - 1);
  return `${Math.round(n / 1024 ** i)} ${units[i]}`;
};

// TwemojiFlags provides the flag glyphs Segoe UI Emoji lacks on Windows. Emoji
// fonts are deliberately NOT listed: they also cover ASCII digits with emoji-wide
// advances, which makes dates/byte counts look spaced out. System fallback still
// handles non-flag emoji.
const CHART_FONT = '10px "TwemojiFlags", sans-serif';
const PALETTE = ["#5470c6", "#91cc75", "#fac858", "#ee6666", "#73c0de", "#3ba272", "#fc8452", "#9a60b4", "#ea7ccc"];
const LEGEND_ROW = 16;
const SWATCH = 10;
const SWATCH_GAP = 6;

const graphemeSegmenter =
  typeof Intl !== "undefined" && typeof Intl.Segmenter === "function"
    ? new Intl.Segmenter(undefined, { granularity: "grapheme" })
    : null;

// Split into grapheme clusters so truncation never cuts a flag or ZWJ emoji in half.
function graphemes(text) {
  if (!graphemeSegmenter) return Array.from(text);
  return Array.from(graphemeSegmenter.segment(text), (entry) => entry.segment);
}

function CanvasChart({ items, kind }) {
  const ref = useRef(null);
  const theme = useTheme();
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    let disposed = false;
    const draw = () => {
      if (disposed) return;
      const rect = canvas.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      const ctx = canvas.getContext("2d");
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, rect.width, rect.height);
      const isLight = document.documentElement.dataset.theme === "light";
      const labelColor = isLight ? "#475569" : "#818fa1";
      const barLabelColor = isLight ? "#475569" : "#9ca3af";
      // TwemojiFlags provides the flag glyphs Segoe UI Emoji lacks on Windows.
      ctx.font = CHART_FONT;
      ctx.textAlign = "left";
      ctx.fillStyle = labelColor;
      const truncate = (text, maxW) => {
        if (maxW <= 0) return "";
        if (ctx.measureText(text).width <= maxW) return text;
        const ellipsis = "…";
        const ellipsisWidth = ctx.measureText(ellipsis).width;
        if (ellipsisWidth > maxW) return "";
        let out = "";
        for (const cluster of graphemes(text)) {
          if (ctx.measureText(out + cluster).width + ellipsisWidth > maxW) break;
          out += cluster;
        }
        return out + ellipsis;
      };
      if (!items.length) { ctx.fillText("No data", 12, 24); return; }
      if (kind === "bar") {
        const max = Math.max(...items.map(([, v]) => v), 1);
        const valueWidth = Math.max(...items.map(([, v]) => ctx.measureText(formatBytes(v)).width));
        const chartWidth = Math.max(0, rect.width - valueWidth - 8);
        const row = Math.max(42, (rect.height - 12) / items.length);
        items.forEach(([label, value], i) => {
          const y = i * row + 6;
          const width = Math.max(2, chartWidth * value / max);
          ctx.fillStyle = barLabelColor;
          ctx.textAlign = "left";
          const maxLabelWidth = Math.max(0, chartWidth - 4);
          const displayLabel = truncate(String(label), maxLabelWidth);
          ctx.fillText(displayLabel, 0, y + 10);
          ctx.fillStyle = PALETTE[i % PALETTE.length];
          ctx.fillRect(0, y + 16, width, 14);
          ctx.fillStyle = barLabelColor;
          ctx.textAlign = "right";
          ctx.fillText(formatBytes(value), rect.width, y + 27);
          ctx.textAlign = "left";
        });
      } else {
        const total = items.reduce((s, [, v]) => s + v, 0) || 1;
        const valueWidth = Math.max(...items.map(([, v]) => ctx.measureText(formatBytes(v)).width));
        const labelWidth = Math.max(...items.map(([label]) => ctx.measureText(String(label)).width));
        // Give the legend as much width as its text needs, but keep the pie usable.
        const desiredLegend = SWATCH + SWATCH_GAP + labelWidth + 8 + valueWidth;
        const legendWidth = Math.min(desiredLegend, Math.max(0, rect.width - 56), rect.width * 0.62);
        const gapX = 8;
        const chartWidth = Math.max(0, rect.width - legendWidth - gapX);
        const cx = chartWidth * .5;
        const cy = rect.height / 2;
        const r = Math.max(0, Math.min(chartWidth * .46, cy - 8));
        const legendX = chartWidth + gapX;
        const labelX = legendX + SWATCH + SWATCH_GAP;
        const labelMaxWidth = Math.max(0, rect.width - labelX - valueWidth - 8);
        // Keep the value right next to the longest label instead of pinning it to
        // the far edge of a wide canvas.
        const valueX = Math.max(labelX, Math.min(rect.width - valueWidth, labelX + labelMaxWidth + 8));
        const rowH = Math.min(LEGEND_ROW, Math.max(10, (rect.height - 12) / items.length));
        const startY = Math.max(rowH, cy - (items.length * rowH) / 2 + rowH / 2);
        let angle = -Math.PI / 2;
        items.forEach(([label, value], i) => {
          const y = startY + i * rowH;
          const next = angle + value / total * Math.PI * 2;
          ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, r, angle, next); ctx.closePath();
          const sliceColor = PALETTE[i % PALETTE.length];
          ctx.fillStyle = sliceColor;
          ctx.fill(); angle = next;
          ctx.fillRect(legendX, y - 8, SWATCH, 10);
          ctx.fillStyle = labelColor;
          ctx.textAlign = "left";
          ctx.fillText(truncate(String(label), labelMaxWidth), labelX, y);
          ctx.fillText(formatBytes(value), valueX, y);
        });
      }
    };
    draw();
    window.addEventListener("resize", draw);
    // Font-display: swap means the first draw can beat TwemojiFlags; redraw once it settles.
    if (document.fonts?.load) {
      document.fonts.load(CHART_FONT).then(() => { if (!disposed) draw(); }, () => {});
    }
    if (document.fonts?.ready) {
      document.fonts.ready.then(() => { if (!disposed) draw(); }, () => {});
    }
    return () => {
      disposed = true;
      window.removeEventListener("resize", draw);
    };
  }, [items, kind, theme]);
  return <canvas ref={ref} className="w-full h-full" />;
}

export default function StatisticsChart() {
  const [, redraw] = useState(0);
  useEffect(() => {
    const unsubscribe = subscribeConnections(handleStats);
    return unsubscribe;
  }, []);
  useEffect(() => { const fn = () => redraw((n) => n + 1); listeners.add(fn); return () => listeners.delete(fn); }, []);
  const hosts = Object.entries(globalHostTraffic).sort((a, b) => b[1] - a[1]).slice(0, 10);
  const nodes = Object.entries(globalNodeTraffic).sort((a, b) => b[1] - a[1]).slice(0, 10);
  const clear = () => {
    clearTimeout(persistTimer);
    persistTimer = null;
    globalHostTraffic = {};
    globalNodeTraffic = {};
    globalLastSnapshot = {};
    try {
      localStorage.removeItem("hostTraffic");
      localStorage.removeItem("nodeTraffic");
    } catch {}
    redraw((n) => n + 1);
  };
  return <div className="py-1 relative"><div className="flex flex-col md:flex-row gap-6 md:gap-4 items-start">
    <div className="w-full md:w-3/5 h-[440px] md:h-[480px]"><h2 className="text-sm mb-2 text-cyan-400">Top 10 Hosts</h2><CanvasChart items={hosts} kind="bar" /></div>
    <div className="w-full md:w-2/5 h-[400px] md:h-[480px]"><h2 className="text-sm mb-2 text-pink-400">Top 10 Nodes</h2><CanvasChart items={nodes} kind="pie" /></div>
    <button onClick={clear} className="absolute top-1 right-2 text-gray-400 hover:text-red-500" title="Clear" aria-label="Clear"><svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor" aria-hidden="true"><path d="M6 7h12l-1 14H7L6 7Zm3-3h6l1 2H8l1-2Zm-5 2h16v2H4V6Z" /></svg></button>
  </div></div>;
}
