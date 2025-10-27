import { useEffect, useRef, useState } from "react";
import { subscribeMemory } from "../api/clash";

export default function MemoryChart() {
  const canvasRef = useRef(null);
  const wsRef = useRef(null);
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

    // ✅ 改为使用 unsubscribe 函数
    const unsubscribe = subscribeMemory((m) => {
      const value = m.inuse ?? 0;
      setMemory(value);
      dataRef.current = [...dataRef.current, value].slice(-60);
      drawChart();
    });

    return () => {
      unsubscribe(); // ✅ 替代 wsRef.current?.close()
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

    // --- Baseline (0 B) ---
    ctx.strokeStyle = "rgba(255,255,255,0.2)"; // 更浅的虚线
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(0, height);
    ctx.lineTo(width, height);
    ctx.stroke();
    ctx.font = "10px sans-serif";
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.fillText("0 B", 4, height - 2);

    // --- 5 horizontal grid lines ---
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

    // --- 浅蓝渐变填充 ---
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, "rgba(96,165,250,0.8)"); // blue-400 顶部
    gradient.addColorStop(1, "rgba(96,165,250,0.2)"); // blue-400 底部淡
    ctx.beginPath();
    dataRef.current.forEach((val, i) => {
      const x = i * stepX;
      const y = height - (val / maxVal) * height;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.lineTo(width, height);
    ctx.lineTo(0, height);
    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.fill();

    // --- 曲线边框 (亮蓝) ---
    ctx.beginPath();
    ctx.strokeStyle = "#3b82f6"; // blue-500
    ctx.lineWidth = 2;
    dataRef.current.forEach((val, i) => {
      const x = i * stepX;
      const y = height - (val / maxVal) * height;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.stroke();

    // --- 最新点固定大小圆点 ---
    if (dataRef.current.length > 0) {
      const lastVal = dataRef.current[dataRef.current.length - 1];
      const lastX = (dataRef.current.length - 1) * stepX;
      const lastY = height - (lastVal / maxVal) * height;
      ctx.beginPath();
      ctx.arc(lastX, lastY, 3, 0, Math.PI * 2); // 固定半径 3
      ctx.fillStyle = "#60a5fa"; // blue-400
      ctx.fill();
      ctx.strokeStyle = "#1d4ed8"; // blue-700 边框
      ctx.stroke();
    }
  };

  return (
    <div className="flex flex-col h-64">
      {/* Current memory usage */}
      <div className="text-sm mb-2 text-blue-400">
        Memory Usage: {formatMemory(memory)}
      </div>

      {/* Chart */}
      <canvas ref={canvasRef} className="w-full h-full bg-transparent" />
    </div>
  );
}
