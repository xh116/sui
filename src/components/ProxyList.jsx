import { useEffect, useState, useRef } from "react";
import { getProxies, switchProxy, testDelaysInBatch } from "../api/clash";
import {
  useProxyIconLibrary,
  ProxyIconMenu,
  ProxyGroupIcon,
} from "./ProxyIcon";
import ProxySpeed from "./ProxySpeed";

export default function ProxyList() {
  const [groups, setGroups] = useState({});
  const [current, setCurrent] = useState({});
  const [delays, setDelays] = useState({});
  // 展开状态（加上持久化支持）
  const [expanded, setExpanded] = useState(() => {
    try {
      const saved = localStorage.getItem("expandedGroups");
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });
  const [groupTypes, setGroupTypes] = useState({});
  const [testingAll, setTestingAll] = useState(false);
  const abortRef = useRef(null);

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

  const refreshProxies = async () => {
    const data = await getProxies();
    if (data?.proxies) {
      const proxyGroups = {};
      const currentMap = {};
      const expandedMap = {};
      const typeMap = {};
      Object.entries(data.proxies).forEach(([name, proxy]) => {
        if (
          ["Selector", "URLTest", "Fallback"].includes(proxy.type) &&
          name !== "GLOBAL"
        ) {
          proxyGroups[name] = proxy.all?.map((n) => data.proxies[n]) || [];
          currentMap[name] = proxy.now;
          expandedMap[name] = expanded[name] ?? true;
          typeMap[name] = proxy.type;
        }
      });
      setGroups(proxyGroups);
      setCurrent(currentMap);
      setExpanded(expandedMap);
      setGroupTypes(typeMap);
    }
  };

  const handleSelect = async (group, node) => {
    await switchProxy(group, node);
    setCurrent((prev) => ({ ...prev, [group]: node }));
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
    <div className="overflow-y-auto relative  ">
      {/* 顶部标题 + 一键测试 + 全部展开/折叠 */}
      <div className="flex justify-between items-center mb-2 mt-4">
        <h1 className="text-xl font-bold mb-5">Proxies</h1>

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
                className="w-7 h-7 hover:text-white hover:scale-130 text-gray-300"
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
                className="w-7 h-7 hover:text-white hover:scale-130 text-gray-300"
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
            className="hover:text-yellow-200 disabled:opacity-50 flex items-center gap-1 pr-4"
            onClick={() => {
              abortRef.current?.();
              setTestingAll(true);

              // 去重后的节点集合
              const allNodes = [
                ...new Map(
                  Object.values(groups)
                    .flat()
                    .map((node) => [node.name, node]),
                ).values(),
              ];

              const { promise, abort } = testDelaysInBatch(
                allNodes,
                3,
                (partial) => setDelays((prev) => ({ ...prev, ...partial })),
                500,
              );
              abortRef.current = abort;
              promise.finally(() => setTestingAll(false));
            }}
            disabled={testingAll}
            title="TestAll Latency"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="w-8 h-8 hover:text-yellow-400 text-white animate-pulse"
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <path d="M13 2L3 14h7v8l11-14h-7l-1-6z" />
            </svg>

            {testingAll}
          </button>
        </div>
      </div>

      {/* 分组列表 */}
      {Object.entries(groups).map(([group, nodes]) => {
        const isOpen = expanded[group];

        return (
          <div key={group} className="mb-2 pl-2 pr-2">
            {/* 分组标题 */}
            <div className="flex justify-between items-center">
              <div className="flex-1 py-2 px-1 rounded-md transition flex items-center gap-2">
                {/* 图标：点击/右键/长按 */}
                <div
                  className="cursor-pointer relative z-10"
                  onClick={() => handleToggleGroup(group)}
                  onContextMenu={(e) => handleContextMenu(e, group)}
                  onTouchStart={(e) => handleTouchStart(e, group)}
                  onTouchEnd={handleTouchEnd}
                >
                  <ProxyGroupIcon src={groupIcons[group]} />
                </div>

                {/* 文字：点击/右键/长按 */}
                <span
                  className="font-bold select-text cursor-pointer relative z-10"
                  onClick={() => handleToggleGroup(group)}
                  onContextMenu={(e) => handleContextMenu(e, group)}
                  onTouchStart={(e) => handleTouchStart(e, group)}
                  onTouchEnd={handleTouchEnd}
                >
                  {group}
                </span>

                {/* 箭头：点击/右键/长按 */}
                <svg
                  onClick={() => handleToggleGroup(group)}
                  className={`w-4 h-4 ml-1 transition-all duration-200 cursor-pointer
                  ${isOpen ? "rotate-180" : ""}
                  text-white opacity-70
                  hover:text-gray-200 hover:scale-130 hover:opacity-100`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={3}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>

                <span className="ml-2 text-[10px] text-gray-500 hidden sm:inline">
                  {groupTypes[group]}
                </span>
              </div>

              {/* 延迟方块 */}
              <div className="flex gap-1 flex-wrap ml-6 mr-3">
                {nodes.map((node) => {
                  const nodeName = node?.name ?? "";
                  const d =
                    delays[nodeName] ?? node?.history?.at(-1)?.delay ?? "N/A";
                  return (
                    <div
                      key={nodeName}
                      className={`w-3 h-3 rounded-sm ${delayBlockColor(d)}`}
                      title={`${nodeName}: ${
                        Number.isFinite(Number(d)) ? `${d} ms` : "N/A"
                      }`}
                    />
                  );
                })}
              </div>
              {/* 闪电图标 */}
              <button
                className="mr-3 disabled:opacity-50"
                onClick={() => {
                  abortRef.current?.();
                  const { promise, abort } = testDelaysInBatch(
                    nodes,
                    5,
                    (partial) => setDelays((prev) => ({ ...prev, ...partial })),
                    200,
                  );
                  abortRef.current = abort;
                  promise.then(() => {});
                }}
                title="TestAll Latency"
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

            {/* 节点卡片 */}
            <div
              className={`transition-all duration-300 ease-in-out   ${
                isOpen ? "max-h-[1000px] opacity-100" : "max-h-0 opacity-0"
              }`}
            >
              <div className="grid grid-cols-[repeat(auto-fit,minmax(165px,1fr))] gap-3 mt-2">
                {nodes.map((node) => {
                  const nodeName = node?.name ?? "";
                  const lastDelay =
                    delays[nodeName] ?? node?.history?.at(-1)?.delay ?? "N/A";
                  const isActive = current[group] === nodeName;

                  return (
                    <div
                      key={nodeName}
                      className={`relative p-1 h-12 rounded-lg cursor-pointer transition
                      ${
                        isActive
                          ? "bg-[#212b2e] text-gray-200/80 transition-transform hover:scale-[1.02] hover:shadow-[0_4px_12px_rgba(0,0,0,0.6)]"
                          : "bg-[#212d30]/60 p-1 transition-transform hover:scale-[1.02] hover:shadow-[2px_6px_14px_rgba(0,0,0,0.5)]"
                      }`}
                      onClick={() => handleSelect(group, nodeName)}
                    >
                      {/* 节点名 */}
                      <p className="font-normal text-xs truncate">{nodeName}</p>

                      {/* ✅ 只有当前活跃节点才显示速率 */}
                      {isActive && <ProxySpeed proxyName={nodeName} />}

                      {/* 左下角：类型 + 延迟 */}
                      <div className="flex justify-between items-end mt-3 text-gray-200/50 text-[9px]">
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
