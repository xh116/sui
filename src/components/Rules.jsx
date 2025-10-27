import { useEffect, useState } from "react";
import { getRules } from "../api/clash";

export default function Rules() {
  const [rules, setRules] = useState([]);

  useEffect(() => {
    (async () => {
      const res = await getRules();
      setRules(res.rules || []);
    })();
  }, []);

  return (
    <div className="p-4 text-gray-200">
      <h1 className="text-xl font-bold mb-4">Rules</h1>

      {rules.length === 0 ? (
        <p className="text-gray-400">No rules</p>
      ) : (
        <>
          {/* 💻 桌面端表格 */}
          <div className="overflow-x-auto hidden md:block">
            <table className="w-full text-sm">
              <thead className="bg-gradient-to-r from-yellow-400/30 to-yellow-400/10 text-left text-gray-200">
                <tr>
                  <th className="px-3 py-2">#</th>
                  <th className="px-3 py-2">Type</th>
                  <th className="px-3 py-2">Payload</th>
                  <th className="px-3 py-2">Proxy</th>
                </tr>
              </thead>
              <tbody>
                {rules.map((r, i) => (
                  <tr
                    key={i}
                    className="border-t border-gray-700 hover:bg-yellow-400/20 text-xs text-gray-200/60"
                  >
                    <td className="px-3 py-1">{i}</td>
                    <td className="px-3 py-1 font-normal">{r.type}</td>
                    <td
                      className="px-3 py-1 truncate max-w-xs"
                      title={r.payload}
                    >
                      {r.payload}
                    </td>
                    <td className="px-3 py-1">{r.proxy}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* 📱 移动端卡片 */}
          <div className="block md:hidden space-y-1 text-[10px]">
            {rules.map((r, i) => (
              <div
                key={i}
                className="bg-gray-800/60 rounded-md px-3 py-2 border border-gray-700 shadow-sm"
              >
                <div className="flex justify-between items-center mb-1">
                  <span className="text-yellow-300 font-semibold">#{i}</span>
                  <span className="text-gray-400 text-[10px]">{r.type}</span>
                </div>
                <div className="text-gray-300 break-words mb-1">
                  <span className="text-gray-400">Payload:</span> {r.payload}
                </div>
                <div className="text-gray-400 text-[10px]">
                  Proxy: <span className="text-gray-200">{r.proxy}</span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
