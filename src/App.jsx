import {
  HashRouter as Router,
  Routes,
  Route,
  Navigate,
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
  return (
    <div className="flex flex-col md:flex-row h-screen bg-bg text-text px-0 md:px-8">
      <Sidebar />
      <div className="flex-1 p-4 overflow-auto">
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
