/** Strict static hosting for production preview tests. Never changes root dist/. */
import { spawnSync } from "node:child_process";
import { createServer } from "node:http";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { extname, join, resolve, sep } from "node:path";

const directory = await mkdtemp(join(tmpdir(), "biomechanics-preview-"));
const requestedBase = process.env.VITE_BASE_PATH || "/Biomechanic_visualization/pr-1/";
const base = requestedBase.endsWith("/") ? requestedBase : `${requestedBase}/`;
const siblingBase = "/__biomechanics-preview-isolation__/";
const build = (base, output) => {
  for (const args of [
    ["node_modules/vite/bin/vite.js", "build", "--outDir", output, "--emptyOutDir"],
    ["scripts/generate-sw.mjs", output],
  ]) {
    const result = spawnSync(process.execPath, args, {
      env: { ...process.env, VITE_BASE_PATH: base }, stdio: "inherit",
    });
    if (result.error || result.status !== 0) throw result.error || new Error(`Preview build failed: ${args.join(" ")}`);
  }
};

let server;
const cleanup = async () => {
  server?.close();
  await rm(directory, { recursive: true, force: true });
};
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => void cleanup().then(() => process.exit(0)));
try {
  if (base === "/" || base === siblingBase) throw new Error("Choose a nested VITE_BASE_PATH different from the isolation fixture.");
  const primary = process.env.PREVIEW_BUILD_DIR ? resolve(process.env.PREVIEW_BUILD_DIR) : join(directory, "primary");
  if (process.env.PREVIEW_BUILD_DIR) await stat(join(primary, "sw.js"));
  else build(base, primary);
  const sibling = join(directory, "sibling");
  build(siblingBase, sibling);
  const root = join(directory, "root");
  build("/", root);
  const mounts = [{ base, path: primary }, { base: siblingBase, path: sibling }, { base: "/", path: root }]
    .sort((a, b) => b.base.length - a.base.length);
  const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".webmanifest": "application/manifest+json", ".svg": "image/svg+xml", ".png": "image/png", ".woff2": "font/woff2" };
  server = createServer(async (request, response) => {
    try {
      const pathname = decodeURIComponent(new URL(request.url, "http://127.0.0.1").pathname);
      if (pathname === "/__preview-test-ready__") { response.end("ready"); return; }
      const mount = mounts.find(item => pathname.startsWith(item.base));
      const relative = pathname.slice(mount.base.length) || "index.html";
      const file = resolve(mount.path, relative);
      if (!file.startsWith(`${mount.path}${sep}`)) { response.writeHead(403).end(); return; }
      const content = await readFile(file);
      response.writeHead(200, { "Content-Type": types[extname(file)] || "application/octet-stream", "Cache-Control": "no-store" });
      response.end(content);
    } catch { response.writeHead(404).end("File not found"); }
  });
  server.listen(4175, "127.0.0.1");
} catch (error) {
  await cleanup();
  throw error;
}
