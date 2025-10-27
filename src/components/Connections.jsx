import { useEffect, useMemo, useState } from "react";
import { subscribeConnections, closeAllConnections } from "../api/clash";

// 累计字节数显示（B / KB / MB / GB）
function formatBytes(bytes) {
  if (!bytes || bytes < 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
}

// 速率显示（B/s / KB/s / MB/s / GB/s）
function formatSpeed(bytesPerSec) {
  const n = bytesPerSec || 0;
  if (n < 1024) return `${Math.round(n)} B/s`;
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(1)} KB/s`;
  if (n < 1024 ** 3) return `${(n / 1024 ** 2).toFixed(1)} MB/s`;
  return `${(n / 1024 ** 3).toFixed(1)} GB/s`;
}

export default function Connections() {
  const [conns, setConns] = useState([]);
  const [uploadTotal, setUploadTotal] = useState(0);
  const [downloadTotal, setDownloadTotal] = useState(0);

  const [seenIds, setSeenIds] = useState(new Set());
  const [lastSnapshot, setLastSnapshot] = useState({}); // { id: { upload, download, time, upSpeed, downSpeed } }

  const [sortKey, setSortKey] = useState("latest"); // source | destination | host | proxy | upload | download | upSpeed | downSpeed | type | latest
  const [sortDir, setSortDir] = useState("desc"); // asc | desc
  const [filterText, setFilterText] = useState("");

  // 建立一次订阅，计算速率，更新统计
  useEffect(() => {
    const ws = subscribeConnections((data) => {
      const list = data.connections || [];
      setConns(list);
      setUploadTotal(data.uploadTotal || 0);
      setDownloadTotal(data.downloadTotal || 0);

      // 记录出现过的连接 ID，用于计算 Closed
      setSeenIds((prev) => {
        const next = new Set(prev);
        list.forEach((c) => next.add(c.id));
        return next;
      });

      // 速率计算：基于上一帧的 snapshot
      setLastSnapshot((prev) => {
        const now = Date.now();
        const next = {};
        list.forEach((c) => {
          const p = prev[c.id];
          const dt = p ? now - p.time : null;

          if (p && dt != null && dt < 600) {
            next[c.id] = { ...p }; // 保持上次速率，不更新
          } else {
            const seconds = Math.max(0.001, dt / 1000);
            next[c.id] = {
              upload: c.upload,
              download: c.download,
              time: now,
              upSpeed: p ? Math.max(0, (c.upload - p.upload) / seconds) : 0,
              downSpeed: p
                ? Math.max(0, (c.download - p.download) / seconds)
                : 0,
            };
          }
        });
        return next;
      });
    });

    return () => {
      try {
        ws && ws.close && ws.close();
      } catch {}
    };
  }, []);

  const activeCount = conns.length;
  const closedCount = Math.max(0, seenIds.size - activeCount);

  // 简单过滤：在 host/type/src/dst/proxy chain 中做包含匹配
  const filteredConns = useMemo(() => {
    const s = (filterText || "").trim().toLowerCase();
    if (!s) return conns;
    return conns.filter((c) => {
      const hay = [
        c.metadata.host || "",
        c.metadata.type || "",
        `${c.metadata.sourceIP}:${c.metadata.sourcePort}`,
        `${c.metadata.destinationIP}:${c.metadata.destinationPort}`,
        (c.chains || []).join(" "),
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(s);
    });
  }, [conns, filterText]);

  // 排序（包含速率列），默认 latest（start 时间）降序
  const sortedConns = useMemo(() => {
    const list = [...filteredConns];
    list.sort((a, b) => {
      let valA, valB;

      switch (sortKey) {
        case "source":
          valA = `${a.metadata.sourceIP}:${a.metadata.sourcePort}`;
          valB = `${b.metadata.sourceIP}:${b.metadata.sourcePort}`;
          break;
        case "destination":
          valA = `${a.metadata.destinationIP}:${a.metadata.destinationPort}`;
          valB = `${b.metadata.destinationIP}:${b.metadata.destinationPort}`;
          break;
        case "host":
          valA = a.metadata.host || "";
          valB = b.metadata.host || "";
          break;
        case "proxy":
          valA = (a.chains || []).join(",");
          valB = (b.chains || []).join(",");
          break;
        case "upload":
          valA = a.upload || 0;
          valB = b.upload || 0;
          break;
        case "download":
          valA = a.download || 0;
          valB = b.download || 0;
          break;
        case "upSpeed":
          valA = lastSnapshot[a.id]?.upSpeed || 0;
          valB = lastSnapshot[b.id]?.upSpeed || 0;
          break;
        case "downSpeed":
          valA = lastSnapshot[a.id]?.downSpeed || 0;
          valB = lastSnapshot[b.id]?.downSpeed || 0;
          break;
        case "type":
          valA = a.metadata.type || "";
          valB = b.metadata.type || "";
          break;
        case "latest":
        default:
          valA = new Date(a.start).getTime() || 0;
          valB = new Date(b.start).getTime() || 0;
          break;
      }

      // 字符串与数字统一比较
      if (typeof valA === "string" && typeof valB === "string") {
        const res = valA.localeCompare(valB);
        return sortDir === "asc" ? res : -res;
      }
      if (valA < valB) return sortDir === "asc" ? -1 : 1;
      if (valA > valB) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return list;
  }, [filteredConns, sortKey, sortDir, lastSnapshot]);

  const handleSort = (key) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  const handleCloseAll = async () => {
    try {
      await closeAllConnections();
    } catch {}
  };

  return (
    <div className="p-1 text-white">
      {/* 标题与操作 */}
      <div className="flex justify-between items-center mb-3">
        <h1 className="text-xl font-bold">Connections</h1>
        <button
          onClick={handleCloseAll}
          className="
            px-3 py-1 rounded text-sm text-white
            bg-gradient-to-r from-red-600/70 to-pink-500/70
            hover:from-red-600/80 hover:to-pink-400/60
            transition-colors duration-200"
        >
          Close All
        </button>
      </div>

      {/* 统计 + 搜索框 */}
      <div className="mb-3 flex flex-wrap items-center gap-4">
        <div className="text-xs text-gray-300 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-4 mb-2">
          {/* 连接状态 */}
          <div className="flex gap-2">
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded-full bg-green-500"></span>
              Active: {activeCount}
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded-full bg-gray-500"></span>
              Closed: {closedCount}
            </span>
          </div>

          {/* 流量统计 */}
          <div className="flex gap-3 text-[11px] sm:text-xs text-gray-400">
            <span className="text-purple-400 font-normal">
              ↑ {formatBytes(uploadTotal)}
            </span>
            <span className="text-green-400 font-normal">
              ↓ {formatBytes(downloadTotal)}
            </span>
          </div>
        </div>

        <input
          type="text"
          value={filterText}
          onChange={(e) => setFilterText(e.target.value)}
          placeholder="Filter..."
          className="flex-1 min-w-[220px] px-3 py-2 rounded-lg bg-gray-800/80 border border-gray-700 text-xs text-gray-500 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent"
        />
      </div>

      {/* 表格 */}
      {/* 桌面表格布局 */}
      <div className="hidden md:block overflow-x-auto whitespace-nowrap overflow-hidden">
        <table className="w-full text-xs">
          <thead className="bg-gradient-to-r from-blue-900/80 to-blue-800/40 text-left text-gray-200">
            <tr>
              <th
                className="px-2 py-1 cursor-pointer hover:text-accent"
                onClick={() => handleSort("source")}
              >
                Source
              </th>
              <th
                className="px-2 py-1 cursor-pointer hover:text-accent"
                onClick={() => handleSort("destination")}
              >
                Destination
              </th>
              <th
                className="px-2 py-1 cursor-pointer hover:text-accent"
                onClick={() => handleSort("proxy")}
              >
                Proxy Chain
              </th>
              <th
                className="px-2 py-1 cursor-pointer hover:text-accent"
                onClick={() => handleSort("upload")}
              >
                ↑ Upload
              </th>
              <th
                className="px-2 py-1 cursor-pointer hover:text-accent"
                onClick={() => handleSort("download")}
              >
                ↓ Download
              </th>
              <th
                className="px-2 py-1 cursor-pointer hover:text-accent"
                onClick={() => handleSort("upSpeed")}
              >
                ↑ Speed
              </th>
              <th
                className="px-2 py-1 cursor-pointer hover:text-accent"
                onClick={() => handleSort("downSpeed")}
              >
                ↓ Speed
              </th>
              <th
                className="px-2 py-1 cursor-pointer hover:text-accent"
                onClick={() => handleSort("type")}
              >
                Type
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedConns.map((c) => {
              const snap = lastSnapshot[c.id] || { upSpeed: 0, downSpeed: 0 };
              return (
                <tr
                  key={c.id}
                  className="border-t text-gray-400 border-gray-700 hover:bg-blue-900/30"
                >
                  <td className="px-2 py-1">
                    {c.metadata.sourceIP}:{c.metadata.sourcePort}
                  </td>
                  <td className="px-2 py-1">
                    {c.metadata.host
                      ? `${c.metadata.host}${c.metadata.destinationPort ? `:${c.metadata.destinationPort}` : ""} `
                      : ""}
                    {c.metadata.destinationIP
                      ? `${c.metadata.destinationIP}${c.metadata.destinationPort ? `:${c.metadata.destinationPort}` : ""}`
                      : ""}
                  </td>
                  <td className="px-2 py-1">
                    {(c.chains || []).slice().reverse().join(" → ")}
                  </td>
                  <td className="px-2 py-1">{formatBytes(c.upload)}</td>
                  <td className="px-2 py-1">{formatBytes(c.download)}</td>
                  <td className="px-2 py-1 text-purple-400">
                    {formatSpeed(snap.upSpeed)}
                  </td>
                  <td className="px-2 py-1 text-green-400">
                    {formatSpeed(snap.downSpeed)}
                  </td>
                  <td className="px-2 py-1">{c.metadata.type}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* 移动卡片布局 */}
      <div className="block md:hidden space-y-1">
        {sortedConns.map((c) => {
          const snap = lastSnapshot[c.id] || { upSpeed: 0, downSpeed: 0 };
          const source = `${c.metadata.sourceIP}:${c.metadata.sourcePort}`;
          const destination = c.metadata.host
            ? `${c.metadata.host}${c.metadata.destinationPort ? `:${c.metadata.destinationPort}` : ""}`
            : `${c.metadata.destinationIP}${c.metadata.destinationPort ? `:${c.metadata.destinationPort}` : ""}`;
          const proxyChain = (c.chains || []).slice().reverse().join(" → ");
          const type = c.metadata.type || "—";

          return (
            <div
              key={c.id}
              className="bg-gray-800/60 rounded-lg p-2 text-[10px] text-gray-300 shadow-md relative"
            >
              {/* 右上角：速率 */}
              <div className="absolute top-2 right-3 text-right  text-[10px] leading-tight">
                <div className="text-purple-400">
                  ↑ {formatSpeed(snap.upSpeed)}
                </div>
                <div className="text-green-400">
                  ↓ {formatSpeed(snap.downSpeed)}
                </div>
              </div>

              {/* 主体信息：左对齐内容 */}
              <div className="space-y-1 pr-20">
                <div className="break-all">{destination}</div>
                <div className="break-all">{source}</div>
                <div className="break-all">{proxyChain}</div>
              </div>

              {/* 右下角：类型 */}
              <div className="absolute bottom-2 right-3 text-[10px] text-gray-400">
                {type}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
