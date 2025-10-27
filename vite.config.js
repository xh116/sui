import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "./",
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://127.0.0.1:9090",  
        changeOrigin: true,
        ws: true,
        rewrite: path => path.replace(/^\/api/, "")
      }
    }
  },
  build: {
    outDir: "sui"   i
  }
});
