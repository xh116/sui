import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "./",  
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://127.0.0.1:9090", // 或你本地的 Clash/Sing-box API 地址
        changeOrigin: true,
        ws: true,
        rewrite: path => path.replace(/^\/api/, "")
      }
    }
  }
});
