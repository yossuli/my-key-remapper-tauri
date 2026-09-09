import fs from "node:fs";
import path from "node:path";

let inputData = "";
process.stdin.setEncoding("utf-8");
process.stdin.on("data", (chunk) => {
  inputData += chunk;
});

process.stdin.on("end", () => {
  try {
    const projectRoot = path.resolve("..");
    const statusFile = path.join(projectRoot, ".cache/verify-status.json");
    if (fs.existsSync(statusFile)) {
      // ターン開始時にステータスをリセット
      fs.unlinkSync(statusFile);
    }
  } catch {
    // 無視
  }

  // PreInvocation は空の injectSteps を返して完了
  process.stdout.write(JSON.stringify({ injectSteps: [] }) + "\n");
  process.exit(0);
});
