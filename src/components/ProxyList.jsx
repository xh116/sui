import { useEffect, useState, useRef } from "react";
import {
  getProxies,
  switchProxy,
  testDelaysInBatch,
  subscribeProxyUpdates,
} from "../api";
import {
  useProxyIconLibrary,
  ProxyIconMenu,
  ProxyGroupIcon,
} from "./ProxyIcon";
import ProxySpeed from "./ProxySpeed";

const GROUP_TYPE_LABELS = {
  selector: "Selector",
  urltest: "URLTest",
  fallback: "Fallback",
  loadbalance: "LoadBalance",
  "load-balance": "LoadBalance",
  relay: "Relay",
};

const groupTypeLabel = (type) =>
  GROUP_TYPE_LABELS[type] ??
  (type ? type[0].toUpperCase() + type.slice(1).toLowerCase() : "");

const normalizeProxyKey = (name) =>
  String(name || "").replace(/^[^A-Za-z0-9]+/, "");

export default function ProxyList() {
  const [groups, setGroups] = useState({});
  const [current, setCurrent] = useState({});
  const [delays, setDelays] = useState({});
  const [expanded, setExpanded] = useState(() => {
    try {
      const saved = localStorage.getItem("expandedGroups");
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });
  const [groupTypes, setGroupTypes] = useState({});
  const [groupSelectable, setGroupSelectable] = useState({});
  const [error, setError] = useState("");
  const abortRef = useRef(null);
  const refreshRef = useRef(null);
  const refreshInFlightRef = useRef(false);
  const refreshAgainRef = useRef(false);
  const groupsRefreshTimerRef = useRef(null);

  // 图标库
  const { icons: iconLibrary } = useProxyIconLibrary();

  // group→icon 映射（持久化）
  const [groupIcons, setGroupIcons] = useState(() => {
    try {
      const saved = localStorage.getItem("groupIcons");
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const [contextMenu, setContextMenu] = useState(null);

  useEffect(() => {
    refreshProxies();
    return () => abortRef.current?.();
  }, []);

  useEffect(() => {
    refreshRef.current = refreshProxies;
  });

  // Clash has no push channel: poll while visible, and refresh when the tab
  // becomes visible again. sing-box additionally pushes Groups updates below.
  useEffect(() => {
    const tick = () => {
      if (!document.hidden) refreshRef.current?.();
    };
    const timer = setInterval(tick, 10000);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", tick);
    };
  }, []);

  useEffect(() => {
    const scheduleRefresh = () => {
      if (groupsRefreshTimerRef.current) return;
      groupsRefreshTimerRef.current = setTimeout(() => {
        groupsRefreshTimerRef.current = null;
        refreshRef.current?.();
      }, 300);
    };
    const unsubscribe = subscribeProxyUpdates(scheduleRefresh);
    return () => {
      unsubscribe();
      clearTimeout(groupsRefreshTimerRef.current);
      groupsRefreshTimerRef.current = null;
    };
  }, []);

  const autoTestedRef = useRef(false);

  useEffect(() => {
    if (autoTestedRef.current || !Object.keys(groups).length) return;
    const timer = setTimeout(() => {
      if (autoTestedRef.current) return;
      autoTestedRef.current = true;
      // The same node appears in several groups; test each one once instead of
      // racing duplicate tests that overwrite the same displayed delay.
      const nodes = [
        ...new Map(
          Object.values(groups)
            .flat()
            .map((node) => [node.name, node]),
        ).values(),
      ];
      const { promise, abort } = testDelaysInBatch(
        nodes,
        5,
        (partial) =>
          setDelays((prev) => ({
            ...prev,
            ...Object.fromEntries(
              Object.entries(partial).filter(([, delay]) => delay !== "N/A"),
            ),
          })),
        300,
      );
      abortRef.current = abort;
      promise.finally(() => {
        if (abortRef.current === abort) abortRef.current = null;
      });
    }, 0);
    return () => {
      // Only cancel the deferred start; a refresh that replaces `groups`
      // must not abort a running delay test.
      clearTimeout(timer);
    };
  }, [groups]);

  const refreshProxies = async () => {
    if (refreshInFlightRef.current) {
      refreshAgainRef.current = true;
      return;
    }
    refreshInFlightRef.current = true;
    try {
      let data;
      try {
        data = await getProxies();
      } catch (err) {
        console.error("Failed to load proxies", err);
        setError(`Failed to load proxies: ${err?.message || "Network error"}`);
        return;
      }
      if (data?.proxies) {
        setError("");
        const proxyGroups = {};
        const currentMap = {};
        const typeMap = {};
        const selectableMap = {};
        Object.entries(data.proxies).forEach(([name, proxy]) => {
          const groupType = String(proxy?.type || "").toLowerCase();
          if (
            ["selector", "urltest", "fallback", "loadbalance", "load-balance", "relay"].includes(groupType) &&
            name !== "GLOBAL"
          ) {
            proxyGroups[name] = (proxy.all ?? [])
              .map((item) => {
                const displayName =
                  typeof item === "string" ? item : item?.name;
                const apiName = data.proxies[displayName]
                  ? displayName
                  : normalizeProxyKey(displayName);
                const providerProxy = Object.values(data.proxies).find(
                  (candidate) =>
                    normalizeProxyKey(candidate?.name) === apiName &&
                    candidate?.["provider-name"],
                );
                const node =
                  data.proxies[apiName] ??
                  data.proxies[displayName] ??
                  providerProxy ??
                  {};
                return {
                  ...node,
                  name: apiName,
                  displayName,
                  type:
                    node.type ??
                    (typeof item === "object" ? item.type : null) ??
                    "Proxy",
                  history: node.history ?? item?.history ?? [],
                };
              })
              .filter((node) => node.name);
            currentMap[name] = proxy.now;
            selectableMap[name] =
              proxy.selectable === undefined
                ? groupType === "selector"
                : proxy.selectable === true;
            typeMap[name] = groupTypeLabel(groupType);
          }
        });
        setGroups(proxyGroups);
        setCurrent(currentMap);
        setExpanded((prev) => {
          const next = {};
          for (const name of Object.keys(proxyGroups)) {
            next[name] = prev[name] ?? true;
          }
          return next;
        });
        setGroupTypes(typeMap);
        setGroupSelectable(selectableMap);
      }
    } finally {
      refreshInFlightRef.current = false;
      if (refreshAgainRef.current) {
        refreshAgainRef.current = false;
        // Coalesce any refresh requested while this one was in flight.
        Promise.resolve().then(() => refreshRef.current?.());
      }
    }
  };

  const handleSelect = async (group, node) => {
    if (!groupSelectable[group]) return;
    try {
      await switchProxy(group, node);
      setCurrent((prev) => ({ ...prev, [group]: node }));
      setError("");
    } catch (err) {
      console.error(`Failed to switch ${group} to ${node}`, err);
      setError(
        `Failed to switch ${group} → ${node}: ${err?.message || "Network error"}`,
      );
    }
  };

  const handleToggleGroup = (group) => {
    setExpanded((prev) => {
      const updated = { ...prev, [group]: !prev[group] };
      localStorage.setItem("expandedGroups", JSON.stringify(updated));
      return updated;
    });
  };

  // 右键菜单
  const handleContextMenu = (e, group) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, group });
  };

  // 长按菜单
  const touchTimeout = useRef(null);

  const handleTouchStart = (e, group) => {
    touchTimeout.current = setTimeout(() => {
      setContextMenu({
        x: e.touches[0].clientX,
        y: e.touches[0].clientY,
        group,
      });
    }, 600); // 长按 600ms 触发
  };

  const handleTouchEnd = () => {
    clearTimeout(touchTimeout.current);
  };

  const handleSelectIcon = (group, iconUrl) => {
    setGroupIcons((prev) => {
      const updated = { ...prev, [group]: iconUrl };
      localStorage.setItem("groupIcons", JSON.stringify(updated));
      return updated;
    });
    setContextMenu(null);
  };

  // 延迟颜色
  const delayBlockColor = (delay) => {
    const n = Number(delay);
    if (!Number.isFinite(n)) return "bg-gray-400";
    if (n < 300) return "bg-green-500";
    if (n < 500) return "bg-yellow-500";
    return "bg-red-500";
  };

  const delayTextColor = (delay) => {
    const n = Number(delay);
    if (!Number.isFinite(n)) return "text-gray-400";
    if (n < 300) return "text-green-400";
    if (n < 500) return "text-yellow-500";
    return "text-red-500";
  };

  return (
    <div className="overflow-y-auto relative">
      {error && (
        <div className="mt-4 rounded border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-400">
          {error}
        </div>
      )}
      <div className="flex justify-between items-center mb-2 mt-4">
        <h1 className="text-xl font-bold">Proxies</h1>
        <div className="flex items-center gap-2">
          {/* 全部折叠/展开 按钮（放在 TestAll 左边） */}
          <button
            onClick={() => {
              const groupNames = Object.keys(groups);
              if (!groupNames.length) return;

              // 检查是否全部展开
              const allExpanded = groupNames.every((g) => !!expanded[g]);
              const target = !allExpanded;
              const newExpanded = {};
              groupNames.forEach((g) => (newExpanded[g] = target));
              setExpanded(newExpanded);

              try {
                localStorage.setItem(
                  "expandedGroups",
                  JSON.stringify(newExpanded),
                );
              } catch {}
            }}
            title={
              Object.keys(groups).length &&
              Object.keys(groups).every((g) => !!expanded[g])
                ? "Collapse All"
                : "Expand All"
            }
            className="hover:text-yellow-200 disabled:opacity-50 flex items-center gap-1 pr-2"
            aria-label="Toggle expand all"
          >
            {/* 根据状态显示不同图标 */}
            {Object.keys(groups).length &&
            Object.keys(groups).every((g) => !!expanded[g]) ? (
              // 折叠图标
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="w-7 h-7 hover:text-white hover:scale-125 text-gray-300 transition-transform"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M18 13l-6-6-6 6M18 19l-6-6-6 6"
                />
              </svg>
            ) : (
              // 展开图标
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="w-7 h-7 hover:text-white hover:scale-125 text-gray-300 transition-transform"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 11l6 6 6-6M6 5l6 6 6-6"
                />
              </svg>
            )}
          </button>

          {/*   TestAll 按钮 */}
          <button
            className="hover:text-yellow-200 disabled:opacity-50 flex items-center gap-1 pr-2"
            onClick={() => {
              if (abortRef.current) {
                abortRef.current();
                abortRef.current = null;
              }

              const allNodes = [
                ...new Map(
                  Object.values(groups)
                    .flat()
                    .map((node) => [node.name, node]),
                ).values(),
              ];

              const { promise, abort } = testDelaysInBatch(
                allNodes,
                5,
                (partial) =>
                  setDelays((prev) => ({
                    ...prev,
                    ...Object.fromEntries(
                      Object.entries(partial).filter(([, delay]) => delay !== "N/A"),
                    ),
                  })),
                500,
              );
              abortRef.current = abort;
              promise.finally(() => {
                if (abortRef.current === abort) abortRef.current = null;
              });
            }}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="w-8 h-8 hover:text-yellow-400 text-white"
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <path d="M13 2L3 14h7v8l11-14h-7l-1-6z" />
            </svg>
          </button>
        </div>
      </div>

      {/* 分组列表 */}
      {Object.entries(groups).map(([group, nodes]) => {
        const isOpen = expanded[group];

        return (
          <div key={group} className="my-2 pl-2 pr-2 pb-2 ">
            {/* ===== 标题行 ===== */}
            <div className="flex flex-wrap items-center my-4">
              {/* 左侧：组图标 + 组名 + 箭头 + 类型 */}
              <div className="flex items-center gap-2 shrink-0">
                <div
                  className="cursor-pointer"
                  onClick={() => handleToggleGroup(group)}
                  onContextMenu={(e) => handleContextMenu(e, group)}
                  onTouchStart={(e) => handleTouchStart(e, group)}
                  onTouchEnd={handleTouchEnd}
                >
                  <ProxyGroupIcon src={groupIcons[group]} />
                </div>

                <span
                  className="font-bold hover:text-white select-text cursor-pointer"
                  onClick={() => handleToggleGroup(group)}
                  onContextMenu={(e) => handleContextMenu(e, group)}
                  onTouchStart={(e) => handleTouchStart(e, group)}
                  onTouchEnd={handleTouchEnd}
                >
                  {group}
                </span>

                <svg
                  onClick={() => handleToggleGroup(group)}
                  className={`w-5 h-5 ml-1 text-gray-300 hover:text-white hover:scale-125 transition-all duration-200 cursor-pointer ${
                    isOpen ? "rotate-180" : ""
                  }`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>

                <span className="ml-2 text-[10px] text-gray-500 hidden sm:inline">
                  {groupTypes[group]}
                </span>
              </div>

              {/* 右侧：小方块 + 闪电按钮  */}
              <div className="flex items-center gap-2 ml-auto">
                <div className="flex flex-1 flex-wrap items-center gap-1">
                  {nodes.map((node) => {
                    const nodeName = node?.name ?? "";
                    const d =
                      delays[nodeName] ?? node?.history?.at(-1)?.delay ?? "N/A";
                    return (
                      <div key={nodeName} className="relative group">
                        {/* 小方块 */}
                        <div
                          className={`w-3 h-3 rounded-sm cursor-pointer transition 
    ${delayBlockColor(d)} 
    hover:scale-110 hover:ring-1 hover:ring-gray-400/50
    ${current[group] === nodeName ? "scale-105 animate-pulse brightness-125 " : ""}`}
                          onClick={() => handleSelect(group, nodeName)}
                        >
                          {/* ✅ 选中时叠加一个勾 */}
                          {current[group] === nodeName && (
                            <svg
                              viewBox="0 0 16 16"
                              className="absolute inset-0 w-3 h-3 pointer-events-none"
                            >
                              <path
                                d="M4 8.5 L7 11 L12 5.5"
                                className="stroke-green-800"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                fill="none"
                              />
                            </svg>
                          )}
                        </div>

                        {/* Tooltip */}
                        <div
                          className="absolute bottom-full mb-1 right-0 
               hidden group-hover:block whitespace-nowrap
               bg-[#212b2e] text-white text-[10px] px-2 py-1 rounded shadow-lg z-10"
                        >
                          {node.displayName ?? nodeName}:{" "}
                          {Number.isFinite(Number(d)) ? `${d} ms` : "N/A"}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* 闪电按钮 */}
                <button
                  className="shrink-0 disabled:opacity-50"
                  aria-label="测量节点延迟"
                  onClick={() => {
                    if (abortRef.current) {
                      abortRef.current();
                      abortRef.current = null;
                    }
                    const { promise, abort } = testDelaysInBatch(
                      nodes,
                      5,
                      (partial) =>
                        setDelays((prev) => ({
                          ...prev,
                          ...Object.fromEntries(
                            Object.entries(partial).filter(([, delay]) => delay !== "N/A"),
                          ),
                        })),
                      200,
                    );
                    abortRef.current = abort;
                    promise.finally(() => {
                      if (abortRef.current === abort) abortRef.current = null;
                    });
                  }}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="w-5 h-5 hover:text-yellow-400 text-white"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M13 2L3 14h7v8l11-14h-7l-1-6z" />
                  </svg>
                </button>
              </div>
            </div>

            {/* ===== 折叠容器（节点卡片） ===== */}
            <div
              className={`transition-[max-height,opacity,margin-top,transform] duration-300 ease-in-out ${
                isOpen
                  ? "max-h-[9999px] opacity-100 mt-2 scale-100 overflow-visible "
                  : "max-h-0 opacity-0 mt-6 scale-95 overflow-hidden"
              }`}
            >
              <div
                className="
                  grid gap-3 mt-2
                  grid-cols-[repeat(auto-fill,minmax(165px,1fr))]
                  sm:grid-cols-[repeat(auto-fill,minmax(180px,1fr))]
                  lg:grid-cols-[repeat(auto-fill,minmax(220px,1fr))]
                "
              >
                {nodes.map((node) => {
                  const nodeName = node?.name ?? "";
                  const lastDelay =
                    delays[nodeName] ?? node?.history?.at(-1)?.delay ?? "N/A";
                  const isActive = current[group] === nodeName;

                  return (
                    <div
                      key={nodeName}
                      className={`relative p-1 h-14 rounded-lg cursor-pointer transition ${
                        isActive
                          ? "bg-[#212b2e] text-gray-200/80 transition-transform hover:scale-[1.02] hover:shadow-[0_4px_12px_rgba(0,0,0,0.6)]"
                          : "bg-[#212d30]/60 p-1 transition-transform hover:scale-[1.02] hover:shadow-[2px_6px_14px_rgba(0,0,0,0.5)]"
                      }`}
                      onClick={() => handleSelect(group, nodeName)}
                    >
                      <p
                        className={`font-normal text-xs truncate ${isActive ? "pr-16" : ""}`}
                      >
                        {node.displayName ?? nodeName}
                      </p>
                      {isActive && (
                        <ProxySpeed groupName={group} proxyName={nodeName} />
                      )}
                      <div className="flex justify-between items-end mt-4 text-gray-200/50 text-[9px]">
                        <span className="opacity-70">
                          {node?.type ?? "Unknown"}
                        </span>
                        <span className={delayTextColor(lastDelay)}>
                          {Number.isFinite(Number(lastDelay))
                            ? `${lastDelay} ms`
                            : "N/A"}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        );
      })}

      {/* 右键菜单 */}
      {contextMenu && (
        <ProxyIconMenu
          x={contextMenu.x}
          y={contextMenu.y}
          group={contextMenu.group}
          icons={iconLibrary}
          onSelect={handleSelectIcon}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  );
}
