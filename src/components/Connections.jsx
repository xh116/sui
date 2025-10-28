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
  const [lastSnapshot, setLastSnapshot] = useState({});
  const [sortKey, setSortKey] = useState("latest");
  const [sortDir, setSortDir] = useState("desc");
  const [filterText, setFilterText] = useState("");

  // 订阅连接
  useEffect(() => {
    const ws = subscribeConnections((data) => {
      const list = data.connections || [];
      setConns(list);

      const now = Date.now();
      setLastSnapshot((prev) => {
        const next = {};
        list.forEach((c) => {
          const p = prev[c.id];
          const dt = p ? now - p.time : null;
          const seconds = dt ? Math.max(0.001, dt / 1000) : 1;
          next[c.id] = {
            upload: c.upload,
            download: c.download,
            time: now,
            upSpeed: p ? Math.max(0, (c.upload - p.upload) / seconds) : 0,
            downSpeed: p ? Math.max(0, (c.download - p.download) / seconds) : 0,
          };
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

  // 过滤
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

  // 排序
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
        case "proxy":
          valA = (a.chains || []).join(",");
          valB = (b.chains || []).join(",");
          break;
        case "host":
          valA = a.metadata.host || "";
          valB = b.metadata.host || "";
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
        case "network":
          valA = (a.metadata.network || "").toUpperCase();
          valB = (b.metadata.network || "").toUpperCase();
          break;
        case "type":
          valA = a.metadata.type || "";
          valB = b.metadata.type || "";
          break;
        default:
          valA = new Date(a.start).getTime() || 0;
          valB = new Date(b.start).getTime() || 0;
      }
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
    <div className="p-2 text-white">
      {/* 标题 + 关闭按钮 */}
      <div className="flex justify-between items-center mb-3">
        <h1 className="text-xl font-bold">Connections</h1>
        <button
          onClick={handleCloseAll}
          className="px-3 py-1 rounded text-sm text-white bg-gradient-to-r from-red-600/70 to-pink-500/70 hover:from-red-600/80 hover:to-pink-400/60 transition-colors duration-200"
        >
          Close All
        </button>
      </div>

      {/* 搜索框 */}
      <input
        type="text"
        value={filterText}
        onChange={(e) => setFilterText(e.target.value)}
        placeholder="Filter..."
        className="w-full mb-2 px-3 py-2 rounded-lg bg-gray-800/80 border border-gray-700 text-xs text-gray-500 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent"
      />

      {/* 排序按钮 */}
      <div className="flex flex-wrap gap-2 mb-2 text-[10px]">
        {[
          "Source",
          "Destination",
          "Host",
          "Proxy",
          "Upload",
          "Download",
          "UpSpeed",
          "DownSpeed",
          "Network",
          "Type",
        ].map((key) => (
          <button
            key={key}
            onClick={() => handleSort(key)}
            className={`px-2 py-1 rounded bg-gray-700/50 hover:bg-gray-600/60 ${
              sortKey === key ? "bg-blue-600 text-white" : ""
            }`}
          >
            {key} {sortKey === key ? (sortDir === "asc" ? "↑" : "↓") : ""}
          </button>
        ))}
      </div>

      {/* 卡片布局 */}
      <div className="space-y-1">
        {sortedConns.map((c) => {
          const snap = lastSnapshot[c.id] || { upSpeed: 0, downSpeed: 0 };
          const source = `${c.metadata.sourceIP}:${c.metadata.sourcePort}`;
          const destination = c.metadata.host
            ? `${c.metadata.host}${c.metadata.destinationPort ? `:${c.metadata.destinationPort}` : ""}`
            : `${c.metadata.destinationIP}${c.metadata.destinationPort ? `:${c.metadata.destinationPort}` : ""}`;
          const proxyChain = (c.chains || []).slice().reverse().join(" → ");
          const type = c.metadata.type || "—";
          const network = (c.metadata.network || "—").toUpperCase();

          const timeStr = c.start
            ? new Date(c.start).toLocaleTimeString()
            : "—";

          return (
            <div
              key={c.id}
              className="bg-[#212d30]/60 rounded-lg p-2 text-[10px] text-gray-300 shadow-md relative flex"
            >
              {/* 主体信息 */}
              <div className="flex-1 ml-2 space-y-1 pr-20">
                <div className="break-all">{destination}</div>
                <div className="break-all">{source}</div>
                <div className="break-all">{proxyChain}</div>
              </div>

              {/* 右侧速率、流量、type、时间 */}
              <div className="absolute right-2 top-1/2 transform -translate-y-1/2 flex flex-col items-end text-[9px]">
                <div className="flex gap-1">
                  <div className="text-purple-400">
                    ↑{formatSpeed(snap.upSpeed)}
                  </div>
                  <div className="text-green-400">
                    ↓{formatSpeed(snap.downSpeed)}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {/* 上传/下载靠中偏左 */}
                  <div className="flex gap-1 justify-end ">
                    <div className="text-purple-500">
                      {formatBytes(c.upload)}
                    </div>
                    <div className="text-green-500">
                      {formatBytes(c.download)}
                    </div>
                  </div>

                  {/* network 显示在右边 */}
                </div>

                <div className="text-gray-400 mt-1">{timeStr}</div>
                <div className="text-gray-400 mt-1">
                  {type} | {network}{" "}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
