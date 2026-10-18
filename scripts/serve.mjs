// Minimal local static server (node:http, no dependencies).
// Usage: node scripts/serve.mjs [port]  ->  http://localhost:8080
import http from "node:http";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8",
};

export function contentTypeFor(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return MIME_TYPES[ext] ?? "application/octet-stream";
}

// Fonts never change under the same name, so they may be cached (a year): with no-store, a font-display: optional
// font almost never arrives in time locally and the fallback is shown (T33, user decision). Everything else stays
// no-store so a reload always shows the last edit.
export function cacheControlFor(filePath) {
  return path.extname(filePath).toLowerCase() === ".woff2" ? "public, max-age=31536000" : "no-store";
}

// Returns the absolute file path for a request URL, or null if it is unsafe.
export function resolveSafePath(root, url) {
  const rawPath = String(url).split(/[?#]/)[0];
  let decoded;
  try {
    decoded = decodeURIComponent(rawPath);
  } catch {
    return null;
  }
  if (decoded.includes("\0")) return null;
  const segments = decoded.split(/[\/]+/);
  if (segments.includes("..")) return null;
  let relative = segments.filter((s) => s !== "" && s !== ".").join(path.sep);
  if (relative === "" || /[\/]$/.test(decoded)) {
    relative = path.join(relative, "index.html");
  }
  const absRoot = path.resolve(root);
  const target = path.resolve(absRoot, relative);
  if (target !== absRoot && !target.startsWith(absRoot + path.sep)) return null;
  return target;
}

function startServer(root, port) {
  const server = http.createServer(async (req, res) => {
    const filePath = resolveSafePath(root, req.url);
    if (!filePath) {
      res.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Bad request");
      return;
    }
    try {
      const info = await stat(filePath);
      if (!info.isFile()) throw new Error("not a file");
      const body = await readFile(filePath);
      res.writeHead(200, { "Content-Type": contentTypeFor(filePath), "Cache-Control": cacheControlFor(filePath) });
      res.end(body);
    } catch {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Not found");
    }
  });
  server.listen(port, () => console.log(`Serving ${root} at http://localhost:${port}`));
  return server;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const port = Number(process.argv[2]) || 8080;
  startServer(root, port);
}
