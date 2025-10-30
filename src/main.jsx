import React, { useEffect } from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import "./index.css";
import twemoji from "twemoji";

function Root() {
  useEffect(() => {
    // 第一次渲染时替换页面上所有 emoji
    const parseTwemoji = () => {
      twemoji.parse(document.body, {
        folder: "svg", // 使用 SVG
        ext: ".svg",
      });
    };

    parseTwemoji();

    // 可选：监听动态新增内容，自动替换 emoji
    const observer = new MutationObserver(parseTwemoji);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => observer.disconnect();
  }, []);

  return <App />;
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>,
);
