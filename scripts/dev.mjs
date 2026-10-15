import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const astroBin = path.join(root, "node_modules", "astro", "bin", "astro.mjs");
const environment = { ...process.env };

// Astro 7 auto-detaches dev servers launched by Codex and stops waiting after
// 30 seconds. Keep this project's usual foreground lifecycle so a busy cold
// start can finish and Ctrl+C still owns the server process.
delete environment.CODEX_THREAD_ID;

const server = spawn(
  process.execPath,
  [astroBin, "dev", ...process.argv.slice(2)],
  {
    cwd: root,
    env: environment,
    stdio: "inherit",
  },
);

server.on("error", (error) => {
  console.error(`Unable to start Astro: ${error.message}`);
  process.exitCode = 1;
});

server.on("exit", (code, signal) => {
  process.exitCode = code ?? (signal ? 1 : 0);
});
