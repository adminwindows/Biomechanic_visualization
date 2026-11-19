import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const configured = loadEnv(mode, ".", "VITE_BASE_PATH").VITE_BASE_PATH?.trim() || "/";
  // A deployment is a local path, never a remote URL or a relative traversal.
  if (!/^\/(?:[A-Za-z0-9._~-]+\/)*[A-Za-z0-9._~-]*$/.test(configured) ||
      configured.split("/").some(segment => segment === "." || segment === "..")) {
    throw new Error("VITE_BASE_PATH must be an absolute URL path such as /Biomechanic_visualization/pr-1/.");
  }
  const base = configured.endsWith("/") ? configured : `${configured}/`;
  return { base, plugins: [react()] };
});
