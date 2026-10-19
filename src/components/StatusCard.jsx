import { useEffect, useState } from "react";
import {
  API_MODES,
  getApiMode,
  getStartedAt,
  subscribeConnections,
  subscribeMemory,
  subscribeTraffic,
} from "../api";
import { formatBytes } from "../format";

const formatUptime = (ms) => {
  const minutes = Math.floor(ms / 60000);
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  return `${minutes}m`;
};

export default function StatusCard() {
  const [connections, setConnections] = useState(0);
  const [memory, setMemory] = useState(0);
  const [startedAt, setStartedAt] = useState(null);
  const [nowTick, setNowTick] = useState(() => Date.now());

  const [traffic, setTraffic] = useState({ totalUp: 0, totalDown: 0 });

  const [speed, setSpeed] = useState({ up: 0, down: 0 });

  const isSingBox = getApiMode() === API_MODES.grpc;

  useEffect(() => {
    if (!isSingBox) return;
    let alive = true;
    const load = () =>
      getStartedAt()
        .then((value) => {
          if (alive) {
            setStartedAt(value);
            setNowTick(Date.now());
          }
        })
        .catch(() => {});
    load();
    // Re-read occasionally so a backend restart resets the uptime.
    const refresh = setInterval(load, 5 * 60 * 1000);
    return () => {
      alive = false;
      clearInterval(refresh);
    };
  }, [isSingBox]);

  useEffect(() => {
    if (startedAt === null) return;
    const tick = setInterval(() => setNowTick(Date.now()), 30000);
    return () => clearInterval(tick);
  }, [startedAt]);

  const uptime = startedAt === null ? null : Math.max(0, nowTick - startedAt);

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

    // Smooth short-term fluctuations and limit visual updates.
    const speedRef = { current: { up: 0, down: 0, time: 0 } };
    const unsubscribeTraffic = subscribeTraffic((t) => {
      const now = Date.now();
      if (now - speedRef.current.time < 500) return;
      const up = t.up ?? 0;
      const down = t.down ?? 0;
      const alpha = speedRef.current.time ? 0.35 : 1;
      speedRef.current = {
        up: speedRef.current.up * (1 - alpha) + up * alpha,
        down: speedRef.current.down * (1 - alpha) + down * alpha,
        time: now,
      };
      setSpeed({
        up: speedRef.current.up,
        down: speedRef.current.down,
      });
    });

    return () => {
      unsubscribeConn();
      unsubscribeMem();
      unsubscribeTraffic();
    };
  }, []);

  const format = (bytes) => formatBytes(bytes, 1);

  return (
    <div
      className={`grid grid-cols-2 ${
        uptime === null
          ? "md:grid-cols-3 lg:grid-cols-6"
          : "md:grid-cols-4 lg:grid-cols-7"
      } gap-4`}
    >
      <div className="bg-gradient-to-b from-gray-600/40 to-gray-500/10 border border-white/10 rounded p-3 flex flex-col items-center">
        <div className="text-xs text-gray-400">Connections</div>
        <div className="font-bold text-gray-200">{connections}</div>
      </div>
      <div className="bg-gradient-to-b from-purple-600/40 to-purple-500/10 border border-white/10 rounded p-3 flex flex-col items-center">
        <div className="text-xs text-gray-400">Upload</div>
        <div className="font-bold text-purple-400">
          {format(speed.up)}/s
        </div>
      </div>
      <div className="bg-gradient-to-b from-green-600/40 to-green-500/10 border border-white/10 rounded p-3 flex flex-col items-center">
        <div className="text-xs text-gray-400">Download</div>
        <div className="font-bold text-green-400">
          {format(speed.down)}/s
        </div>
      </div>
      <div className="bg-gradient-to-b from-purple-600/40 to-purple-500/10 border border-white/10 rounded p-3 flex flex-col items-center">
        <div className="text-xs text-gray-400">Total Upload</div>
        <div className="font-bold text-purple-300">
          {format(traffic.totalUp)}
        </div>
      </div>
      <div className="bg-gradient-to-b from-green-600/40 to-green-500/10 border border-white/10 rounded p-3 flex flex-col items-center">
        <div className="text-xs text-gray-400">Total Download</div>
        <div className="font-bold text-green-300">
          {format(traffic.totalDown)}
        </div>
      </div>
      <div className="bg-gradient-to-b from-blue-600/40 to-blue-500/10 border border-white/10 rounded p-3 flex flex-col items-center">
        <div className="text-xs text-gray-400">Memory</div>
        <div className="font-bold text-blue-400">{format(memory)}</div>
      </div>
      {uptime !== null && (
        <div className="bg-gradient-to-b from-cyan-600/40 to-cyan-500/10 border border-white/10 rounded p-3 flex flex-col items-center">
          <div className="text-xs text-gray-400">Uptime</div>
          <div className="font-bold text-cyan-400">{formatUptime(uptime)}</div>
        </div>
      )}
    </div>
  );
}
