import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // REST API
      "/api": {
        target:      "http://127.0.0.1:5000",
        changeOrigin: true,
      },
      // Socket.IO handshake (HTTP upgrade)
      "/socket.io": {
        target:  "http://127.0.0.1:5000",
        changeOrigin: true,
        ws: true,         // proxy WebSocket upgrade
      },
    },
  },
  define: {
    // Allow override via .env — default points straight to Flask
    "import.meta.env.VITE_SOCKET_URL": JSON.stringify(
      process.env.VITE_SOCKET_URL || "http://127.0.0.1:5000"
    ),
  },
});
