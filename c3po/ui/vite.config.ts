import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd());

  return {
    plugins: [react()],
    server: {
      port: 3000,
      proxy: {
        "^/v2/chat-manager": {
          target: env.VITE_CHAT_MGR_SECRET,
          changeOrigin: true,
          rewrite: (path) =>
            path.replace(/^\/v2\/chat-manager/, "/v2/chat-manager"), // Rewrite path if needed
        },
        "^/v2/admin": {
          target: env.VITE_ADMIN_SECRET,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/v2\/admin/, "/v2/admin"), // Rewrite path if needed
        },
        "^/auth": {
          target: env.VITE_ADMIN_SECRET,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/auth/, "/auth"), // Proxy OAuth routes to admin service
        },
      },
    },
  };
});
