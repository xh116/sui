import { useEffect, useState } from "react";
import { getRules, getProxies } from "../api/clash";

export default function Rules() {
  const [rules, setRules] = useState([]);
  const [proxies, setProxies] = useState({});

  const fetchProxies = async () => {
    const res = await getProxies();
    setProxies(res.proxies || {});
  };

  const fetchRules = async () => {
    const res = await getRules();
    setRules(res.rules || []);
  };

  useEffect(() => {
    const fetchAll = async () => {
      await fetchProxies();
      await fetchRules();
    };

    fetchAll();

    const timer = setInterval(fetchAll, 5000);
    return () => clearInterval(timer);
  }, []);

  const getCurrentProxyName = (proxyString, proxies) => {
    // 非 route(...)，直接返回
    if (!proxyString.startsWith("route(") || !proxyString.endsWith(")")) {
      return proxyString;
    }
    const groupName = proxyString.slice(6, -1);

    const group = proxies[groupName];
    if (!group) return groupName;
    if (group.now) {
      const now = group.now;
      const nowGroup = proxies[now];

      // 如果 now 也是一个策略组（Selector/URLTest/Fallback）
      if (
        nowGroup &&
        ["Selector", "URLTest", "Fallback"].includes(nowGroup.type)
      ) {
        return `${now} → ${nowGroup.now || now}`;
      }
      return now;
    }
    return groupName;
  };

  if (rules.length === 0) {
    return (
      <div className="p-4 text-gray-200">
        <h1 className="text-xl font-bold mb-4">Rules</h1>
        <p className="text-gray-400">No rules</p>
      </div>
    );
  }

  return (
    <div className="p-4 text-gray-200 space-y-2">
      <h1 className="text-xl font-bold mb-4">Rules</h1>

      {rules.map((r, i) => (
        <div
          key={i}
          className="bg-[#212d30]/60 rounded-md px-2 py-2 border border-gray-700 shadow-sm flex items-center"
        >
          <div className="w-8 flex justify-center items-center text-yellow-400 text-[11px]">
            #{i}
          </div>

          <div className="flex-1 ml-2 flex items-center justify-between text-[11px] text-gray-300">
            <span className="break-words flex-1 pr-2">{r.payload}</span>
            <div className="flex flex-col items-end gap-1 text-[9px]">
              <span className="bg-pink-500/50 px-1 rounded text-[9px] text-gray-300">
                {r.proxy}
              </span>

              {/* 当前实际使用 proxy */}
              {r.proxy.startsWith("route(") &&
                getCurrentProxyName(r.proxy, proxies) && (
                  <span className="bg-green-500/50 px-1 rounded text-[8px] text-gray-300">
                    {getCurrentProxyName(r.proxy, proxies)}
                  </span>
                )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
