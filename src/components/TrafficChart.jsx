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
      unsubscribe(); // ✅ 清理 WebSocket 连接
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
    ctx.strokeStyle = "rgba(255,255,255,0.2)"; // 更浅的虚线
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

    // --- 上行 (紫色渐变面积) ---
    ctx.beginPath();
    dataRef.current.forEach((d, i) => {
      const x = i * stepX;
      const y = height - (d.up / maxVal) * height;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.lineTo(width, height);
    ctx.lineTo(0, height);
    ctx.closePath();

    const upGradient = ctx.createLinearGradient(0, 0, 0, height);
    upGradient.addColorStop(0, "rgba(192,132,252,0.8)");
    upGradient.addColorStop(1, "rgba(192,132,252,0.2)");
    ctx.fillStyle = upGradient;
    ctx.fill();

    // 上行曲线
    ctx.beginPath();
    ctx.strokeStyle = "#c084fc";
    ctx.lineWidth = 2;
    dataRef.current.forEach((d, i) => {
      const x = i * stepX;
      const y = height - (d.up / maxVal) * height;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.stroke();

    // 最新点小圆点
    if (dataRef.current.length > 0) {
      const last = dataRef.current[dataRef.current.length - 1];
      const lastX = (dataRef.current.length - 1) * stepX;
      const lastY = height - (last.up / maxVal) * height;
      ctx.beginPath();
      ctx.arc(lastX, lastY, 3, 0, Math.PI * 2); // 固定半径 3
      ctx.fillStyle = "#e879f9"; // 亮紫
      ctx.fill();
      ctx.strokeStyle = "#a855f7"; // 深紫边框
      ctx.stroke();
    }

    // --- 下行 (绿色渐变面积) ---
    ctx.beginPath();
    dataRef.current.forEach((d, i) => {
      const x = i * stepX;
      const y = height - (d.down / maxVal) * height;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.lineTo(width, height);
    ctx.lineTo(0, height);
    ctx.closePath();

    const downGradient = ctx.createLinearGradient(0, 0, 0, height);
    downGradient.addColorStop(0, "rgba(74,222,128,0.8)");
    downGradient.addColorStop(1, "rgba(74,222,128,0.2)");
    ctx.fillStyle = downGradient;
    ctx.fill();

    // 下行曲线
    ctx.beginPath();
    ctx.strokeStyle = "#4ade80";
    ctx.lineWidth = 2;
    dataRef.current.forEach((d, i) => {
      const x = i * stepX;
      const y = height - (d.down / maxVal) * height;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.stroke();

    // 最新点小圆点
    if (dataRef.current.length > 0) {
      const last = dataRef.current[dataRef.current.length - 1];
      const lastX = (dataRef.current.length - 1) * stepX;
      const lastY = height - (last.down / maxVal) * height;
      ctx.beginPath();
      ctx.arc(lastX, lastY, 3, 0, Math.PI * 2); // 固定半径 3
      ctx.fillStyle = "#86efac"; // 亮绿
      ctx.fill();
      ctx.strokeStyle = "#15803d"; // 深绿边框
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
