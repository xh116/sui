import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { detectApi, setApiConfig, setApiMode } from "../api";

export default function Startup({ onSetApi }) {
  const [url, setUrl] = useState("");
  const [secret, setSecret] = useState("");
  const [error, setError] = useState(""); // 页面显示错误
  const navigate = useNavigate();

  const handleSave = async () => {
    setError(""); // 清除旧错误
    let finalUrl = url.trim();

    // 自动加 http://
    if (!/^https?:\/\//i.test(finalUrl)) {
      finalUrl = "http://" + finalUrl;
    }

    // 默认端口仅用于裸地址；显式端口必须保留
    try {
      const parsed = new URL(finalUrl);
      if (!parsed.port) parsed.port = "9090";
      finalUrl = parsed.toString().replace(/\/$/, "");
    } catch {
      setError("Invalid URL. Example: http://127.0.0.1:9090");
      return;
    }

    if (!/^https?:\/\/.+:\d+$/i.test(finalUrl)) {
      setError("Invalid URL. Example: http://127.0.0.1:9090");
      return;
    }

    // 探测后端类型：sing-box API（gRPC-Web）优先，否则 Clash API
    let detected;
    try {
      detected = await detectApi(finalUrl, secret);
    } catch (err) {
      setError(`Fail to connect: ${err.message || "Network error"}`);
      return;
    }

    // 成功存储
    setApiConfig(finalUrl, secret);
    setApiMode(detected.mode);

    onSetApi?.();
    navigate("/status");
  };

  return (
    <div className="h-screen flex items-center justify-center bg-bg text-text">
      <div className="p-6 rounded-lg shadow-lg bg-neutral-800/70 backdrop-blur w-full max-w-md">
        <h2 className="text-xl font-bold mb-4 text-center">
          Clash Or Sing-box
        </h2>

        {/* 错误提示 */}
        {error && (
          <div className="text-red-400 p-2 mb-4">
            {error}
          </div>
        )}

        {/* URL 输入框 */}
        <input
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="http://127.0.0.1:9090"
          className="w-full p-2 rounded bg-neutral-700/50 text-white mb-3 placeholder-gray-400/20 focus:outline-none focus:ring-2 focus:ring-accent"
        />

        {/* Secret 输入框 */}
        <input
          type="password"
          value={secret}
          onChange={(e) => setSecret(e.target.value)}
          placeholder="Secret (Optional)"
          className="w-full p-2 rounded bg-neutral-700/50 text-white mb-4 placeholder-gray-400/20 focus:outline-none focus:ring-2 focus:ring-accent"
        />

        {/* 按钮 */}
        <button
          onClick={handleSave}
          className="w-full py-2 rounded font-semibold 
                     bg-gradient-to-r from-neutral-900/80 to-neutral-700/60 
                     text-white hover:opacity-90 transition"
        >
          Enter
        </button>
      </div>
    </div>
  );
}
