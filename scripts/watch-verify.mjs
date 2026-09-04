import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

console.log("👀 [Watch] ファイル変更監視を開始しました (Ctrl+C で終了)...");
console.log("   src/ または src-tauri/src/ の保存時に自動で即座に検証が実行されます。\n");

let debounceTimer = null;
let changedPaths = new Set();

function runVerification() {
  const paths = Array.from(changedPaths);
  changedPaths.clear();

  const hasFrontend = paths.some((p) => p.includes("src/") && !p.includes("src-tauri/"));
  const hasBackend = paths.some((p) => p.includes("src-tauri/"));

  console.log(`\n⚡ [Watch] 変更を検知しました: ${paths.join(", ")}`);

  const args = ["scripts/verify.mjs"];
  if (hasFrontend && hasBackend) {
    args.push("--all");
  }

  const child = spawn("node", args, {
    stdio: "inherit",
    shell: true,
  });

  child.on("exit", () => {
    console.log("\n👀 [Watch] 再び変更を監視中...\n");
  });
}

function watchDir(dir) {
  if (!fs.existsSync(dir)) return;
  fs.watch(dir, { recursive: true }, (eventType, filename) => {
    if (!filename) return;
    // 一時ファイルやgit、target等の除外
    if (filename.includes(".git") || filename.includes("target") || filename.includes("node_modules")) {
      return;
    }
    const fullPath = path.join(dir, filename);
    changedPaths.add(fullPath);

    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(runVerification, 500);
  });
}

watchDir("src");
watchDir("src-tauri/src");
