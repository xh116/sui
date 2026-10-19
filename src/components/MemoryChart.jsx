import { useEffect, useRef, useState } from "react";
import { subscribeMemory } from "../api";
import { formatBytes } from "../format";
import useTheme from "../useTheme";

export default function MemoryChart() {
  const canvasRef = useRef(null);
  const [memory, setMemory] = useState(0);
  const dataRef = useRef([]);
  const theme = useTheme();

  useEffect(() => {
    const resizeCanvas = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
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

    const unsubscribe = subscribeMemory((m) => {
      const value = m.inuse ?? 0;
      setMemory(value);

      // 保持最多 60 个数据点
      dataRef.current.push(value);
      if (dataRef.current.length > 60) dataRef.current.shift();

      drawChart();
    });

    return () => {
      unsubscribe();
      window.removeEventListener("resize", resizeCanvas);
    };
  }, []);

  const formatMemory = (bytes) => formatBytes(bytes, 0, 3);

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
    const maxVal = Math.max(...data, 1);
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
        ctx.fillText("0 B", 4, height - 2);
      } else {
        ctx.fillText(formatMemory(maxVal * ratio), 4, Math.max(10, y - 3));
      }
    }

    if (!data.length) return;

    const trace = () => {
      ctx.beginPath();
      let prevX = sampleX(0);
      let prevY = sampleY(data[0]);
      ctx.moveTo(prevX, prevY);
      for (let i = 1; i < data.length; i++) {
        const x = sampleX(i);
        const y = sampleY(data[i]);
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
    gradient.addColorStop(0, "rgba(96,165,250,0.30)");
    gradient.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = gradient;
    ctx.fill();

    trace();
    ctx.strokeStyle = "#60a5fa";
    ctx.lineWidth = 2;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(last.x, last.y, 5.5, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(96,165,250,0.18)";
    ctx.fill();
    ctx.beginPath();
    ctx.arc(last.x, last.y, 2.5, 0, Math.PI * 2);
    ctx.fillStyle = "#60a5fa";
    ctx.fill();
  };

  // Redraw immediately when the theme changes (grid/label colors differ).
  useEffect(() => {
    drawChart();
  }, [theme]);

  return (
    <div className="flex flex-col h-64">
      <div className="text-sm mb-2 text-blue-400">
        Memory Usage: {formatMemory(memory)}
      </div>
      <canvas ref={canvasRef} className="w-full flex-1 min-h-0 bg-transparent" />
    </div>
  );
}
