import path from "node:path";

// 標準入力から hook ペイロードを受け取る
let inputData = "";
process.stdin.setEncoding("utf-8");

process.stdin.on("data", (chunk) => {
  inputData += chunk;
});

process.stdin.on("end", () => {
  try {
    const payload = JSON.parse(inputData || "{}");
    const toolCall = payload.toolCall;

    if (toolCall && toolCall.args) {
      // 引数に含まれる文字列全体を再帰的にチェック
      const hasDirectAppDataAccess = checkValuesForDirectAppData(toolCall.args);

      if (hasDirectAppDataAccess) {
        const response = {
          decision: "deny",
          reason:
            "【アクセス拒否】Windows の AppData ディレクトリ（my-key-remapper）への直接アクセスはブロックされました。ワークスペース直下のシンボリックリンク 'appdata-link' 経由でアクセスしてください。",
        };
        process.stdout.write(JSON.stringify(response) + "\n");
        process.exit(0);
      }
    }
  } catch (err) {
    // パースエラー等の例外時はプロセスを落とさず通常フローに委ねる
  }

  // ブロック対象でない場合は通常判定（ask）へ
  process.stdout.write(JSON.stringify({ decision: "ask" }) + "\n");
  process.exit(0);
});

/**
 * オブジェクト内のすべての文字列値を検査し、
 * appdata-link を経由しない AppData/Roaming/my-key-remapper への直接アクセスが含まれているかを判定する
 */
function checkValuesForDirectAppData(obj) {
  if (!obj) return false;

  if (typeof obj === "string") {
    // appdata-link 経由の場合は許可
    if (obj.includes("appdata-link")) {
      return false;
    }

    // AppData/Roaming/my-key-remapper への直接アクセスを検出
    const normalized = obj.replace(/\\/g, "/").toLowerCase();
    if (
      normalized.includes("appdata/roaming/my-key-remapper") ||
      normalized.includes("%appdata%/my-key-remapper") ||
      normalized.includes("$env:appdata/my-key-remapper")
    ) {
      return true;
    }
    return false;
  }

  if (Array.isArray(obj)) {
    return obj.some((item) => checkValuesForDirectAppData(item));
  }

  if (typeof obj === "object") {
    return Object.values(obj).some((val) => checkValuesForDirectAppData(val));
  }

  return false;
}
