import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const clientDir = path.join(rootDir, "client");
const clientDistIndex = path.join(clientDir, "dist", "index.html");

const run = (cmd, env = process.env) => {
  console.log(`==> Running: ${cmd}`);
  execSync(cmd, { cwd: rootDir, stdio: "inherit", env });
};

const buildEnv = {
  ...process.env,
  VITE_SITE_URL:
    process.env.VITE_SITE_URL ||
    process.env.FRONTEND_URL ||
    "https://www.graciafab.com",
};

run("npm --prefix client install --include=dev --no-audit --no-fund", buildEnv);
run("npm --prefix client run build", buildEnv);

if (!fs.existsSync(clientDistIndex)) {
  throw new Error("Client build failed: client/dist/index.html was not generated.");
}

// Remove client/node_modules after building client/dist so Hostinger's
// publishing step only copies the static dist assets and server dependencies.
const clientNodeModules = path.join(clientDir, "node_modules");
if (fs.existsSync(clientNodeModules)) {
  console.log("==> Cleaning up client/node_modules after static build");
  fs.rmSync(clientNodeModules, { recursive: true, force: true });
}

console.log("==> Single-site build complete (client/dist + server/server.js)");
