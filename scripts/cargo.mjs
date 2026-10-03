import { execSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const subCommand = args[0] || "check";
const extraArgs = args.slice(1);

function resolveCargo() {
  if (process.env.CARGO_BIN && fs.existsSync(process.env.CARGO_BIN)) {
    return process.env.CARGO_BIN;
  }

  const isWindows = process.platform === "win32";
  const candidates = isWindows ? ["cargo.exe", "cargo"] : ["cargo", "cargo.exe"];

  // 1. Try finding in PATH using 'where' (Windows) or 'which' (Unix/WSL)
  const lookupCmd = isWindows ? "where" : "which";
  for (const name of candidates) {
    try {
      const output = execSync(`${lookupCmd} ${name}`, {
        encoding: "utf-8",
        stdio: ["ignore", "pipe", "ignore"],
      }).trim();
      const firstLine = output.split(/[\r\n]+/)[0];
      if (firstLine && fs.existsSync(firstLine)) {
        return firstLine;
      }
    } catch {
      // not found, continue
    }
  }

  // 2. Try standard fallback locations
  const homeDir = process.env.HOME || process.env.USERPROFILE || "";
  const standardPaths = [
    path.join(homeDir, ".cargo", "bin", isWindows ? "cargo.exe" : "cargo"),
    path.join(homeDir, ".cargo", "bin", "cargo"),
    path.join(homeDir, ".cargo", "bin", "cargo.exe"),
  ];

  for (const candidate of standardPaths) {
    if (candidate && fs.existsSync(candidate)) {
      return candidate;
    }
  }

  // Fallback to bare command name and let OS try to execute it
  return isWindows ? "cargo.exe" : "cargo";
}

const cargoExe = resolveCargo();
const manifestPath = "src-tauri/Cargo.toml";

const cargoArgs = [subCommand, "--manifest-path", manifestPath, ...extraArgs];
if (subCommand === "test" && !extraArgs.some(a => a.includes("test-threads"))) {
  if (!cargoArgs.includes("--")) {
    cargoArgs.push("--");
  }
  cargoArgs.push("--test-threads=1");
}

console.log(
  `[cargo.mjs] Executing: ${cargoExe} ${cargoArgs.join(" ")}`
);

const result = spawnSync(
  cargoExe,
  cargoArgs,
  {
    encoding: "utf-8",
    timeout: 120_000,
    env: {
      ...process.env,
      TS_RS_EXPORT_DIR: path.resolve("src/types/generated"),
    },
  }
);

if (result.stdout) {
  console.log(result.stdout);
}
if (result.stderr) {
  console.error(result.stderr);
}
if (result.error) {
  console.error("[cargo.mjs] Error:", result.error);
}

process.exit(result.status ?? 1);
