import { useEffect, useRef, useState } from "react";
import { subscribeTraffic } from "../api";
import { formatSpeed } from "../format";
import useTheme from "../useTheme";

export default function TrafficChart() {
  const canvasRef = useRef(null);
  const [traffic, setTraffic] = useState({ up: 0, down: 0 });
  const dataRef = useRef([]);
  const theme = useTheme();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resizeCanvas = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      const ctx = canvas.getContext("2d");
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(dpr, dpr);
      drawChart();
    };

    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);
    const unsubscribe = subscribeTraffic((data) => {
      setTraffic(data);
      dataRef.current = [...dataRef.current, data].slice(-60);
      drawChart();
    });

    return () => {
      unsubscribe();  
      window.removeEventListener("resize", resizeCanvas);
    };
  }, []);

  const drawChart = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const { width, height } = canvas.getBoundingClientRect();
    if (!width || !height) return;

    ctx.clearRect(0, 0, width, height);

    const isLight = document.documentElement.dataset.theme === "light";
    const gridColor = isLight ? "rgba(38,51,58,0.10)" : "rgba(255,255,255,0.08)";
    const labelColor = isLight ? "rgba(38,51,58,0.55)" : "rgba(255,255,255,0.42)";

    const data = dataRef.current;
    const maxVal = Math.max(...data.map((d) => Math.max(d.up, d.down)), 1);
    const plotTop = 12;
    const plotBottom = Math.max(plotTop + 1, height - 12);
    const plotHeight = plotBottom - plotTop;
    const slotWidth = (width - 6) / 59; // fixed 60-sample window, anchored right
    const sampleX = (index) =>
      width - 6 - (data.length - 1 - index) * slotWidth;
    const sampleY = (value) =>
      plotBottom -
      (Math.min(Math.max(value, 0), maxVal) / maxVal) * plotHeight;

    ctx.font = '10px "TwemojiFlags", sans-serif';
    ctx.textAlign = "left";
    ctx.lineWidth = 1;
    ctx.strokeStyle = gridColor;
    ctx.fillStyle = labelColor;

    const gridCount = 4;
    for (let i = 0; i <= gridCount; i++) {
      const ratio = i / gridCount;
      const y = plotBottom - ratio * plotHeight;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
      if (i === 0) {
        ctx.fillText("0 B/s", 4, height - 2);
      } else {
        ctx.fillText(formatSpeed(maxVal * ratio), 4, Math.max(10, y - 3));
      }
    }

    const drawSeries = (values, stroke, halo, topFill) => {
      if (!values.length) return;
      const trace = () => {
        ctx.beginPath();
        let prevX = sampleX(0);
        let prevY = sampleY(values[0]);
        ctx.moveTo(prevX, prevY);
        for (let i = 1; i < values.length; i++) {
          const x = sampleX(i);
          const y = sampleY(values[i]);
          ctx.quadraticCurveTo(prevX, prevY, (prevX + x) / 2, (prevY + y) / 2);
          prevX = x;
          prevY = y;
        }
        ctx.lineTo(prevX, prevY);
        return { x: prevX, y: prevY };
      };

      const last = trace();
      ctx.lineTo(last.x, plotBottom);
      ctx.lineTo(sampleX(0), plotBottom);
      ctx.closePath();
      const gradient = ctx.createLinearGradient(0, plotTop, 0, plotBottom);
      gradient.addColorStop(0, topFill);
      gradient.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = gradient;
      ctx.fill();

      trace();
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 2;
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(last.x, last.y, 5.5, 0, Math.PI * 2);
      ctx.fillStyle = halo;
      ctx.fill();
      ctx.beginPath();
      ctx.arc(last.x, last.y, 2.5, 0, Math.PI * 2);
      ctx.fillStyle = stroke;
      ctx.fill();
    };

    // Download first so the upload line stays readable on top.
    drawSeries(
      data.map((d) => d.down),
      "#4ade80",
      "rgba(74,222,128,0.16)",
      "rgba(74,222,128,0.30)",
    );
    drawSeries(
      data.map((d) => d.up),
      "#c084fc",
      "rgba(192,132,252,0.18)",
      "rgba(192,132,252,0.32)",
    );
  };

  // Redraw immediately when the theme changes (grid/label colors differ).
  useEffect(() => {
    drawChart();
  }, [theme]);

  return (
    <div className="flex flex-col h-64">
      {/* 实时速率数值 */}
      <div className="flex justify-between text-sm mb-2">
        <span className="text-purple-400">↑ {formatSpeed(traffic.up)}</span>
        <span className="text-green-400">↓ {formatSpeed(traffic.down)}</span>
      </div>

      {/* 曲线图 */}
      <canvas ref={canvasRef} className="w-full flex-1 min-h-0 bg-transparent" />
    </div>
  );
}
