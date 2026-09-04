import fs from "node:fs";
import path from "node:path";

let inputData = "";
process.stdin.setEncoding("utf-8");
process.stdin.on("data", (chunk) => {
  inputData += chunk;
});

process.stdin.on("end", () => {
  try {
    const statusFile = path.resolve(".cache/verify-status.json");

    if (fs.existsSync(statusFile)) {
      const data = JSON.parse(fs.readFileSync(statusFile, "utf-8"));
      // 直近の検証が失敗している場合、終了を阻止して自己修正を強制
      if (data.success === false) {
        const payload = {
          decision: "continue",
          reason: `【自動検証ハーネスによる遮断】\nコード変更後に実行された自動検証でエラーが検出されました。ユーザーに返答する前に問題を修正してください:\n\n${data.output}`,
        };
        process.stdout.write(JSON.stringify(payload) + "\n");
        process.exit(0);
      }
    }
  } catch (err) {
    // エラー時は通常終了
  }

  // 正常終了時は終了を許可
  process.stdout.write(JSON.stringify({ decision: "stop" }) + "\n");
  process.exit(0);
});
