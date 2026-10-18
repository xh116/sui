import { useEffect, useRef, useState } from "react";
import { subscribeConnections } from "../api";
import useTheme from "../useTheme";

let globalLastSnapshot = {};
let globalHostTraffic = JSON.parse(localStorage.getItem("hostTraffic") || "{}");
let globalNodeTraffic = JSON.parse(localStorage.getItem("nodeTraffic") || "{}");
const listeners = new Set();

function handleStats(data) {
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
  localStorage.setItem("hostTraffic", JSON.stringify(globalHostTraffic));
  localStorage.setItem("nodeTraffic", JSON.stringify(globalNodeTraffic));
  listeners.forEach((fn) => fn());
}

const formatBytes = (n) => {
  if (!n) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.min(Math.floor(Math.log(n) / Math.log(1024)), units.length - 1);
  return `${Math.round(n / 1024 ** i)} ${units[i]}`;
};

function CanvasChart({ items, kind }) {
  const ref = useRef(null);
  const theme = useTheme();
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const draw = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      const ctx = canvas.getContext("2d");
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, rect.width, rect.height);
      const isLight = document.documentElement.dataset.theme === "light";
      const labelColor = isLight ? "#475569" : "#818fa1";
      const barLabelColor = isLight ? "#475569" : "#9ca3af";
      ctx.font = "10px sans-serif";
      ctx.fillStyle = labelColor;
      if (!items.length) { ctx.fillText("No data", 12, 24); return; }
      if (kind === "bar") {
        const max = Math.max(...items.map(([, v]) => v), 1);
        const valueWidth = 68;
        const chartWidth = Math.max(0, rect.width - valueWidth - 8);
        const row = Math.max(42, (rect.height - 12) / items.length);
        const palette = ["#5470c6", "#91cc75", "#fac858", "#ee6666", "#73c0de", "#3ba272", "#fc8452", "#9a60b4", "#ea7ccc"];
        items.forEach(([label, value], i) => {
          const y = i * row + 6;
          const width = Math.max(2, chartWidth * value / max);
          ctx.fillStyle = barLabelColor;
          ctx.textAlign = "left";
          const maxLabelWidth = Math.max(0, chartWidth - 4);
          let displayLabel = String(label);
          while (displayLabel.length > 1 && ctx.measureText(displayLabel).width > maxLabelWidth) {
            displayLabel = `${displayLabel.slice(0, -2)}…`;
          }
          ctx.fillText(displayLabel, 0, y + 10);
          ctx.fillStyle = palette[i % palette.length];
          ctx.fillRect(0, y + 16, width, 14);
          ctx.fillStyle = barLabelColor;
          ctx.textAlign = "right";
          ctx.fillText(formatBytes(value), rect.width, y + 27);
          ctx.textAlign = "left";
        });
      } else {
        const total = items.reduce((s, [, v]) => s + v, 0) || 1;
        const legendWidth = Math.max(120, rect.width * .4);
        const chartWidth = Math.max(0, rect.width - legendWidth);
        const cx = chartWidth * .5;
        const cy = rect.height / 2;
        const r = Math.max(0, Math.min(chartWidth * .46, cy - 8));
        const legendX = chartWidth + 8;
        const labelX = legendX + 44;
        const legendY = Math.max(16, cy - items.length * 8 + 5);
        let angle = -Math.PI / 2;
        items.forEach(([label, value], i) => {
          const next = angle + value / total * Math.PI * 2;
          ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, r, angle, next); ctx.closePath();
          const sliceColor = ["#5470c6", "#91cc75", "#fac858", "#ee6666", "#73c0de", "#3ba272", "#fc8452", "#9a60b4", "#ea7ccc"][i % 9];
          ctx.fillStyle = sliceColor;
          ctx.fill(); angle = next;
          ctx.fillRect(legendX, legendY - 8 + i * 16, 36, 10);
          ctx.fillStyle = labelColor;
          const valueText = formatBytes(value);
          const maxLabelWidth = Math.max(0, rect.width - labelX - 4);
          const fullLabel = `${label} ${valueText}`;
          let labelText = fullLabel;
          while (labelText && ctx.measureText(labelText).width > maxLabelWidth) {
            labelText = labelText.slice(0, -1);
          }
          if (labelText !== fullLabel) {
            while (labelText && ctx.measureText(`${labelText}…`).width > maxLabelWidth) {
              labelText = labelText.slice(0, -1);
            }
            labelText = `${labelText}…`;
          }
          ctx.fillText(labelText, labelX, legendY + i * 16);
        });
      }
    };
    draw(); window.addEventListener("resize", draw);
    return () => window.removeEventListener("resize", draw);
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
  const clear = () => { globalHostTraffic = {}; globalNodeTraffic = {}; localStorage.removeItem("hostTraffic"); localStorage.removeItem("nodeTraffic"); redraw((n) => n + 1); };
  return <div className="py-1 relative"><div className="flex flex-col md:flex-row gap-6 md:gap-4 items-start">
    <div className="w-full md:w-3/5 h-[440px] md:h-[480px]"><h2 className="text-sm mb-2 text-cyan-400">Top 10 Hosts</h2><CanvasChart items={hosts} kind="bar" /></div>
    <div className="w-full md:w-2/5 h-[400px] md:h-[480px]"><h2 className="text-sm mb-2 text-pink-400">Top 10 Nodes</h2><CanvasChart items={nodes} kind="pie" /></div>
    <button onClick={clear} className="absolute top-1 right-2 text-gray-400 hover:text-red-500" title="Clear" aria-label="Clear"><svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor" aria-hidden="true"><path d="M6 7h12l-1 14H7L6 7Zm3-3h6l1 2H8l1-2Zm-5 2h16v2H4V6Z" /></svg></button>
  </div></div>;
}
