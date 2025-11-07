import { useEffect, useRef, useState } from "react";
import { subscribeMemory } from "../api/clash";

export default function MemoryChart() {
  const canvasRef = useRef(null);
  const [memory, setMemory] = useState(0);
  const dataRef = useRef([]);

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

  const formatMemory = (bytes) => {
    if (bytes < 1024) return `${Math.round(bytes)} B`;
    const kb = bytes / 1024;
    if (kb < 1024) return `${Math.round(kb)} KB`;
    const mb = kb / 1024;
    if (mb < 1024) return `${Math.round(mb)} MB`;
    const gb = mb / 1024;
    return `${Math.round(gb)} GB`;
  };

  const drawChart = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const { width, height } = canvas.getBoundingClientRect();
    ctx.clearRect(0, 0, width, height);

    const maxVal = Math.max(...dataRef.current, 1);
    const stepX = width / (dataRef.current.length || 1);

    // --- Grid lines ---
    ctx.strokeStyle = "rgba(255,255,255,0.2)";
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(0, height);
    ctx.lineTo(width, height);
    ctx.stroke();

    ctx.font = "10px sans-serif";
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.fillText("0 B", 4, height - 2);

    const gridCount = 5;
    for (let i = 1; i <= gridCount; i++) {
      const value = (maxVal / gridCount) * i;
      const y = height - (value / maxVal) * height;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
      ctx.fillText(formatMemory(value), 4, y - 2);
    }
    ctx.setLineDash([]);

    // --- 平滑曲线 + 渐变面积函数 ---
  const drawSmoothArea = (data, gradientColors, strokeColor) => {
      if (!data.length) return;

      // 面积填充
      ctx.beginPath();
      ctx.moveTo(0, height); // 底部开始
      ctx.lineTo(0, height - (data[0] / maxVal) * height);

      for (let i = 0; i < data.length - 1; i++) {
        const x0 = i * stepX;
        const y0 = height - (data[i] / maxVal) * height;
        const x1 = (i + 1) * stepX;
        const y1 = height - (data[i + 1] / maxVal) * height;
        const cx = (x0 + x1) / 2;
        const cy = (y0 + y1) / 2;
        ctx.quadraticCurveTo(x0, y0, cx, cy);
      }

      const lastX = (data.length - 1) * stepX;
      const lastY = height - (data[data.length - 1] / maxVal) * height;
      ctx.lineTo(lastX, lastY);
      ctx.lineTo(lastX, height);
      ctx.closePath();

      const gradient = ctx.createLinearGradient(0, 0, 0, height);
      gradient.addColorStop(0, gradientColors[0]);
      gradient.addColorStop(1, gradientColors[1]);
      ctx.fillStyle = gradient;
      ctx.fill();

      // 曲线描边
      ctx.beginPath();
      ctx.moveTo(0, height - (data[0] / maxVal) * height);
      for (let i = 0; i < data.length - 1; i++) {
        const x0 = i * stepX;
        const y0 = height - (data[i] / maxVal) * height;
        const x1 = (i + 1) * stepX;
        const y1 = height - (data[i + 1] / maxVal) * height;
        const cx = (x0 + x1) / 2;
        const cy = (y0 + y1) / 2;
        ctx.quadraticCurveTo(x0, y0, cx, cy);
      }
      ctx.lineTo(lastX, lastY);
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = 2;
      ctx.stroke();

      // 最新点圆点
      ctx.beginPath();
      ctx.arc(lastX, lastY, 3, 0, Math.PI * 2);
      ctx.fillStyle = gradientColors[0];
      ctx.fill();
      ctx.strokeStyle = strokeColor;
      ctx.stroke();
    };

    drawSmoothArea(
      dataRef.current,
      ["rgba(96,165,250,0.8)", "rgba(96,165,250,0.2)"],
      "#3b82f6"
    );
  };

  return (
    <div className="flex flex-col h-64">
      <div className="text-sm mb-2 text-blue-400">
        Memory Usage: {formatMemory(memory)}
      </div>
      <canvas ref={canvasRef} className="w-full h-full bg-transparent" />
    </div>
  );
}
