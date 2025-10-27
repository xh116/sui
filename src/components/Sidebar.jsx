import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { getVersion } from "../api/clash";

// 图标：Dashboard 版本提示（圆形 + 感叹号）
const VersionIcon = ({ className = "w-4 h-4" }) => (
  <svg
    viewBox="0 0 24 24"
    className={className}
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="8" x2="12" y2="12" />
    <circle cx="12" cy="16" r="1" />
  </svg>
);

// 图标：Clash
const ClashIcon = ({ className = "w-5 h-5" }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    {/* 猫头圆形 */}
    <circle cx="12" cy="14" r="6" />

    {/* 左耳朵（往左外歪） */}
    <polygon points="6,9 9,3 11,9" />

    {/* 右耳朵（往右外歪） */}
    <polygon points="13,9 15,3 18,9" />
  </svg>
);

// 图标：Sing-box
const SingBoxIcon = ({ width = 72, height = 72 }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={width}
    height={height}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <defs>
      {/* 顶面渐变：浅灰 */}
      <linearGradient id="topGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#e0e0e0" stopOpacity="0.9" />
        <stop offset="100%" stopColor="#c0c0c0" stopOpacity="0.9" />
      </linearGradient>
      {/* 左侧渐变：稍深 */}
      <linearGradient id="leftGrad" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#b0b0b0" stopOpacity="0.9" />
        <stop offset="100%" stopColor="#909090" stopOpacity="0.9" />
      </linearGradient>
      {/* 右侧渐变：更深 */}
      <linearGradient id="rightGrad" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#a0a0a0" stopOpacity="0.9" />
        <stop offset="100%" stopColor="#707070" stopOpacity="0.9" />
      </linearGradient>
    </defs>

    {/* 顶面 */}
    <polygon points="4,8 12,4 20,8 12,12" fill="url(#topGrad)" />
    {/* 左侧面 */}
    <polygon points="4,8 12,12 12,20 4,16" fill="url(#leftGrad)" />
    {/* 右侧面 */}
    <polygon points="20,8 12,12 12,20 20,16" fill="url(#rightGrad)" />
  </svg>
);

// 菜单图标
const StatusIcon = ({ className }) => (
  <svg viewBox="0 0 24 24" className={className} fill="currentColor">
    <rect x="3" y="3" width="4" height="18" />
    <rect x="10" y="9" width="4" height="12" />
    <rect x="17" y="13" width="4" height="8" />
  </svg>
);

const ProxiesIcon = ({ className }) => (
  <svg
    viewBox="0 0 24 24"
    className={className}
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <circle cx="12" cy="12" r="10" />
    <path d="M2 12h20M12 2a15 15 0 010 20M12 2a15 15 0 000 20" />
  </svg>
);

const ConnectionsIcon = ({ className }) => (
  <svg
    viewBox="0 0 24 24"
    className={className}
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M9 12a4 4 0 0 1 0-6l3-3a4 4 0 0 1 6 6l-1 1" />
    <path d="M15 12a4 4 0 0 1 0 6l-3 3a4 4 0 0 1-6-6l1-1" />
  </svg>
);

const RulesIcon = ({ className }) => (
  <svg
    viewBox="0 0 24 24"
    className={className}
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <g transform="rotate(45 12 12)">
      <rect x="2" y="8" width="20" height="8" rx="1" ry="1" />
      <line x1="5" y1="8" x2="5" y2="11" />
      <line x1="8" y1="8" x2="8" y2="11" />
      <line x1="11" y1="8" x2="11" y2="11" />
      <line x1="14" y1="8" x2="14" y2="11" />
      <line x1="17" y1="8" x2="17" y2="11" />
      <line x1="20" y1="8" x2="20" y2="11" />
    </g>
  </svg>
);

const LogsIcon = ({ className }) => (
  <svg
    viewBox="0 0 24 24"
    className={className}
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="6" y="3" width="15" height="18" rx="2" />
    <line x1="8" y1="7" x2="16" y2="7" />
    <line x1="8" y1="11" x2="16" y2="11" />
    <line x1="8" y1="15" x2="14" y2="15" />
  </svg>
);

const PowerIcon = ({ className = "w-5 h-5" }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    className="w-6 h-6"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    {/* 外圈 */}
    <path d="M6.3 6.3a9 9 0 1 0 11.4 0" />
    {/* 中间竖线 */}
    <line x1="12" y1="2" x2="12" y2="12" />
  </svg>
);

export default function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const active = location.pathname.slice(1);
  const [system, setSystem] = useState({ type: "unknown", version: "" });

  useEffect(() => {
    getVersion()
      .then((data) => {
        const type = data.version?.toLowerCase().includes("sing-box")
          ? "sing-box"
          : "clash";
        setSystem({ type, version: data.version || "" });
      })
      .catch(() => {});
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("apiBaseUrl");
    localStorage.removeItem("apiSecret");
    window.dispatchEvent(new Event("storage")); // ✅ 通知 App 更新 hasApi
    navigate("/setup");
  };

  const KernelIcon =
    system.type === "clash"
      ? ClashIcon
      : system.type === "sing-box"
        ? SingBoxIcon
        : () => <div className="w-5 h-5 rounded-full bg-gray-500" />;

  const menu = [
    { key: "status", label: "Status", icon: StatusIcon },
    { key: "proxies", label: "Proxies", icon: ProxiesIcon },
    { key: "connections", label: "Conns", icon: ConnectionsIcon },
    { key: "rules", label: "Rules", icon: RulesIcon },
    { key: "logs", label: "Logs", icon: LogsIcon },
  ];

  return (
    <aside
      className={`
        relative
        text-white
        flex p-2 pr-1 
        md:flex-col md:w-40 md:h-auto md:space-y-1
        flex-row w-full h-12 space-x-1 md:space-x-0
      `}
    >
      {/* 顶部：内核类型 */}
      <div className="hidden md:flex justify-center px-3 py-2">
        <KernelIcon className="w-6 h-6 text-white" />
      </div>

      {/* 菜单 */}
      {menu.map(({ key, label, icon: Icon }) => (
        <Link
          key={key}
          to={`/${key}`}
          className={`
    flex items-center justify-center md:justify-start gap-2
    px-3 py-2 rounded-md transition-colors flex-1 md:flex-none
    pl-2
    ${
      active === key
        ? "text-white font-semibold"
        : "text-white/70 hover:text-white"
    }
  `}
        >
          <Icon className="w-5 h-5 shrink-0" />
          <span className="hidden md:inline text-sm font-medium">{label}</span>
        </Link>
      ))}

      {/* 底部：版本信息 */}
      <div className="hidden md:flex flex-col items-start absolute mb-3 bottom-5 px-3 py-2 pl-2 text-[10px] text-white/50">
        <div className="flex items-center gap-1 mt-1">
          <VersionIcon className="w-3 h-3 text-white/70" />
          <span>{system.version || "..."}</span>
        </div>
        <button
          onClick={handleLogout}
          className="text-xs mt-5 ml-6 rounded bg-white-600/80 hover:bg-red-700 transition"
        >
          <PowerIcon className="w-5 h-5 text-white" />
        </button>
      </div>
      {/* ✅ 底部 Credit */}
      <div className="hidden md:flex absolute left-5 bottom-1 w-full text-[8px] text-gray-200/30 hover:text-white/70 transition-colors duration-300">
        ♥ Design By Chen
      </div>
    </aside>
  );
}
