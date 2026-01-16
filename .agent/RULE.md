# my-key-remapper プロジェクト固有のナレッジ

**最重要**
グローバルルールは必ず守ってください

## プロジェクト概要

- **タイプ**: Electron + React アプリケーション
- **目的**: キーリマッパー（キーボードの入力を別のキーにリマップ）
- **言語**: TypeScript

## コミュニケーションと品質保証 (Communication & QA)

### 出力前チェックの厳格化（Pre-Output Check）

- **プロジェクト最上位ルール: 完全日本語対応**

  - 私（AI）がユーザーに見せるすべての出力（チャット、ログ、計画書、コミットメッセージ等）は、**必ず日本語** でなければなりません。
  - **Pre-Output Check (必須手順)**:

    - ツール（`task_boundary`, `notify_user`, `write_to_file` 等）を実行する **直前** に、以下の項目を確認してください。

    **【チェックリスト】**

    - [ ] **Task Boundary**:
      - `TaskName`: 日本語か？（慣習的な英語以外で、可能な限り日本語化されているか）
      - `TaskSummary` / `TaskStatus`: **完全な日本語文** か？
    - [ ] **Notification**:
      - `Message`: ユーザーへの問いかけや報告が自然な日本語か？
    - [ ] **Logs / Artifacts**:
      - `log.md` への書き込みは日本語か？
      - 新規作成・更新するドキュメントの見出しや説明文は日本語か？
    - [ ] **再確認**:
      - AI の思考プロセス（Thought Process）が英語であっても、出力引数にそのまま漏れ出ていないか？

### コミュニケーションのトーン

- 親しみやすさを保ちつつ、論理的で分かりやすい説明を行ってください。
- ユーザーと AI は対等なパートナー関係です。

## 安全管理基準 (Safety Guidelines)

### プロジェクト破壊の防止

- **歴史の改変禁止**: `log.md` 等の履歴ファイルを上書き・削除することは禁止です。追記のみを行ってください。

## アーキテクチャ

### ディレクトリ構造

```
src/
├── main/           # Electron メインプロセス
│   ├── hook/       # キーボードフック・イベント処理
│   ├── ipc/        # IPC通信ハンドラ
│   ├── native/     # koffi FFIバインディング・キー送信
│   ├── state/      # 状態管理（RemapRules, KeyState, LayerState）
│   ├── storage/    # 設定永続化
│   └── utils/      # ユーティリティ
├── preload/        # Electron プリロード（IPC bridge）
├── renderer/       # React フロントエンド (Atomic Design)
│   └── src/
│       ├── components/
│       │   ├── atoms/      # 7コンポーネント
│       │   ├── molecules/  # 7コンポーネント
│       │   ├── organisms/  # 5コンポーネント
│       │   ├── template/   # 3コンポーネント
│       │   ├── pages/      # 1コンポーネント
│       │   └── control/    # 7コンポーネント（宣言的条件分岐用）
│       ├── hooks/          # 11カスタムフック
│       ├── utils/          # 9ユーティリティ関数
│       └── types/          # フロントエンド専用型
└── shared/         # 共有コード
    ├── constants/  # VKコード、キーボードレイアウト定義
    └── types/      # 共有型定義（TriggerType, Action, Layer等）
```

### 設計原則 (Design Principles)

1. **副作用の局所化と排他制御 (Isolation Principle)**

   - キーボードフックのようにシステム全域に影響を与える副作用を持つアプリでは、局所的な UI 入力（キーキャプチャ等）がシステム状態と衝突することを防がなければならない。
   - **原則**: ユーザーが直接キー入力を試行・記録する UI コンポーネント（モーダル、レコーダー等）を表示する際は、必ずグローバルなリマップ機能を一時停止し、ハードウェア本来の挙動（生の入力値）と UI 操作を保証すること。

2. **UI と永続化モデルの分離 (State Transformation Pattern)**
   - 永続化データ（JSON 等）に UI レイヤー独自の都合（例: DnD 用の一時 ID、ローディングフラグ、一時的なバリデーションエラー等）を混在させてはならない。
   - **原則**:
     - **Identified Pattern**: DnD ライブラリなどで不変の ID が必要な場合は、UI 用の拡張型（`IdentifiedXxx`）を定義し、コンポーネント内でのみ管理する。
     - **Boundary Conversion**: API/ストレージとの境界（Load/Save）で、これらの UI メタデータを付与/除去する変換処理（Transformation）を明示的に行うことで、データ構造の純粋性と後方互換性を保つ。

### 5. 技術・コーディング規約（Tech & Coding）

### Ultracite / Biome

- **Ultracite / Biome のルールに準拠**してください。
- 未導入の場合は、導入を提案してください。
- **禁止事項**
  - `biome-ignore` の使用は禁止
  - 例外が必要な場合は、理由を明示して**事前に許可を取ること**
  - 軽微な lint / 型エラーは、確認を取る前に自律的に修正して構いません。

### React / Props

- **Inline Destructuring (必須)**
  - コンポーネントの Props は、原則として**引数内で分割代入 (Inline Destructuring)** してください。
  - 理由: 依存関係の明確化と、不要な Prop の混入防止。
  - 例: `function Child({ group: { val } }: Props) { ... }`

### General Coding Rules

- **コメント**: すべて日本語で記述
  - 作業のなかでのログなどのコメントは不要
  - 見ればわかる簡単なコメントは不要
- **関数**: 明示的な戻り値の型を付ける
- **ファイル名**: camelCase
- **インポート**: 相対パス（`../../`）よりもエイリアス（`@/`）を使用する。
- **品質チェック（必須）**: 実装完了報告やコミットを行う前には、必ず `npm run typecheck`, `npm run lint`, `npm run build` を実行し、エラーがないことを確認すること。禁止事項：エラーが発生したままの報告・コミット。
- **tree/ ディレクトリ**: 円滑な移行のために作成された一時的なディレクトリ。基本的にここへの**新規追加は禁止**し、既存の定義も順次適切な場所へ移動させて最終的には廃止することを目指す。

### コマンド実行

- 原則として `npm run` コマンドを使用してください。

## 運用ルール・ワークフロー一覧 (Operational Rules & Workflows)

詳細な手順は `.agent/workflows/` ディレクトリ内の各ファイルに定義されています。
私が「ワークフローを出して」と指示した際は、このディレクトリを確認し、リストを提示してどれを実行するか尋ねてください。

- **[Workflow-000] 普遍的な知見のルール化**: 作業中に発見した有用な知見やパターンをドキュメント化し、ナレッジとして蓄積する手順。 (`.agent/workflows/000.md`)
  - 🏷️ **Tags**: `knowledge`, `documentation`, `rules`, `insight`, `pattern`
- **[Workflow-002] スプレッド演算子を使った分割代入でのグループ化**: 呼び出し側でスプレッド演算子を使い、必要な値だけを取り出して残りを自動的にグループ化することで、中間オブジェクト生成を省略する。 (`.agent/workflows/002.md`)
  - 🏷️ **Tags**: `destructuring`, `spread`, `grouping`, `redundant`, `clean-code`
- **[Fix-003] 適切なコミット運用と実行トラブルシューティング**: 原則として一括ステージングを避け、論理的な変更単位でコミットを行う手順。環境依存のトラブル回避も含む。 (`.agent/workflows/003.md`)
  - 🏷️ **Tags**: `commit`, `git`, `troubleshooting`, `staging`, `atomic`
- **[Workflow-005] Props Grouping の適用判断**: Props をグループ化すべきか個別に渡すべきかの判断基準と、適切な適用方法。 (`.agent/workflows/005.md`)
  - 🏷️ **Tags**: `props`, `grouping`, `decision`, `drilling`, `best-practice`
- **[Workflow-006] 型定義の配置・整理ルール**: 型定義の配置場所 (Parent/Child/Hook) とデータフロー (Parent->Child) に関する絶対原則。トレーサビリティを最優先する。 (`.agent/workflows/006.md`)
  - 🏷️ **Tags**: `types`, `location`, `directory-structure`, `consistency`, `data-flow`
- **[Workflow-007] カリー化による Prop 渡しの簡略化**: 特定の引数を固定した関数を返す（カリー化）ことで、Props に渡す際の記述を簡潔にする手順。 (`.agent/workflows/007.md`)
  - 🏷️ **Tags**: `currying`, `callback`, `performance`, `arrow-function`, `clean-code`
- **[Workflow-008] 制御コンポーネントによる宣言的な条件付きレンダリング**: 三項演算子の代わりに `With` コンポーネント等を使用して、宣言的に条件付きレンダリングを行う手順。 (`.agent/workflows/008.md`)
  - 🏷️ **Tags**: `conditional-rendering`, `jsx`, `control-components`, `declarative`, `clean-code`
- **[Workflow-009] データパス指向のプロップスフロー可視化とリファクタリング**: プロップス伝播表を「データ経路」で分割して可視化し、Drill の行き止まりを排除しつつリファクタリングを行う手順。 (`.agent/workflows/009.md`)
  - 🏷️ **Tags**: `props`, `visualization`, `data-flow`, `refactoring`, `prop-drilling`
- **[Workflow-010] 大規模機能の実装計画策定**: 後戻りを防ぐため、コードスニペット、UX 詳細、アーキテクチャ設計（関心の分離）を含む「Source of Truth」レベルの計画書を作成するガイドライン。 (`.agent/workflows/010.md`)
  - 🏷️ **Tags**: `planning`, `implementation`, `architecture`, `source-of-truth`, `design`
- **[Workflow-011] 回帰バグ（Regression）の調査と修正計画策定**: 以前動作していた機能が破損した際、Git ログから原因コミットと Diff を特定し、実装計画に反映させる手順。 (`.agent/workflows/011.md`)
  - 🏷️ **Tags**: `bug-fix`, `regression`, `git-log`, `investigation`, `plan`
- **[Workflow-012] アーキテクチャ図解（Mermaid）のベストプラクティスガイド**: アーキテクチャ図を Mermaid で記述する際のベストプラクティスとガイドライン。 (`.agent/workflows/012.md`)
  - 🏷️ **Tags**: `diagram`, `mermaid`, `architecture`, `visualization`, `best-practice`
- **[Workflow-013] AI 応答の日本語化徹底チェックリスト**: AI 応答の日本語化を徹底するためのチェックリスト。 (`.agent/workflows/013.md`)
  - 🏷️ **Tags**: `japanese`, `translation`, `response`, `checklist`, `consistency`
- **[Workflow-014] マジックナンバーの定数化 (Refactor Magic Numbers)**: コード内にハードコードされた数値や文字列リテラル（マジックナンバー）を発見し、適切な定数として定義し直す手順です。 (`.agent/workflows/014.md`)
  - 🏷️ **Tags**: `magic-number`, `constants`, `refactoring`, `hard-coded`
- **[Workflow-015] 設定項目の追加**: 設定追加時の変更漏れ（型、初期値、マイグレーション等）を防ぐ手順。 (`.agent/workflows/015.md`)
  - 🏷️ **Tags**: `config`, `settings`, `migration`, `types`, `boilerplate`
- **[Workflow-018] Strict Linter/Type Fix**: 型エラーや Lint エラー修正時の厳格なルール（biome-ignore 禁止など）。 (`.agent/workflows/018.md`)
  - 🏷️ **Tags**: `lint`, `type-check`, `biome`, `strict`, `fix`
- **[Workflow-log] 作業ログの運用手順**: `log.md` の記録形式と自己修正。 (`.agent/workflows/log_management.md`)
  - 🏷️ **Tags**: `log`, `history`, `record`, `self-correction`, `process`
- **[Workflow-seed] 知見の管理 (Seed Management)**: `seeds.md` の記録と警告ヘッダーの規約。 (`.agent/workflows/seed_management.md`)
  - 🏷️ **Tags**: `seed`, `knowledge-base`, `learning`, `improvement`, `record`
- **[Workflow-next] next**: 迷った時のための next。 (`.agent/workflows/next.md`)
  - 🏷️ **Tags**: `stuck`, `guidance`, `help`, `direction`, `decision`
- **[Workflow-020] 議論から計画への昇格**: 複雑な提案をチャットから構造化された計画書作成へ切り替える手順。 (`.agent/workflows/020.md`)
  - 🏷️ **Tags**: `discussion`, `plan`, `promotion`, `structure`, `proposal`
- **[Workflow-023] .agent/workflows 編集時のドラフト運用**: `.agent/workflows/` ディレクトリ配下のルールやワークフローを編集・作成する際、必ずドラフトを経由する手順。 (`.agent/workflows/023.md`)
  - 🏷️ **Tags**: `draft`, `editing`, `workflow-management`, `safety`, `rule-update`
- **[Workflow-024] 意図の補完と具体化**: ユーザーの断片的な指示（0->1）から完全な手順（1->10）を構築・確認するフロー。 (`.agent/workflows/024.md`)
  - 🏷️ **Tags**: `autonomy`, `instruction`, `complementation`, `step-by-step`, `proactive`
- **[Workflow-025] 編集反映失敗時の強制リカバリ**: 変更が見当たらない場合に、ユーザー指示で全文上書きを行う手順。 (`.agent/workflows/025.md`)
  - 🏷️ **Tags**: `recovery`, `force-update`, `overwrite`, `error-handling`, `manual`
- **[Workflow-026] データと設定の分離 (Data/Config Split)**: 設定（Config）とユーザーデータ（Data）の保存先と管理戦略を明確に分離するアーキテクチャルール。 (`.agent/workflows/026.md`)
  - 🏷️ **Tags**: `architecture`, `data-separation`, `storage`, `performance`, `json`
- **[Workflow-027] ディスクリミネーテッド・ユニオンの分岐処理 (Objective Switch)**: タグ付き共用体の分岐に、網羅性チェックを保証する専用ユーティリティを使用する手順。 (`.agent/workflows/027.md`)
  - 🏷️ **Tags**: `switch`, `union`, `types`, `utility`, `exhaustive`
- **[Workflow-028] Workflows・ルールの最適化手順**: 運用中に発見したルールの不備や改善点を統合する手順。 (`.agent/workflows/028.md`)
  - 🏷️ **Tags**: `optimization`, `rule-update`, `improvement`, `feedback`, `integration`
- **[Workflow-029] Table 廃止・Grid 推奨**: テーブルタグを廃止し、Subgrid を活用した CSS Grid レイアウトを使用する (.agent/workflows/029.md)
  - 🏷️ **Tags**: `css-grid`, `table`, `layout`, `subgrid`, `modern-css`
- **[Workflow-030] UI コンポーネントの使用ルール (No Direct UI Imports)**: UI ライブラリを直接インポートせず、プロジェクト固有のラッパー（components/atoms 等）を使用するルール。 (`.agent/workflows/030.md`)
  - 🏷️ **Tags**: `ui-components`, `import`, `atomic-design`, `shadcn`, `wrapper`
- **[Workflow-031] 厳格なコードレビューと修正計画策定**: 大規模変更や指摘時に、文書化・監査・修正計画の 3 フェーズで確実に品質を担保する手順。 (`.agent/workflows/031.md`)
  - 🏷️ **Tags**: `review`, `audit`, `quality-control`, `correction`, `plan`
- **[Workflow-032] 否定・停止指示の意図確認プロセス**: ユーザーの `n` やリバートを安易に「拒否」と取らず、真意（停止、時期尚早、内容不備）を確認する手順。 (`.agent/workflows/032.md`)
  - 🏷️ **Tags**: `confirmation`, `intent`, `rejection`, `stopping`, `communication`
- **[Workflow-033] 思考シミュレーションによるドキュメント検証**: 仕様書を見ずにユースケースを発想し、実装・ドキュメントとのギャップを分析して網羅性を高める手順。 (`.agent/workflows/033.md`)
  - 🏷️ **Tags**: `simulation`, `validation`, `use-case`, `gap-analysis`, `testing`
- **[Workflow-035] 大規模置換におけるスクリプト言語の選択**: パスエイリアス追加などの大規模置換作業時に、PowerShell ではなく Node.js スクリプトを使用する手順。 (`.agent/workflows/035.md`)
  - 🏷️ **Tags**: `script`, `node`, `replacement`, `refactoring`, `automation`
- **[Workflow-029] Table 廃止・Grid 推奨**: テーブルタグを廃止し、Subgrid を活用した CSS Grid レイアウトを使用する (.agent/workflows/029.md)
- **[Workflow-030] UI コンポーネントの使用ルール (No Direct UI Imports)**: UI ライブラリを直接インポートせず、プロジェクト固有のラッパー（components/atoms 等）を使用するルール。 (`.agent/workflows/030.md`)
- **[Workflow-031] 厳格なコードレビューと修正計画策定**: 大規模変更や指摘時に、文書化・監査・修正計画の 3 フェーズで確実に品質を担保する手順。 (`.agent/workflows/031.md`)
- **[Workflow-032] 否定・停止指示の意図確認プロセス**: ユーザーの `n` やリバートを安易に「拒否」と取らず、真意（停止、時期尚早、内容不備）を確認する手順。 (`.agent/workflows/032.md`)
- **[Workflow-000] 普遍的な知見のルール化**: 作業中に発見した有用な知見やパターンをドキュメント化し、ナレッジとして蓄積する手順。 (`.agent/workflows/000.md`)
  - 🏷️ **Tags**: `knowledge`, `documentation`, `rules`, `insight`, `pattern`
- **[Workflow-002] スプレッド演算子を使った分割代入でのグループ化**: 呼び出し側でスプレッド演算子を使い、必要な値だけを取り出して残りを自動的にグループ化することで、中間オブジェクト生成を省略する。 (`.agent/workflows/002.md`)
  - 🏷️ **Tags**: `destructuring`, `spread`, `grouping`, `redundant`, `clean-code`
- **[Fix-003] 適切なコミット運用と実行トラブルシューティング**: 原則として一括ステージングを避け、論理的な変更単位でコミットを行う手順。環境依存のトラブル回避も含む。 (`.agent/workflows/003.md`)
  - 🏷️ **Tags**: `commit`, `git`, `troubleshooting`, `staging`, `atomic`
- **[Workflow-005] Props Grouping の適用判断**: Props をグループ化すべきか個別に渡すべきかの判断基準と、適切な適用方法。 (`.agent/workflows/005.md`)
  - 🏷️ **Tags**: `props`, `grouping`, `decision`, `drilling`, `best-practice`
- **[Workflow-006] 型定義の配置・整理ルール**: 型定義の配置場所 (Parent/Child/Hook) とデータフロー (Parent->Child) に関する絶対原則。トレーサビリティを最優先する。 (`.agent/workflows/006.md`)
  - 🏷️ **Tags**: `types`, `location`, `directory-structure`, `consistency`, `data-flow`
- **[Workflow-007] カリー化による Prop 渡しの簡略化**: 特定の引数を固定した関数を返す（カリー化）ことで、Props に渡す際の記述を簡潔にする手順。 (`.agent/workflows/007.md`)
  - 🏷️ **Tags**: `currying`, `callback`, `performance`, `arrow-function`, `clean-code`
- **[Workflow-008] 制御コンポーネントによる宣言的な条件付きレンダリング**: 三項演算子の代わりに `With` コンポーネント等を使用して、宣言的に条件付きレンダリングを行う手順。 (`.agent/workflows/008.md`)
  - 🏷️ **Tags**: `conditional-rendering`, `jsx`, `control-components`, `declarative`, `clean-code`
- **[Workflow-009] データパス指向のプロップスフロー可視化とリファクタリング**: プロップス伝播表を「データ経路」で分割して可視化し、Drill の行き止まりを排除しつつリファクタリングを行う手順。 (`.agent/workflows/009.md`)
  - 🏷️ **Tags**: `props`, `visualization`, `data-flow`, `refactoring`, `prop-drilling`
- **[Workflow-010] 大規模機能の実装計画策定**: 後戻りを防ぐため、コードスニペット、UX 詳細、アーキテクチャ設計（関心の分離）を含む「Source of Truth」レベルの計画書を作成するガイドライン。 (`.agent/workflows/010.md`)
  - 🏷️ **Tags**: `planning`, `implementation`, `architecture`, `source-of-truth`, `design`
- **[Workflow-011] 回帰バグ（Regression）の調査と修正計画策定**: 以前動作していた機能が破損した際、Git ログから原因コミットと Diff を特定し、実装計画に反映させる手順。 (`.agent/workflows/011.md`)
  - 🏷️ **Tags**: `bug-fix`, `regression`, `git-log`, `investigation`, `plan`
- **[Workflow-012] アーキテクチャ図解（Mermaid）のベストプラクティスガイド**: アーキテクチャ図を Mermaid で記述する際のベストプラクティスとガイドライン。 (`.agent/workflows/012.md`)
  - 🏷️ **Tags**: `diagram`, `mermaid`, `architecture`, `visualization`, `best-practice`
- **[Workflow-013] AI 応答の日本語化徹底チェックリスト**: AI 応答の日本語化を徹底するためのチェックリスト。 (`.agent/workflows/013.md`)
  - 🏷️ **Tags**: `japanese`, `translation`, `response`, `checklist`, `consistency`
- **[Workflow-014] マジックナンバーの定数化 (Refactor Magic Numbers)**: コード内にハードコードされた数値や文字列リテラル（マジックナンバー）を発見し、適切な定数として定義し直す手順です。 (`.agent/workflows/014.md`)
  - 🏷️ **Tags**: `magic-number`, `constants`, `refactoring`, `hard-coded`
- **[Workflow-015] 設定項目の追加**: 設定追加時の変更漏れ（型、初期値、マイグレーション等）を防ぐ手順。 (`.agent/workflows/015.md`)
  - 🏷️ **Tags**: `config`, `settings`, `migration`, `types`, `boilerplate`
- **[Workflow-018] Strict Linter/Type Fix**: 型エラーや Lint エラー修正時の厳格なルール（biome-ignore 禁止など）。 (`.agent/workflows/018.md`)
  - 🏷️ **Tags**: `lint`, `type-check`, `biome`, `strict`, `fix`
- **[Workflow-log] 作業ログの運用手順**: `log.md` の記録形式と自己修正。 (`.agent/workflows/log_management.md`)
  - 🏷️ **Tags**: `log`, `history`, `record`, `self-correction`, `process`
- **[Workflow-seed] 知見の管理 (Seed Management)**: `seeds.md` の記録と警告ヘッダーの規約。 (`.agent/workflows/seed_management.md`)
  - 🏷️ **Tags**: `seed`, `knowledge-base`, `learning`, `improvement`, `record`
- **[Workflow-next] next**: 迷った時のための next。 (`.agent/workflows/next.md`)
  - 🏷️ **Tags**: `stuck`, `guidance`, `help`, `direction`, `decision`
- **[Workflow-020] 議論から計画への昇格**: 複雑な提案をチャットから構造化された計画書作成へ切り替える手順。 (`.agent/workflows/020.md`)
  - 🏷️ **Tags**: `discussion`, `plan`, `promotion`, `structure`, `proposal`
- **[Workflow-023] .agent/workflows 編集時のドラフト運用**: `.agent/workflows/` ディレクトリ配下のルールやワークフローを編集・作成する際、必ずドラフトを経由する手順。 (`.agent/workflows/023.md`)
  - 🏷️ **Tags**: `draft`, `editing`, `workflow-management`, `safety`, `rule-update`
- **[Workflow-024] 意図の補完と具体化**: ユーザーの断片的な指示（0->1）から完全な手順（1->10）を構築・確認するフロー。 (`.agent/workflows/024.md`)
  - 🏷️ **Tags**: `autonomy`, `instruction`, `complementation`, `step-by-step`, `proactive`
- **[Workflow-025] 編集反映失敗時の強制リカバリ**: 変更が見当たらない場合に、ユーザー指示で全文上書きを行う手順。 (`.agent/workflows/025.md`)
  - 🏷️ **Tags**: `recovery`, `force-update`, `overwrite`, `error-handling`, `manual`
- **[Workflow-026] データと設定の分離 (Data/Config Split)**: 設定（Config）とユーザーデータ（Data）の保存先と管理戦略を明確に分離するアーキテクチャルール。 (`.agent/workflows/026.md`)
  - 🏷️ **Tags**: `architecture`, `data-separation`, `storage`, `performance`, `json`
- **[Workflow-027] ディスクリミネーテッド・ユニオンの分岐処理 (Objective Switch)**: タグ付き共用体の分岐に、網羅性チェックを保証する専用ユーティリティを使用する手順。 (`.agent/workflows/027.md`)
  - 🏷️ **Tags**: `switch`, `union`, `types`, `utility`, `exhaustive`
- **[Workflow-028] Workflows・ルールの最適化手順**: 運用中に発見したルールの不備や改善点を統合する手順。 (`.agent/workflows/028.md`)
  - 🏷️ **Tags**: `optimization`, `rule-update`, `improvement`, `feedback`, `integration`
- **[Workflow-029] Table 廃止・Grid 推奨**: テーブルタグを廃止し、Subgrid を活用した CSS Grid レイアウトを使用する (.agent/workflows/029.md)
  - 🏷️ **Tags**: `css-grid`, `table`, `layout`, `subgrid`, `modern-css`
- **[Workflow-030] UI コンポーネントの使用ルール (No Direct UI Imports)**: UI ライブラリを直接インポートせず、プロジェクト固有のラッパー（components/atoms 等）を使用するルール。 (`.agent/workflows/030.md`)
  - 🏷️ **Tags**: `ui-components`, `import`, `atomic-design`, `shadcn`, `wrapper`
- **[Workflow-031] 厳格なコードレビューと修正計画策定**: 大規模変更や指摘時に、文書化・監査・修正計画の 3 フェーズで確実に品質を担保する手順。 (`.agent/workflows/031.md`)
  - 🏷️ **Tags**: `review`, `audit`, `quality-control`, `correction`, `plan`
- **[Workflow-032] 否定・停止指示の意図確認プロセス**: ユーザーの `n` やリバートを安易に「拒否」と取らず、真意（停止、時期尚早、内容不備）を確認する手順。 (`.agent/workflows/032.md`)
  - 🏷️ **Tags**: `confirmation`, `intent`, `rejection`, `stopping`, `communication`
- **[Workflow-033] 思考シミュレーションによるドキュメント検証**: 仕様書を見ずにユースケースを発想し、実装・ドキュメントとのギャップを分析して網羅性を高める手順。 (`.agent/workflows/033.md`)
  - 🏷️ **Tags**: `simulation`, `validation`, `use-case`, `gap-analysis`, `testing`
- **[Workflow-035] 大規模置換におけるスクリプト言語の選択**: パスエイリアス追加などの大規模置換作業時に、PowerShell ではなく Node.js スクリプトを使用する手順。 (`.agent/workflows/035.md`)
  - 🏷️ **Tags**: `script`, `node`, `replacement`, `refactoring`, `automation`
- **[Workflow-037] リスト項目のクリック領域確保とボタンネスト回避**: デッドゾーンを排除しつつ HTML 構造を正当に保つ設計パターン。 (`.agent/workflows/037.md`)
  - 🏷️ **Tags**: `ux`, `clickable-area`, `hydration-error`, `nesting-forbidden`, `pattern`
- **[Workflow-038] ユーザーデータ・設定ファイルの保存場所明示**: ユーザーのデータコントロール権を保障するため、README 等に設定ファイルの場所を明記するルール。 (`.agent/workflows/038.md`)
  - 🏷️ **Tags**: `user-data`, `config`, `readme`, `documentation`, `transparency`
- **[Workflow-039] 現在の変更差分(Diff)を分析し、リファクタリング計画を策定するワークフロー**: 作業再開時や手動変更時に、現状を分析して計画に同期させる手順。 (`.agent/workflows/039.md`)
  - 🏷️ **Tags**: `git-diff`, `sync`, `planning`, `manual-change`, `refactor-analysis`
- **[Workflow-040] 純粋データ Props による合成可能 UI パターン (Pure Data Props vs Component Injection)**: 完成品のコンポーネントではなく純粋なデータを Props として渡し、内部で合成することで責務分離を徹底する手順。 (`.agent/workflows/040.md`)
  - 🏷️ **Tags**: `props`, `composition`, `ui-design`, `clean-code`, `inversion-of-control`

## 安全な承認プロセス (Safe Approval Process)

- **Good**: 「A を修正してよろしいでしょうか？」 -> (承認) -> (実行) -> 「完了しました。続いて B を実行してよろしいでしょうか？」
- 常に **1 つの承認依頼につき、1 つの主要なアクション** に留めてください。

## AI の自律的行動指針（補足）

`GEMINI.md` に定める「自律的行動規範」に基づき、以下の振る舞いを徹底します。

1.  **既存パターンの優先採用**: 新規実装や修正を行う際は、プロジェクト内の既存コード（atoms, molecules, hooks 等）を検索し、確立された設計パターンを自律的に踏襲します。
2.  **自己監査の思考ログ**: 作業ログ (`log.md`) において、どのファイルを参照し、どのルールに基づきその実装を選んだかを明記し、自己監査の形跡を残します。
3.  **予告実行の明示**: 読み取りや safe-fix 等、ユーザーの承認を待たずに実行した操作は、事後または並行してログに明文化し、透明性を確保します。

## ドメイン知識・注意点 (Domain Knowledge)

### キーイベント処理

- アクションは指定されたトリガーを確認後、'tap' トリガーにフォールバック
- すべてのレイヤーを統一的に扱う（base レイヤーの特別扱いなし）
- リマップが定義されていない場合はデフォルトのキー動作を維持

### UI 入力とリマップの競合回避

- `useRemapControl` を使用し、キー入力をキャプチャするモーダルやフォームの `mount/unmount` （または編集開始/終了）に合わせて `disableRemap/enableRemap` を呼び出すこと。これを忘れると、例えば Enter キーを記録しようとした際に、意図せず「保存」ではなく「リマップされた別のアクション」が発火し、アプリケーションが操作不能になるリスクがある。

### パフォーマンス優先のリファクタリング方針

- キーイベント処理（`src/main/hook`）は速度が最優先
- 再利用しない限り、認知的複雑度を減らす目的だけでの関数分割は不要
- 再利用する場合のみ関数化を行う
- 速さ優先で `let` を使用したループ内変数書き換えも許容

### Double Tap 検出

- `onKeyUp` で即座に "tap" を返すと、ダブルタップ検出に失敗する
- `tapIntervalMs` 内での 2 回目のタップを待つ必要がある

### 動作確認

- このアプリはあなたが起動しても何も起きないため、動作確認はしない
- ビルド成功のみを検証する

## 知見の継続的改善（Living Documentation）

- ワークフローやルールに基づいて作業を行っている最中に、追加の指示、補足、または修正を受けた場合、その内容を作業完了後に**元のドキュメントへ反映することを必ず提案**してください。
- 常に「この指示はこのワークフローの次回の利用時に役立つか？」を考え、Yes であればドキュメント化します。
- **重要**: AI はこのルールを忘れがちであるため、全てのワークフローファイルの末尾にも同旨の記述を含めることとします。
