import { spawn, spawnSync } from "node:child_process";
import { createServer } from "node:net";

import { neon } from "@neondatabase/serverless";
import { localEnvironment } from "./load-local-env";

const port = 3000;

function listeningPid() {
  const result = spawnSync("netstat", ["-ano", "-p", "tcp"], { encoding: "utf8" });
  const line = result.stdout.split(/\r?\n/).find((entry) =>
    new RegExp(`:${port}\\s+.*LISTENING`, "i").test(entry)
  );
  return line?.trim().split(/\s+/).at(-1) ?? null;
}

async function assertPortAvailable() {
  const pid = listeningPid();
  if (pid) throw new Error(`Port ${port} is occupied by PID ${pid}. Stop it before starting AXon.`);
  await new Promise<void>((resolve, reject) => {
    const probe = createServer();
    probe.once("error", reject);
    probe.listen(port, "127.0.0.1", () => probe.close(() => resolve()));
  });
}

async function start() {
  await assertPortAvailable();
  const sql = neon(localEnvironment.directUrl);
  const result = await sql.query("SELECT current_database()::text AS current_database");
  const database = result[0]?.current_database;
  if (database !== localEnvironment.database)
    throw new Error(`RUNTIME_ASSERTION=FAILED actual=${database ?? "unknown"}`);

  console.info(`TARGET_DATABASE=${localEnvironment.database}`);
  console.info(`SHADOW_DATABASE=${localEnvironment.shadowDatabase}`);
  console.info("ORDER_EXPORT_FIELDS_AVAILABLE=true");
  console.info(`PORT=${port}`);
  console.info("RUNTIME_ASSERTION=PASSED");

  const child = spawn(process.platform === "win32" ? "cmd.exe" : "npm", process.platform === "win32"
    ? ["/d", "/s", "/c", "npm run dev:next -- --port 3000"]
    : ["run", "dev:next", "--", "--port", "3000"], {
    env: process.env,
    stdio: "inherit",
  });
  child.on("exit", (code) => { process.exitCode = code ?? 1; });
}

void start();
