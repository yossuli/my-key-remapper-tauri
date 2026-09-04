import { spawnSync } from "node:child_process";

const args = process.argv.slice(2);
const subCommand = args[0] || "check";
const extraArgs = args.slice(1);

const cargoExe = "/mnt/c/Users/yo44a/.cargo/bin/cargo.exe";
const manifestPath = "src-tauri/Cargo.toml";

console.log(`[cargo.mjs] Executing: ${cargoExe} ${subCommand} --manifest-path ${manifestPath}`);

const result = spawnSync(cargoExe, [subCommand, "--manifest-path", manifestPath, ...extraArgs], {
  encoding: "utf-8",
  timeout: 30000,
});

if (result.stdout) console.log(result.stdout);
if (result.stderr) console.error(result.stderr);
if (result.error) console.error("[cargo.mjs] Error:", result.error);

process.exit(result.status ?? 1);
