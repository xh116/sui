import { useEffect, useRef, useState } from "react";
import { subscribeTraffic } from "../api/clash";

export default function TrafficChart() {
  const canvasRef = useRef(null);
  const [traffic, setTraffic] = useState({ up: 0, down: 0 });
  const dataRef = useRef([]);

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

  const formatSpeed = (bytesPerSec) => {
    if (bytesPerSec < 1024) return `${Math.round(bytesPerSec)} B/s`;
    const kb = bytesPerSec / 1024;
    if (kb < 1024) return `${kb.toFixed(1)} KB/s`;
    const mb = kb / 1024;
    if (mb < 1024) return `${mb.toFixed(1)} MB/s`;
    const gb = mb / 1024;
    return `${gb.toFixed(1)} GB/s`;
  };

  const drawChart = () => {
  const canvas = canvasRef.current;
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const { width, height } = canvas.getBoundingClientRect();

  ctx.clearRect(0, 0, width, height);

  const maxVal = Math.max(
    ...dataRef.current.map((d) => Math.max(d.up, d.down)),
    1,
  );
  const stepX = width / (dataRef.current.length || 1);

  // --- 基准线 (0 B/s) ---
  ctx.strokeStyle = "rgba(255,255,255,0.2)";
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(0, height);
  ctx.lineTo(width, height);
  ctx.stroke();
  ctx.font = "10px sans-serif";
  ctx.fillStyle = "rgba(255,255,255,0.5)";
  ctx.fillText("0 B/s", 4, height - 2);

  // --- 5 条等分虚线 ---
  const gridCount = 5;
  for (let i = 1; i <= gridCount; i++) {
    const value = (maxVal / gridCount) * i;
    const y = height - (value / maxVal) * height;

    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();

    ctx.fillText(formatSpeed(value), 4, y - 2);
  }
  ctx.setLineDash([]);

  // --- 平滑绘制函数 ---
 const drawSmoothArea = (ctx, data, gradientColors) => {
  if (!data.length) return;
  const height = canvasRef.current.getBoundingClientRect().height;

  // --- 绘制面积 ---
  ctx.beginPath();
  // 从底部开始闭合
  ctx.moveTo(0, height);
  ctx.lineTo(0, height - (data[0] / maxVal) * height); // 第一个数据点

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
  ctx.lineTo(lastX, height); // 回到底部闭合
  ctx.closePath();

  // 渐变填充
  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, gradientColors[0]);
  gradient.addColorStop(1, gradientColors[1]);
  ctx.fillStyle = gradient;
  ctx.fill();

  // --- 绘制曲线描边 ---
  ctx.beginPath();
  ctx.moveTo(0, height - (data[0] / maxVal) * height); // 第一个点和圆点完全对齐
  for (let i = 0; i < data.length - 1; i++) {
    const x0 = i * stepX;
    const y0 = height - (data[i] / maxVal) * height;
    const x1 = (i + 1) * stepX;
    const y1 = height - (data[i + 1] / maxVal) * height;
    const cx = (x0 + x1) / 2;
    const cy = (y0 + y1) / 2;
    ctx.quadraticCurveTo(x0, y0, cx, cy);
  }
  ctx.lineTo(lastX, lastY); // 确保最后一点和圆点对齐
  ctx.stroke();
};

  // --- 上行 ---
  ctx.strokeStyle = "#c084fc";
  ctx.lineWidth = 2;
  drawSmoothArea(ctx, dataRef.current.map(d => d.up), ["rgba(192,132,252,0.8)", "rgba(192,132,252,0.2)"]);

  // 上行最新点
  if (dataRef.current.length > 0) {
    const last = dataRef.current[dataRef.current.length - 1];
    const lastX = (dataRef.current.length - 1) * stepX;
    const lastY = height - (last.up / maxVal) * height;
    ctx.beginPath();
    ctx.arc(lastX, lastY, 3, 0, Math.PI * 2);
    ctx.fillStyle = "#e879f9";
    ctx.fill();
    ctx.strokeStyle = "#a855f7";
    ctx.stroke();
  }

  // --- 下行 ---
  ctx.strokeStyle = "#4ade80";
  ctx.lineWidth = 2;
  drawSmoothArea(ctx, dataRef.current.map(d => d.down), ["rgba(74,222,128,0.8)", "rgba(74,222,128,0.2)"]);

  // 下行最新点
  if (dataRef.current.length > 0) {
    const last = dataRef.current[dataRef.current.length - 1];
    const lastX = (dataRef.current.length - 1) * stepX;
    const lastY = height - (last.down / maxVal) * height;
    ctx.beginPath();
    ctx.arc(lastX, lastY, 3, 0, Math.PI * 2);
    ctx.fillStyle = "#86efac";
    ctx.fill();
    ctx.strokeStyle = "#15803d";
    ctx.stroke();
  }
};

  return (
    <div className="flex flex-col h-64">
      {/* 实时速率数值 */}
      <div className="flex justify-between text-sm mb-2">
        <span className="text-purple-400">↑ {formatSpeed(traffic.up)}</span>
        <span className="text-green-400">↓ {formatSpeed(traffic.down)}</span>
      </div>

      {/* 曲线图 */}
      <canvas ref={canvasRef} className="w-full h-full bg-transparent" />
    </div>
  );
}
