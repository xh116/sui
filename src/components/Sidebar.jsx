import { useEffect, useLayoutEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { clearApiConfig, getApiMode, getVersion, API_MODES } from "../api";

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

// 图标：Clash / mihomo（猫头线稿，与菜单图标同一风格）
const ClashIcon = ({ className = "w-6 h-6" }) => (
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
    {/* 耳朵 */}
    <path d="M6.5 7.9 5.5 3.1 10.3 6.2" />
    <path d="M17.5 7.9 18.5 3.1 13.7 6.2" />

    {/* 脸 */}
    <path d="M12 6.1c-3.6 0-6.5 2.5-6.5 6.1 0 3.8 2.9 6.8 6.5 6.8s6.5-3 6.5-6.8c0-3.6-2.9-6.1-6.5-6.1Z" />

    {/* 眼睛 */}
    <circle cx="9.3" cy="12.2" r="0.85" fill="currentColor" stroke="none" />
    <circle cx="14.7" cy="12.2" r="0.85" fill="currentColor" stroke="none" />

    {/* 鼻子 */}
    <path d="M11.3 14.6 12.7 14.6 12 15.5Z" fill="currentColor" stroke="none" />

    {/* 嘴 */}
    <path d="M12 15.5v.9" />
    <path d="M12 16.4c-.6 0-1.1-.3-1.5-.8" />
    <path d="M12 16.4c.6 0 1.1-.3 1.5-.8" />

    {/* 胡须 */}
    <path d="M5.4 12.3 2.3 12.1" />
    <path d="M5.8 14.5 2.5 15" />
    <path d="M18.6 12.3 21.7 12.1" />
    <path d="M18.2 14.5 21.5 15" />
  </svg>
);

// 图标：Sing-box（等距纸箱线稿 + 胶带，与菜单图标同一风格）
const SingBoxIcon = ({ className = "w-6 h-6" }) => (
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
    {/* 箱体 */}
    <path d="M12 2.5 20.5 7.15 20.5 16.85 12 21.5 3.5 16.85 3.5 7.15Z" />
    <path d="M3.5 7.15 12 11.8 20.5 7.15" />
    <path d="M12 11.8v9.7" />

    {/* 胶带 */}
    <path d="M7.1 5.25 15.6 9.85v4.35" />
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
    className={className}
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M6.3 6.3a9 9 0 1 0 11.4 0" />
    <line x1="12" y1="2" x2="12" y2="12" />
  </svg>
);

// 图标：月亮 / 太阳（与菜单图标同一线稿风格）
const MoonIcon = ({ className = "w-5 h-5" }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    className={className}
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
  </svg>
);

const SunIcon = ({ className = "w-5 h-5" }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    className={className}
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4" />
  </svg>
);


// 主题开关：月亮 / 太阳 左右两段选择
const ThemeSwitch = ({ theme, onChange, className = "" }) => (
  <div
    className={`theme-switch flex items-center gap-0.5 rounded-md p-0.5 min-w-[56px] ${className}`}
  >
    <button
      type="button"
      title="深色模式"
      aria-label="深色模式"
      data-active={theme === "dark" ? "true" : "false"}
      onClick={() => onChange("dark")}
      className="flex-1 flex items-center justify-center px-1.5 py-1 rounded"
    >
      <MoonIcon className="w-3 h-3" />
    </button>
    <button
      type="button"
      title="浅色模式"
      aria-label="浅色模式"
      data-active={theme === "light" ? "true" : "false"}
      onClick={() => onChange("light")}
      className="flex-1 flex items-center justify-center px-1.5 py-1 rounded"
    >
      <SunIcon className="w-3 h-3" />
    </button>
  </div>
);

export default function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const active = location.pathname.slice(1);
  const [system, setSystem] = useState({
    type: "unknown",
    version: "",
    apiMode: getApiMode(),
  });
  const [theme, setTheme] = useState(
    () => localStorage.getItem("theme") || "dark",
  );

  useLayoutEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("theme", theme);
  }, [theme]);


  useEffect(() => {
    getVersion()
      .then((data) => {
        const type = data.version?.toLowerCase().includes("sing-box")
          ? "sing-box"
          : "clash";
        setSystem({
          type,
          version: data.version || "",
          apiMode: getApiMode(),
        });
      })
      .catch(() => {});
  }, []);

  const handleLogout = () => {
    clearApiConfig();
    window.dispatchEvent(new Event("storage"));
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
  ].filter(({ key }) => key !== "rules" || system.apiMode !== API_MODES.grpc);

  return (
    <aside
      className={`
        text-white
        flex p-2
        md:flex-col md:w-40 md:h-auto md:space-y-1

        flex-row h-14 space-x-1 md:space-x-0
        fixed md:relative bottom-1 left-3 right-3 z-50
        backdrop-blur-md md:backdrop-blur-none 
        rounded-xl     
      `}
    >
      <div className="hidden md:flex justify-start pl-2.5 py-2">
        <KernelIcon className="w-[72px] h-[72px] text-white" />
      </div>

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
        : "text-white/60 hover:text-white"
    }
  `}
        >
          <Icon className="w-5 h-5 shrink-0" />
          <span className="hidden md:inline text-sm font-medium">{label}</span>
        </Link>
      ))}
      {/* 移动端：主题开关 + 退出留在底部导航条内 */}
      <ThemeSwitch theme={theme} onChange={setTheme} className="md:hidden" />
      <button
        type="button"
        onClick={handleLogout}
        title="退出登录"
        aria-label="退出登录"
        className="md:hidden flex items-center justify-center px-2 text-white/60 hover:text-white transition-colors"
      >
        <PowerIcon className="w-4 h-4" />
      </button>

      {/* 桌面端底部：主题开关 + 退出 / 版本 / 版权，整体贴左、不撑满 */}
      <div className="hidden md:flex flex-col items-start absolute left-4 bottom-3 gap-2">
        <div className="flex items-center gap-6">
          <ThemeSwitch theme={theme} onChange={setTheme} />
          <button
            type="button"
            onClick={handleLogout}
            title="退出登录"
            aria-label="退出登录"
            className="text-white/60 hover:text-white transition-colors"
          >
            <PowerIcon className="w-3 h-3" />
          </button>
        </div>

        <a
          href={system.type === "clash" ? "https://github.com/metacubex/mihomo" : "https://github.com/SagerNet/sing-box"}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 min-w-0 text-[10px] text-white/40 hover:text-white/70 transition-colors duration-200 decoration-dotted"
        >
          <VersionIcon className="w-3 h-3 shrink-0 text-white/70" />
          <span className="truncate">{system.version || "..."}</span>
        </a>

        <div className="text-[8px] text-gray-200/30 hover:text-white/70 transition-colors duration-300">
          <a
            href="https://github.com/xh116/sui"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 hover:text-white/80"
          >
            ♥ Design By Chen
          </a>
        </div>
      </div>
    </aside>
  );
}
