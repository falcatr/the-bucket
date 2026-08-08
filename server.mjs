import http from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = fileURLToPath(new URL(".", import.meta.url));
const rootFlagIndex = process.argv.indexOf("--root");
const requestedRoot = rootFlagIndex >= 0 ? process.argv[rootFlagIndex + 1] : ".";
const publicRoot = resolve(projectRoot, requestedRoot || ".");
const port = Number(process.env.PORT || 4173);

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp"
};

function safePath(urlPath) {
  const decoded = decodeURIComponent(urlPath.split("?")[0]);
  const normalized = normalize(decoded).replace(/^([/\\])+/, "");
  const candidate = resolve(publicRoot, normalized || "index.html");

  if (!candidate.startsWith(publicRoot)) return null;
  return candidate;
}

const server = http.createServer(async (request, response) => {
  try {
    let filePath = safePath(request.url || "/");
    if (!filePath) {
      response.writeHead(403);
      response.end("Forbidden");
      return;
    }

    try {
      const info = await stat(filePath);
      if (info.isDirectory()) filePath = join(filePath, "index.html");
    } catch {
      // Para rotas futuras do app, volta ao index.html.
      filePath = join(publicRoot, "index.html");
    }

    const data = await readFile(filePath);
    const contentType = mimeTypes[extname(filePath).toLowerCase()] || "application/octet-stream";

    response.writeHead(200, {
      "Content-Type": contentType,
      "Cache-Control": "no-store"
    });
    response.end(data);
  } catch (error) {
    response.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
    response.end(`Server error: ${error.message}`);
  }
});

server.listen(port, "0.0.0.0", () => {
  console.log(`ASCII Ocean rodando em http://localhost:${port}`);
  console.log(`Celular na mesma rede: http://SEU-IP-LOCAL:${port}`);
});
