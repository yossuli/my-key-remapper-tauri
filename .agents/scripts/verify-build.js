import { execSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Antigravity Stop Hook スクリプト
// 作業終了時 (Stop イベント) に自動実行され、Rust (cargo check) および TypeScript (tsc --noEmit) のビルド整合性を検証します。

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "../..");

async function main() {
  const errors = [];

  // 1. TypeScript 型チェック
  try {
    execSync("npm run typecheck", {
      cwd: projectRoot,
      stdio: "pipe",
      timeout: 30_000,
    });
  } catch (err) {
    const output =
      (err.stdout?.toString() || "") + (err.stderr?.toString() || "");
    errors.push(`【TypeScript 型エラー】\n${output.trim()}`);
  }

  // 2. Cargo Check (Rust バックエンド)
  try {
    const cargoPath = "/mnt/c/Users/yo44a/.cargo/bin/cargo.exe";
    const cmd = `${cargoPath} check --manifest-path src-tauri/Cargo.toml < /dev/null`;
    execSync(cmd, {
      cwd: projectRoot,
      stdio: "pipe",
      timeout: 45_000,
    });
  } catch (err) {
    const output =
      (err.stdout?.toString() || "") + (err.stderr?.toString() || "");
    errors.push(`【Rust Cargo Check エラー】\n${output.trim()}`);
  }

  if (errors.length > 0) {
    const reason = `[Stop Hook 自動検知] ビルドまたは型チェックでエラーが検出されました。修正を完了してください:\n\n${errors.join(
      "\n\n"
    )}`;
    console.log(
      JSON.stringify({
        decision: "continue",
        reason,
      })
    );
  } else {
    console.log(
      JSON.stringify({
        decision: "allow",
      })
    );
  }
}

main().catch(() => {
  console.log(JSON.stringify({ decision: "allow" }));
});
