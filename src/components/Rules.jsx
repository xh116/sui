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
          {/* 左侧编号 */}
          <div className="w-10 flex justify-center items-center text-yellow-300 font-semibold text-sm">
            #{i}
          </div>

          {/* 中间内容 */}
          <div className="flex-1 ml-2 space-y-1 text-xs text-gray-300">
            <div className="flex gap-2">
              <span className="text-gray-400 font-normal">Payload:</span>
              <span className="break-words">{r.payload}</span>
            </div>
            <div className="flex gap-2">
              <span className="text-gray-400 font-normal">Proxy:</span>
              <span>{r.proxy}</span>
            </div>
          </div>

          {/* 右侧 Type */}
          <div className="w-20 flex text-cyan-500 justify-center items-center text-xs font-normal">
            {r.type}
          </div>
        </div>
      ))}
    </div>
  );
}
