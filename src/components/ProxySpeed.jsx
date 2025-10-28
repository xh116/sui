import { useEffect, useState, useRef } from "react";
import { subscribeConnections } from "../api/clash";

export default function ProxySpeed({ groupName, proxyName, type, current }) {
  const [speed, setSpeed] = useState({ up: 0, down: 0 });
  const lastSnapshotRef = useRef({});

  const key = `${groupName || "global"}:${proxyName}`;
  const targetName = type === "URLTest" && current ? current : proxyName;

  useEffect(() => {
    const unsub = subscribeConnections((data) => {
      const now = Date.now();
      const newSnapshot = {};
      let aggUp = 0,
        aggDown = 0;

      (data.connections || []).forEach((c) => {
        const chains = c.chains || [];

        // 只统计当前目标节点
        if (!chains.includes(targetName)) return;

        // 如果指定了 groupName，只统计该组下的连接
        if (groupName && !chains.includes(groupName)) return;

        const prev = lastSnapshotRef.current[c.id] || {
          up: 0,
          down: 0,
          time: now,
        };
        const up = c.upload || 0;
        const down = c.download || 0;

        const dt = (now - prev.time) / 1000;
        if (dt > 0) {
          aggUp += Math.max(0, (up - prev.up) / dt);
          aggDown += Math.max(0, (down - prev.down) / dt);
        }

        newSnapshot[c.id] = { up, down, time: now };
      });

      lastSnapshotRef.current = newSnapshot;
      setSpeed({ up: aggUp, down: aggDown });
    });

    return () => unsub();
  }, [key, targetName, groupName]);

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
