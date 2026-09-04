import { execSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

// stdin を読み込む
let inputData = "";
process.stdin.setEncoding("utf-8");
process.stdin.on("data", (chunk) => {
  inputData += chunk;
});

process.stdin.on("end", () => {
  try {
    const cacheDir = path.resolve(".cache");
    if (!fs.existsSync(cacheDir)) {
      fs.mkdirSync(cacheDir, { recursive: true });
    }

    const statusFile = path.join(cacheDir, "verify-status.json");

    // 差分検証を実行
    const verifyResult = spawnSync("node", ["scripts/verify.mjs"], {
      encoding: "utf-8",
      shell: true,
    });

    const success = verifyResult.status === 0;
    const output = (verifyResult.stdout || "") + "\n" + (verifyResult.stderr || "");

    fs.writeFileSync(
      statusFile,
      JSON.stringify({
        timestamp: Date.now(),
        success,
        output: output.trim(),
      }, null, 2),
      "utf-8"
    );

    if (!success) {
      console.error("\n⚠️ [Auto-Verify Hook] 変更後の自動検証でエラーが検出されました。");
    }
  } catch (err) {
    // フック自身の例外でプロセスを壊さない
  } finally {
    // PostToolUse は空の JSON オブジェクトを出力する規約
    process.stdout.write("{}\n");
    process.exit(0);
  }
});
