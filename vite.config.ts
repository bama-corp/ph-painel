/// <reference types="vitest/config" />
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { spawn, type ChildProcess } from "node:child_process";
import { fileURLToPath, URL } from "node:url";

const root = fileURLToPath(new URL(".", import.meta.url));

/** Sobe a API local com o Vite — sem ela o login em :5173 falha. */
function phApiPlugin(): Plugin {
  let child: ChildProcess | null = null;
  function stop() {
    if (!child || child.killed) return;
    child.kill();
    child = null;
  }
  return {
    name: "ph-api",
    apply: "serve",
    configureServer(server) {
      if (!child) {
        child = spawn(process.execPath, ["server/dev-api.mjs"], {
          cwd: root,
          stdio: "inherit",
          env: { ...process.env, PH_API_PORT: process.env.PH_API_PORT || "8788" },
        });
        child.on("exit", (code) => {
          if (child && code && code !== 0) {
            console.warn(`[ph-api] saiu com código ${code}`);
          }
          child = null;
        });
      }
      const kill = () => stop();
      server.httpServer?.once("close", kill);
      process.once("exit", kill);
    },
  };
}

export default defineConfig({
  plugins: [react(), phApiPlugin()],
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: `http://127.0.0.1:${process.env.PH_API_PORT || 8788}`,
        changeOrigin: true,
      },
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "server/**/*.test.mjs"],
  },
});
