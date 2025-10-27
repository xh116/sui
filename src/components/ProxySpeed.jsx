import { useEffect, useState } from "react";
import { subscribeConnections } from "../api/clash";

export default function ProxySpeed({ proxyName }) {
  const [speed, setSpeed] = useState({ up: 0, down: 0 });
  const [lastSnapshot, setLastSnapshot] = useState({}); // { connId: { up, down, time } }

  useEffect(() => {
    const unsub = subscribeConnections((data) => {
      const now = Date.now();
      const newSnapshot = {};
      let aggUp = 0,
        aggDown = 0;

      (data.connections || []).forEach((c) => {
        const node = c.chains && c.chains.length > 0 ? c.chains[0] : "UNKNOWN";
        if (!c.chains?.includes(proxyName)) return;

        const prev = lastSnapshot[c.id];
        const up = c.upload || 0;
        const down = c.download || 0;

        if (prev) {
          const dt = (now - prev.time) / 1000;
          if (dt > 0) {
            aggUp += Math.max(0, (up - prev.up) / dt);
            aggDown += Math.max(0, (down - prev.down) / dt);
          }
        }

        newSnapshot[c.id] = { up, down, time: now };
      });

      setLastSnapshot(newSnapshot);
      setSpeed({ up: aggUp, down: aggDown });
    });

    return () => unsub();
  }, [proxyName, lastSnapshot]);

  const formatSpeed = (n) => {
    if (n < 1024) return `${Math.round(n)} B/s`;
    if (n < 1024 ** 2) return `${(n / 1024).toFixed(1)} KB/s`;
    if (n < 1024 ** 3) return `${(n / 1024 ** 2).toFixed(1)} MB/s`;
    return `${(n / 1024 ** 3).toFixed(1)} GB/s`;
  };

  return (
    <div className="absolute top-1 right-2 text-[8px] text-gray-400 flex gap-1">
      <span className="text-purple-400/80">{formatSpeed(speed.up)}</span>
      <span className="text-green-400/80">{formatSpeed(speed.down)}</span>
    </div>
  );
}
