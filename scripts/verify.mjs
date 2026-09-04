import { execSync, spawnSync } from "node:child_process";
import { resolve } from "node:path";

const args = process.argv.slice(2);
const isStaged = args.includes("--staged");
const isAll = args.includes("--all");

console.log("\n🔍 [Verify] 変更内容の自動検証を開始します...");

let changedFiles = [];
if (isAll) {
  changedFiles = ["src/", "src-tauri/"];
} else {
  try {
    const diffCmd = isStaged ? "git diff --cached --name-only" : "git diff --name-only HEAD";
    const output = execSync(diffCmd, { encoding: "utf-8" }).trim();
    changedFiles = output ? output.split("\n") : [];
  } catch (err) {
    console.warn("⚠️ Git差分の取得に失敗したため、全検証を実行します。");
    changedFiles = ["src/", "src-tauri/"];
  }
}

const checkFrontend = isAll || changedFiles.some((f) => f.startsWith("src/") || f.endsWith(".ts") || f.endsWith(".tsx") || f === "package.json" || f === "tsconfig.json");
const checkBackend = isAll || changedFiles.some((f) => f.startsWith("src-tauri/"));

if (!checkFrontend && !checkBackend) {
  console.log("✨ 対象となるコード変更がありません（ドキュメント等の更新）。検証をスキップします。\n");
  process.exit(0);
}

let hasError = false;

// 1. フロントエンドの型チェック
if (checkFrontend) {
  console.log("\n📦 [Frontend] TypeScript 型チェックを実行中 (tsc --noEmit)...");
  const feResult = spawnSync("npm", ["run", "typecheck"], {
    stdio: "inherit",
    shell: true,
  });
  if (feResult.status !== 0) {
    console.error("❌ [Frontend] 型チェックでエラーが発生しました。");
    hasError = true;
  } else {
    console.log("✅ [Frontend] 型チェック成功！");
  }
}

// 2. バックエンドのコンパイルチェック & テスト
if (checkBackend) {
  console.log("\n🦀 [Backend] Rust コンパイルチェックを実行中 (cargo check)...");
  const beCheckResult = spawnSync("node", ["scripts/cargo.mjs", "check"], {
    stdio: "inherit",
    shell: true,
  });
  if (beCheckResult.status !== 0) {
    console.error("❌ [Backend] コンパイルチェックでエラーが発生しました。");
    hasError = true;
  } else {
    console.log("✅ [Backend] コンパイルチェック成功！");
  }

  if (!hasError) {
    console.log("\n🧪 [Backend] Rust 単体テストを実行中 (cargo test)...");
    const beTestResult = spawnSync("node", ["scripts/cargo.mjs", "test"], {
      stdio: "inherit",
      shell: true,
    });
    if (beTestResult.status !== 0) {
      console.error("❌ [Backend] 単体テストで失敗が発生しました。");
      hasError = true;
    } else {
      console.log("✅ [Backend] 単体テスト成功！");
    }
  }
}

if (hasError) {
  console.error("\n❌ [Verify] 検証に失敗しました。問題を修正してからコミットしてください。\n");
  process.exit(1);
} else {
  console.log("\n🎉 [Verify] すべての検証に合格しました！\n");
  process.exit(0);
}
