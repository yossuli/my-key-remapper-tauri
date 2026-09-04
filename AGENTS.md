# エージェント行動規範 & プロジェクトインデックス

本ファイルは全セッションで自動読み込みされるため、**必要最小限のルールとドキュメントへのポインタ（参照リンク）のみ**を記述します。詳細なタスクや仕様はリンク先を参照してください。

---

## 📌 開発・タスク管理ルール

1. **タスクの確認と更新**:
   - バックエンドのリファクタリングおよびタスク進捗は [docs/tasks/README.md](file:///mnt/c/Users/yo44a/Documents/tauri-key-remapper/docs/tasks/README.md) で管理されています。
   - バックエンド作業時は必ず同ファイルおよび個別タスク仕様書（`docs/tasks/phase-*/task-*.md`）を参照し、完了時にチェックボックス `[x]` と完了記録を更新してください。
2. **品質・テスト要件**:
   - バックエンド変更時は `npm run cargo:test` を実行し、全テストパスを確認してください。
   - 型同期（TypeScriptとRust）を維持し、`npm run typecheck` をパスさせてください。

---

## 📚 ドキュメント・インデックス

- **タスク管理**:
  - [バックエンド・リファクタリング タスク索引](file:///mnt/c/Users/yo44a/Documents/tauri-key-remapper/docs/tasks/README.md)
- **コア仕様**:
  - [キーリマップ仕様書](file:///mnt/c/Users/yo44a/Documents/tauri-key-remapper/REMAP_SPECIFICATIONS.md)
  - [フロントエンド設定型定義](file:///mnt/c/Users/yo44a/Documents/tauri-key-remapper/src/types/remapConfig.ts)
  - [バックエンド初期化フロー](file:///mnt/c/Users/yo44a/Documents/tauri-key-remapper/docs/backend/initialization-flow.md)
  - [バックエンドIPC API仕様](file:///mnt/c/Users/yo44a/Documents/tauri-key-remapper/docs/backend/ipc-api.md)
