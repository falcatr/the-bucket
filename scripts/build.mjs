import { cp, mkdir, rm } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptsDir = fileURLToPath(new URL(".", import.meta.url));
const projectRoot = resolve(scriptsDir, "..");
const dist = resolve(projectRoot, "dist");

await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });
await cp(resolve(projectRoot, "index.html"), resolve(dist, "index.html"));
await cp(
  resolve(projectRoot, "game-config.json"),
  resolve(dist, "game-config.json")
);
await cp(resolve(projectRoot, "src"), resolve(dist, "src"), { recursive: true });
await cp(resolve(projectRoot, "public"), dist, { recursive: true });

console.log("Build estático criado em dist/");
