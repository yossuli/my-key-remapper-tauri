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
      const toolName = toolCall.name || "";

      // 1. 対象となるファイルパスまたはコマンド文字列を取得
      const targetPaths = extractTargetPaths(toolName, toolCall.args);

      // 2. read ツール（view_file, list_dir 等）でシンボリックリンク先を読もうとした場合
      // シンボリックリンク先は実パスがワークスペース外となるためブロックし、ls や jq の使用を促す
      const hasSymlinkAccess = targetPaths.some((p) =>
        p.toLowerCase().includes("appdata-link")
      );

      if (hasSymlinkAccess && isReadTool(toolName)) {
        const response = {
          decision: "deny",
          reason: `【アクセス拒否】シンボリックリンク経由の read ツール（${toolName}）はワークスペース外アクセスとしてブロックされます。'appdata-link/profiles' に対して run_command で ls や jq 等のシェルコマンドを用いて参照してください。`,
        };
        process.stdout.write(JSON.stringify(response) + "\n");
        process.exit(0);
      }

      // ファイル書き込み系ツールでシンボリックリンク自体やリンク先を変更しようとした場合もブロック
      if (hasSymlinkAccess && isWriteTool(toolName)) {
        const response = {
          decision: "deny",
          reason: `【アクセス拒否】シンボリックリンク経由のファイル変更ツール（${toolName}）はワークスペース外アクセスとしてブロックされます。`,
        };
        process.stdout.write(JSON.stringify(response) + "\n");
        process.exit(0);
      }

      // 3. AppData への直接アクセス（appdata-link を介さない直接パス）をチェック
      // コマンドラインやファイルパスを検査する（ファイル内容そのものは誤検知防止のため除外）
      const pathsToCheck =
        toolName === "run_command"
          ? [toolCall.args.CommandLine || ""]
          : targetPaths;

      const hasDirectAppDataAccess = pathsToCheck.some((p) =>
        isDirectAppData(p)
      );

      if (hasDirectAppDataAccess) {
        const response = {
          decision: "deny",
          reason:
            "【アクセス拒否】Windows の AppData ディレクトリ（my-key-remapper）への直接アクセスはブロックされました。'appdata-link/profiles' に対して run_command で ls や jq を実行してください。",
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

const READ_TOOLS = new Set([
  "view_file",
  "read_file",
  "list_dir",
  "grep_search",
  "find_by_name",
  "read_resource",
  "read_url_content",
]);

function isReadTool(toolName) {
  if (READ_TOOLS.has(toolName)) return true;
  if (
    toolName.startsWith("read_") ||
    toolName.startsWith("view_") ||
    toolName.startsWith("list_")
  ) {
    return true;
  }
  return false;
}

const WRITE_TOOLS = new Set([
  "write_to_file",
  "replace_file_content",
  "edit_file",
]);

function isWriteTool(toolName) {
  return WRITE_TOOLS.has(toolName);
}

/**
 * ツール呼び出しから対象となるパス文字列を抽出する
 * （CodeContent や TargetContent などのファイル中身は検査対象外とする）
 */
function extractTargetPaths(toolName, args) {
  if (!args || typeof args !== "object") return [];

  const paths = [];

  // run_command の場合は CommandLine 全体を対象とする
  if (toolName === "run_command" && typeof args.CommandLine === "string") {
    paths.push(args.CommandLine);
  }

  // ファイル・ディレクトリアクセス関連の主なプロパティ
  const pathKeys = [
    "AbsolutePath",
    "DirectoryPath",
    "SearchPath",
    "SearchDirectory",
    "TargetFile",
    "path",
    "filePath",
    "dirPath",
    "Uri",
  ];

  for (const key of pathKeys) {
    if (typeof args[key] === "string") {
      paths.push(args[key]);
    }
  }

  return paths;
}

/**
 * appdata-link を経由しない AppData/Roaming/my-key-remapper への直接アクセスが含まれているかを判定する
 */
function isDirectAppData(str) {
  if (typeof str !== "string") return false;

  // appdata-link 経由の場合は直接アクセスとみなさない
  if (str.includes("appdata-link")) {
    return false;
  }

  // AppData/Roaming/my-key-remapper への直接アクセスを検出
  const normalized = str.replace(/\\/g, "/").toLowerCase();
  return (
    normalized.includes("appdata/roaming/my-key-remapper") ||
    normalized.includes("%appdata%/my-key-remapper") ||
    normalized.includes("$env:appdata/my-key-remapper")
  );
}
