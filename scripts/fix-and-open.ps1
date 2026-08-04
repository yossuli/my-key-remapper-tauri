# Ultracite fix を実行して、自動修正できなかったファイルをエディタで開く

# エラーアクション設定
$ErrorActionPreference = "Continue"

# 一時ファイルのパス
$tempFile = [System.IO.Path]::GetTempFileName()

Write-Host "Ultracite fix を実行中..." -ForegroundColor Cyan

# ultracite fix を実行して、出力を一時ファイルに保存
# エラーコード 1 は「修正できないエラーがある」という正常な状態なので無視
& "$PSScriptRoot\..\node_modules\.bin\ultracite.cmd" fix 2>&1 | Tee-Object -FilePath $tempFile | Out-Null
$ultraciteExitCode = $LASTEXITCODE

# 出力を読み込む
$output = Get-Content $tempFile -Raw

# エラーが含まれるファイルを抽出
# Biome の出力形式: "path/to/file.ts:line:column message"
$errorFiles = @()
$lines = $output -split "`n"

foreach ($line in $lines) {
    # ファイルパスとエラーメッセージを含む行を検出
    if ($line -match '^([^:]+\.(ts|tsx|js|jsx|json|jsonc)):(\d+):(\d+)') {
        $filePath = $matches[1]

        # node_modules や外部ライブラリのファイルを除外
        if ($filePath -notmatch 'node_modules' -and
            $filePath -notmatch '^lib\\' -and
            $filePath -match '^src\\') {
            # 重複を避けるため、まだリストにない場合のみ追加
            if ($errorFiles -notcontains $filePath) {
                $errorFiles += $filePath
            }
        }
    }
}

# 一時ファイルを削除
Remove-Item $tempFile -ErrorAction SilentlyContinue

# エラーがあるファイルをエディタで開く
if ($errorFiles.Count -gt 0) {
    Write-Host "`n自動修正できなかったファイル ($($errorFiles.Count) 件):" -ForegroundColor Yellow
    foreach ($file in $errorFiles) {
        Write-Host "  - $file" -ForegroundColor Yellow
    }

    Write-Host "`nAntigravity でファイルを開いています..." -ForegroundColor Cyan

    # Antigravity でファイルを開く
    foreach ($file in $errorFiles) {
        antigravity $file
    }

    Write-Host "完了しました。" -ForegroundColor Green
    exit 1
} else {
    Write-Host "`nすべてのファイルが正常に修正されました。" -ForegroundColor Green
    exit 0
}
