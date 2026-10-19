import {
  HashRouter as Router,
  Routes,
  Route,
  Navigate,
  useLocation,
} from "react-router-dom";
import { useState, useEffect } from "react";
import Sidebar from "./components/Sidebar";
import StatusCard from "./components/StatusCard";
import TrafficChart from "./components/TrafficChart";
import MemoryChart from "./components/MemoryChart";
import ProxyList from "./components/ProxyList";
import Connections from "./components/Connections";
import Rules from "./components/Rules";
import LogViewer from "./components/LogViewer";
import Startup from "./components/Startup";
import StatisticsChart from "./components/StatisticsChart";

function Layout() {
  const { pathname } = useLocation();
  // Logs 是"铺满高度"的控制台页：桌面端底部不留白，让日志一直铺到窗口底部，
  // 否则最下面会露出一条背景色，看起来像日志被切掉/被背景盖住。
  const isLogs = pathname === "/logs";
  return (
    <div className="flex flex-col md:flex-row h-screen h-dvh bg-bg text-text px-0 md:px-8">
      <Sidebar />
      {/* 移动端底部有一条 fixed 的导航条（高 56 + 4 边距），
          内容区留出 pb-20 以免最后一行被它盖住且滚不到 */}
      <div
        className={`flex-1 p-4 overflow-auto ${
          isLogs ? "pb-20 md:pb-0" : "pb-20 md:pb-4"
        }`}
      >
        <Routes>
          <Route path="/" element={<Navigate to="/status" />} />
          <Route
            path="/status"
            element={
              <div className="flex flex-col">
                <div className="my-10">
                  <StatusCard />
                </div>

                {/* Traffic 和 Memory 左右并排 */}
                <div className="my-10 flex flex-col md:flex-row gap-4">
                  <div className="flex-1">
                    <TrafficChart />
                  </div>
                  <div className="flex-1">
                    <MemoryChart />
                  </div>
                </div>

                {/* StatisticsChart 独立在下方 */}
                <div className="my-5">
                  <StatisticsChart />
                </div>
              </div>
            }
          />
          <Route path="/proxies" element={<ProxyList />} />
          <Route path="/connections" element={<Connections />} />
          <Route path="/rules" element={<Rules />} />
          <Route path="/logs" element={<LogViewer />} />
          <Route path="*" element={<Navigate to="/status" replace />} />
        </Routes>
      </div>
    </div>
  );
}

export default function App() {
  const [hasApi, setHasApi] = useState(!!localStorage.getItem("apiBaseUrl"));

  useEffect(() => {
    const handler = () => setHasApi(!!localStorage.getItem("apiBaseUrl"));
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, []);

  return (
    <Router>
      <Routes>
        {!hasApi ? (
          <>
            <Route
              path="/setup"
              element={<Startup onSetApi={() => setHasApi(true)} />}
            />
            <Route path="*" element={<Navigate to="/setup" />} />
          </>
        ) : (
          <Route path="/*" element={<Layout />} />
        )}
      </Routes>
    </Router>
  );
}
