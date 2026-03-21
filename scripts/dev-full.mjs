import { rm } from "node:fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";

const nextDir = path.join(process.cwd(), ".next");
await rm(nextDir, { recursive: true, force: true });

const child = spawn("npx", ["next", "dev", ...process.argv.slice(2)], {
  stdio: "inherit",
  env: process.env
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 0);
});
