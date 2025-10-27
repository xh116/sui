import { useState } from "react";
import { useNavigate } from "react-router-dom";

export default function Startup({ onSetApi }) {
  const [url, setUrl] = useState("");
  const [secret, setSecret] = useState("");
  const navigate = useNavigate();

  async function testConnection(url, secret) {
    try {
      const res = await fetch(`${url}/version`, {
        headers: secret ? { Authorization: `Bearer ${secret}` } : {},
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  const [error, setError] = useState("");

  const handleSave = async () => {
    setError(""); // 清除旧错误
    let finalUrl = url.trim();

    if (!/^https?:\/\//i.test(finalUrl)) {
      finalUrl = "http://" + finalUrl;
    }
    if (!/:\d+$/.test(finalUrl)) {
      finalUrl = finalUrl.replace(/\/$/, "");
      finalUrl += ":9090";
    }

    if (!/^https?:\/\/[\w.-]+:\d+$/.test(finalUrl)) {
      setError("Invalid http://127.0.0.1:9090");
      return;
    }

    const ok = await testConnection(finalUrl, secret);
    if (!ok) {
      setError("Fail to connect");
      return;
    }

    localStorage.setItem("apiBaseUrl", finalUrl);
    localStorage.setItem("apiSecret", secret);

    onSetApi?.();
    navigate("/status");
  };

  return (
    <div className="h-screen flex items-center justify-center bg-bg text-text">
      {/* ✅ 半透明背景 */}
      <div className="p-6 rounded-lg shadow-lg bg-neutral-800/70 backdrop-blur w-full max-w-md">
        <h2 className="text-xl font-bold mb-4 text-center">
          Clash Or Sing-box
        </h2>

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

        {/* ✅ 深色渐变透明按钮 */}
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
