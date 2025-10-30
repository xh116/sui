import { useEffect, useState, useRef } from "react";
import {
  subscribeConnections,
  subscribeMemory,
  subscribeTraffic,
} from "../api/clash";

export default function StatusCard() {
  const [connections, setConnections] = useState(0);
  const [memory, setMemory] = useState(0);

  const [traffic, setTraffic] = useState({ totalUp: 0, totalDown: 0 });

  const [speed, setSpeed] = useState({ up: 0, down: 0 });

  useEffect(() => {
    // Connections: 连接数 + 累计
    const unsubscribeConn = subscribeConnections((data) => {
      const list = data.connections || [];
      setConnections(list.length);
      setTraffic({
        totalUp: data.uploadTotal || 0,
        totalDown: data.downloadTotal || 0,
      });
    });

    // Memory
    const unsubscribeMem = subscribeMemory((o) => {
      setMemory(o.inuse ?? 0);
    });

    // Traffic: 实时速率
    const unsubscribeTraffic = subscribeTraffic((t) => {
      setSpeed({
        up: t.up ?? 0,
        down: t.down ?? 0,
      });
    });

    return () => {
      unsubscribeConn();
      unsubscribeMem();
      unsubscribeTraffic();
    };
  }, []);

  const formatBytes = (bytes) => {
    if (!bytes || isNaN(bytes)) return "0 B";
    const units = ["B", "KB", "MB", "GB", "TB"];
    let i = 0;
    let num = bytes;
    while (num >= 1024 && i < units.length - 1) {
      num /= 1024;
      i++;
    }
    return `${num.toFixed(1)} ${units[i]}`;
  };

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
      <div className="bg-gradient-to-b from-gray-600/40 to-gray-500/10 border border-white/10 rounded p-3 flex flex-col items-center">
        <div className="text-xs text-gray-400">Connections</div>
        <div className="font-bold text-gray-200">{connections}</div>
      </div>
      <div className="bg-gradient-to-b from-purple-600/40 to-purple-500/10 border border-white/10 rounded p-3 flex flex-col items-center">
        <div className="text-xs text-gray-400">Upload</div>
        <div className="font-bold text-purple-400">
          {formatBytes(speed.up)}/s
        </div>
      </div>
      <div className="bg-gradient-to-b from-green-600/40 to-green-500/10 border border-white/10 rounded p-3 flex flex-col items-center">
        <div className="text-xs text-gray-400">Download</div>
        <div className="font-bold text-green-400">
          {formatBytes(speed.down)}/s
        </div>
      </div>
      <div className="bg-gradient-to-b from-purple-600/40 to-purple-500/10 border border-white/10 rounded p-3 flex flex-col items-center">
        <div className="text-xs text-gray-400">Total Upload</div>
        <div className="font-bold text-purple-300">
          {formatBytes(traffic.totalUp)}
        </div>
      </div>
      <div className="bg-gradient-to-b from-green-600/40 to-green-500/10 border border-white/10 rounded p-3 flex flex-col items-center">
        <div className="text-xs text-gray-400">Total Download</div>
        <div className="font-bold text-green-300">
          {formatBytes(traffic.totalDown)}
        </div>
      </div>
      <div className="bg-gradient-to-b from-blue-600/40 to-blue-500/10 border border-white/10 rounded p-3 flex flex-col items-center">
        <div className="text-xs text-gray-400">Memory</div>
        <div className="font-bold text-blue-400">{formatBytes(memory)}</div>
      </div>
    </div>
  );
}
