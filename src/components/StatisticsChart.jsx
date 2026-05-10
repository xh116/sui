import { Bar, Pie } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Tooltip,
  Legend,
} from "chart.js";
import { useEffect, useState } from "react";
import { subscribeConnections } from "../api/clash";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Tooltip,
  Legend,
);

// --- 全局静态变量 ---
let globalUnsubscribeStats = null;
let globalLastSnapshot = {};
let globalHostTraffic = {};
let globalNodeTraffic = {};
let globalStatsListeners = [];

// --- 初始化 localStorage ---
const savedHost = localStorage.getItem("hostTraffic");
const savedNode = localStorage.getItem("nodeTraffic");
if (savedHost) globalHostTraffic = JSON.parse(savedHost);
if (savedNode) globalNodeTraffic = JSON.parse(savedNode);

// --- 全局订阅，只执行一次 ---
if (!globalUnsubscribeStats) {
  globalUnsubscribeStats = subscribeConnections((data) => {
    const newSnapshot = {};

    (data.connections || []).forEach((c) => {
      const id = c.id;
      const hasHost = c.metadata?.host && c.metadata.host.trim() !== "";

      const rule =
        c.chains && c.chains.length > 0
          ? c.chains[c.chains.length - 1]
          : "UNKNOWN";

      const host = hasHost
        ? `${rule} | ${c.metadata.host}`
        : `${rule} | ${c.metadata?.destinationIP || "unknown"}:${c.metadata?.destinationPort || ""}`;

      const firstChain =
        c.chains && c.chains.length > 0 ? c.chains[0] : "UNKNOWN";

      const totalBytes = (c.upload || 0) + (c.download || 0);

      if (globalLastSnapshot[id] === undefined) {
        newSnapshot[id] = totalBytes;
        return;
      }

      const delta = Math.max(0, totalBytes - globalLastSnapshot[id]);

      if (delta > 0) {
        globalHostTraffic[host] = (globalHostTraffic[host] || 0) + delta;
        globalNodeTraffic[firstChain] =
          (globalNodeTraffic[firstChain] || 0) + delta;

        localStorage.setItem("hostTraffic", JSON.stringify(globalHostTraffic));
        localStorage.setItem("nodeTraffic", JSON.stringify(globalNodeTraffic));
      }

      newSnapshot[id] = totalBytes;
    });

    globalLastSnapshot = newSnapshot;

    // 通知所有 StatisticsChart 页面更新
    globalStatsListeners.forEach((fn) => fn());
  });
}

export default function StatisticsChart() {
  const [hostTraffic, setHostTraffic] = useState(globalHostTraffic);
  const [nodeTraffic, setNodeTraffic] = useState(globalNodeTraffic);

  // 页面监听全局数据
  useEffect(() => {
    const listener = () => {
      setHostTraffic({ ...globalHostTraffic });
      setNodeTraffic({ ...globalNodeTraffic });
    };

    globalStatsListeners.push(listener);
    listener(); // 初次同步

    return () => {
      globalStatsListeners = globalStatsListeners.filter(
        (fn) => fn !== listener,
      );
    };
  }, []);

  // Top10 Hosts
  const topHosts = Object.entries(hostTraffic)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  // Top10 节点
  const topNodes = Object.entries(nodeTraffic)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  const colors = [
    "#60a5fa",
    "#34d399",
    "#f87171",
    "#fbbf24",
    "#a78bfa",
    "#f472b6",
    "#10b981",
    "#f59e0b",
    "#3b82f6",
    "#ef4444",
  ];

  const barData = {
    labels: topHosts.map(([host]) => host),
    datasets: [
      {
        label: "hostsDataUsage",
        data: topHosts.map(([_, bytes]) => bytes),
        backgroundColor: topHosts.map((_, i) => colors[i % colors.length]),
        borderRadius: 8,
        barThickness: window.innerWidth < 640 ? 14 : 18,
        barPercentage: 0.6,
        categoryPercentage: 1.2,
      },
    ],
  };

  const pieData = {
    labels: topNodes.map(([node]) => node),
    datasets: [
      {
        label: "nodesDataUsage",
        data: topNodes.map(([_, bytes]) => bytes),
        backgroundColor: topNodes.map(
          (_, i) => colors.slice().reverse()[i % colors.length],
        ),
      },
    ],
  };

  function formatBytes(bytes) {
    if (!bytes || bytes < 0) return "0 B";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
    return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
  }

  const clearLocalStorage = () => {
    localStorage.removeItem("hostTraffic");
    localStorage.removeItem("nodeTraffic");
    globalHostTraffic = {};
    globalNodeTraffic = {};
    setHostTraffic({});
    setNodeTraffic({});
  };

  const customLabels = {
    id: "customLabels",
    afterDatasetsDraw(chart) {
      const { ctx } = chart;
      ctx.save();

      const offset = window.innerWidth < 640 ? 8 : 10;
      const fontSize = window.innerWidth < 640 ? 8 : 10;
      const rightPadding = window.innerWidth < 640 ? 20 : 6;

      chart.getDatasetMeta(0).data.forEach((bar, index) => {
        const fullLabel = chart.data.labels[index];
        const value = chart.data.datasets[0].data[index];

        ctx.fillStyle = "#818fa1";
        ctx.font = `${fontSize}px sans-serif`;
        ctx.textAlign = "left";
        ctx.textBaseline = "bottom";
        ctx.fillText(fullLabel, bar.base, bar.y - offset);

        ctx.textAlign = "right";
        ctx.textBaseline = "middle";
        ctx.fillText(
          formatBytes(value),
          chart.scales.x.right - rightPadding,
          bar.y,
        );
      });

      ctx.restore();
    },
  };

  const barOptions = {
    indexAxis: "y",
    responsive: true,
    plugins: { legend: { display: false }, tooltip: { enabled: false } },
    layout: { padding: { top: 10, right: 40 } },
    scales: { x: { display: false, grace: "20%" }, y: { display: false } },
  };

  const pieOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: "right",
        labels: {
          color: "#818fa1",  
          font: { size: 10 },  
          generateLabels: (chart) => {
            const data = chart.data;
            if (data.labels.length) {
              return data.labels.map((label, i) => {
                const value = data.datasets[0].data[i];
                return {
                  text: `${label}  ${formatBytes(value)}`,  
                  fillStyle: data.datasets[0].backgroundColor[i],
                  strokeStyle: data.datasets[0].backgroundColor[i],
                  fontColor: "#818fa1",
                  hidden: false,
                  index: i,
                };
              });
            }
            return [];
          },
        },
        onClick: null,  
      },
      tooltip: { enabled: false },  
    },
  };

  return (
    <div className="py-1 flex flex-col relative">
      <div className="flex flex-col md:flex-row gap-2 md:gap-2 h-full">
        <div className="w-full md:w-3/5  h-[400px] md:h-[480px]">
          <h2 className="text-sm mb-2 text-cyan-400 mt-2">Top 10 Hosts</h2>
          <Bar
            data={barData}
            options={{ ...barOptions, maintainAspectRatio: false }}
            plugins={[customLabels]}
          />
        </div>

        <div className="w-full md:w-2/5 h-[240px] mt-10 md:h-[360px]">
          <h2 className="text-sm mb-2 text-pink-400 md:mt-2">Top 10 Nodes</h2>
          <Pie
            data={pieData}
            options={{ ...pieOptions, maintainAspectRatio: false }}
          />
        </div>

        <button
          onClick={clearLocalStorage}
          className="absolute top-1 right-2 p-1 rounded transition-colors duration-200"
          title="Clear"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-4 w-4 text-gray-400 hover:text-red-500"
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <path
              d="M9 3V4H4V6H20V4H15V3H9Z
                   M6 7V20C6 21.1 6.9 22 8 22H16C17.1 22 18 21.1 18 20V7H6Z
                   M9 9H11V19H9V9Z
                   M13 9H15V19H13V9Z"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}
