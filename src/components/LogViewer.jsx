import { useEffect, useState, useRef, useMemo } from "react";
import { subscribeLogs } from "../api/clash";

// 解析日志行：提取 [时间] [类型] 消息
function parseLogEntry(raw) {
  const payload =
    typeof raw?.payload === "string" ? raw.payload : String(raw?.payload ?? "");
  const m = payload.match(/^\[([^\]]+)\]\s*\[([A-Z]+)\]\s*(.*)$/);

  const formatDate = (date) => {
    const yy = String(date.getFullYear()).slice(-2);
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const dd = String(date.getDate()).padStart(2, "0");
    const hh = String(date.getHours()).padStart(2, "0");
    const min = String(date.getMinutes()).padStart(2, "0");
    const ss = String(date.getSeconds()).padStart(2, "0");
    return `${yy}-${mm}-${dd} ${hh}:${min}:${ss}`;
  };

  if (m) {
    return {
      time: formatDate(new Date()),
      type: m[2].toLowerCase(),
      payload: m[3],
    };
  }
  return {
    time: formatDate(new Date()),
    type: raw?.type ?? "info",
    payload,
  };
}

export default function LogViewer() {
  const [logs, setLogs] = useState([]);
  const [paused, setPaused] = useState(false);
  const [filterText, setFilterText] = useState("");
  const containerRef = useRef(null);

  useEffect(() => {
    const unsubscribe = subscribeLogs((log) => {
      if (paused) return;
      const parsed = parseLogEntry(log);
      setLogs((prev) => [parsed, ...prev].slice(0, 5000));
    });

    return () => unsubscribe();
  }, [paused]);

  const filteredLogs = useMemo(() => {
    const s = filterText.trim().toLowerCase();
    if (!s) return logs;
    return logs.filter((log) =>
      `[${log.time}] [${log.type}] ${log.payload}`.toLowerCase().includes(s),
    );
  }, [logs, filterText]);

  return (
    <div className="flex flex-col h-screen p-2 text-white">
      {/* 标题与操作 */}
      <div className="flex justify-between items-center mb-3">
        <h1 className="text-xl font-bold">Logs</h1>
        <button
          onClick={() => setPaused(!paused)}
          className="
            px-3 py-1 rounded text-sm text-white
            bg-gradient-to-r from-red-600/70 to-pink-500/70
            hover:from-red-600/80 hover:to-pink-400/60
            transition-colors duration-200"
        >
          {paused ? "Resume" : "Pause"}
        </button>
      </div>

      {/* 搜索框行 */}
      <div className="mb-3 flex items-center gap-3">
        <input
          type="text"
          value={filterText}
          onChange={(e) => setFilterText(e.target.value)}
          placeholder="Filter..."
          className="flex-1 w-full px-3 py-2 rounded-lg bg-gray-800/80 border border-gray-700 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent"
        />
      </div>

      {/* 日志内容：统一卡片样式 */}
      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto font-mono text-xs space-y-2"
      >
        <div className="space-y-1 text-[11px]">
          {filteredLogs.map((log, idx) => {
            const type = log.type.toUpperCase();
            const typeColor =
              type === "ERROR"
                ? "text-red-400"
                : type === "WARN"
                  ? "text-yellow-400"
                  : type === "INFO"
                    ? "text-green-500"
                    : "text-cyan-400";

            return (
              <div
                key={idx}
                className="bg-[#212d30]/60 rounded-md px-3 py-2 border border-gray-700 shadow-sm"
              >
                <div className="flex justify-between items-center mb-1">
                  <span className={`text-[10px] font-semibold ${typeColor}`}>
                    [{type}]
                  </span>
                  <span className="text-gray-400 text-[10px]">
                    [{log.time}]
                  </span>
                </div>
                <div className="break-words text-gray-300 leading-snug">
                  {log.payload}
                </div>
              </div>
            );
          })}
          {filteredLogs.length === 0 && (
            <div className="text-center text-gray-400 py-4">No logs</div>
          )}
        </div>
      </div>
    </div>
  );
}
