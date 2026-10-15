import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const production = process.env.PLAYWRIGHT_USE_PREVIEW === "1";
const externalServer = process.env.PLAYWRIGHT_EXTERNAL_SERVER === "1";
const astroCli = path.join(root, "node_modules/astro/bin/astro.mjs");
const playwrightCli = path.join(root, "node_modules/@playwright/test/cli.js");
const testEnvironment = { ...process.env };
// Astro's Codex integration can detach a dev server before it is ready. Keep
// this runner's server in the foreground so the tests always exercise the
// current checkout and the process can be cleaned up deterministically.
delete testEnvironment.CODEX_THREAD_ID;
const serverArguments = [
  astroCli,
  production ? "preview" : "dev",
  "--host",
  "127.0.0.1",
  "--port",
  "4333",
];
const server = externalServer
  ? null
  : spawn(process.execPath, serverArguments, {
      cwd: root,
      env: testEnvironment,
      stdio: "inherit",
    });

async function waitForServer() {
  // A cold Astro dev compile can exceed one minute on the full universe bundle.
  // Keep the readiness window above that cost while still failing immediately
  // when the owned server process exits (for example, on a port conflict).
  for (let attempt = 0; attempt < 360; attempt += 1) {
    if (server.exitCode !== null)
      throw new Error(
        "The Astro browser-test server exited before it was ready.",
      );
    try {
      const response = await fetch("http://127.0.0.1:4333");
      if (response.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error("Timed out waiting for the Astro browser-test server.");
}

function runPlaywright() {
  return new Promise((resolve, reject) => {
    const runner = spawn(
      process.execPath,
      [playwrightCli, "test", ...process.argv.slice(2)],
      {
        cwd: root,
        env: { ...testEnvironment, PLAYWRIGHT_EXTERNAL_SERVER: "1" },
        stdio: "inherit",
      },
    );
    runner.once("error", reject);
    runner.once("exit", (code, signal) =>
      signal
        ? reject(new Error(`Playwright exited after ${signal}.`))
        : resolve(code ?? 1),
    );
  });
}

let exitCode = 1;
try {
  if (!externalServer) await waitForServer();
  exitCode = await runPlaywright();
} finally {
  server?.kill();
}
process.exitCode = exitCode;
