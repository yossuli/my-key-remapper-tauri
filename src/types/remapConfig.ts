import type {
  Action as GeneratedAction,
  Binding as GeneratedBinding,
  InterruptBehavior as GeneratedInterruptBehavior,
  Layer as GeneratedLayer,
  MacroDef as GeneratedMacroDef,
  ModifierOutput as GeneratedModifierOutput,
  MouseButton as GeneratedMouseButton,
  ScrollAxis as GeneratedScrollAxis,
  Trigger as GeneratedTrigger,
} from "./generated";

// =====================================
// 基本列挙型 (Rust自動同期)
// =====================================

export type TriggerType = GeneratedTrigger;
export type Trigger = GeneratedTrigger;
export type MouseButton = GeneratedMouseButton;
export type ScrollAxis = GeneratedScrollAxis;
export type InterruptBehavior = GeneratedInterruptBehavior;

// =====================================
// 修飾キー (Rust自動同期)
// =====================================

export type ModifierOutput = GeneratedModifierOutput;

// =====================================
// アクション (Rust自動同期)
// =====================================

/** すべてのアクション種別 (Rust側 Action enum から自動生成) */
export type Action = GeneratedAction;
export type ActionType = Action["type"];

/** 個別アクション型（Action Tagged Union から自動抽出） */
export type RemapAction = Extract<Action, { type: "remap" }>;
export type LayerToggleAction = Extract<Action, { type: "layerToggle" }>;
export type LayerMomentaryAction = Extract<Action, { type: "layerMomentary" }>;
export type MacroAction = Extract<Action, { type: "macro" }>;
export type MouseMoveAction = Extract<Action, { type: "mouseMove" }>;
export type MouseClickAction = Extract<Action, { type: "mouseClick" }>;
export type CursorSaveAction = Extract<Action, { type: "cursorSave" }>;
export type CursorRestoreAction = Extract<Action, { type: "cursorRestore" }>;
export type ScrollModeAction = Extract<Action, { type: "scrollMode" }>;
export type DelayAction = Extract<Action, { type: "delay" }>;
export type NoneAction = Extract<Action, { type: "none" }>;

/** マクロ定義（Rust自動同期） */
export type MacroDef = GeneratedMacroDef;

// =====================================
// キーバインディング (Rust自動同期)
// =====================================

export type KeyBinding = GeneratedBinding;
export type Binding = GeneratedBinding;

// =====================================
// レイヤー (Rust自動同期)
// =====================================

/** レイヤー定義 (Rust側 Layer モデルと完全同期 + FE用 bindings 型付け) */
export type Layer = Omit<GeneratedLayer, "bindings"> & {
  bindings: Record<number, KeyBinding[]>;
};

// =====================================
// 設定全体
// =====================================

/** グローバル設定 */
export interface GlobalSettings {
  /** 長押し判定のしきい値（ミリ秒）*/
  defaultHoldThresholdMs: number;
  /** ダブルタップ判定の間隔（ミリ秒）*/
  defaultTapIntervalMs: number;
}

/** リマップ設定全体 */
export interface RemapConfig {
  version: number;
  layers: Layer[];
  /** マクロ定義のプール */
  macros: MacroDef[];
  /** レイヤーの表示順（レイヤーIDの配列）*/
  layerOrder: string[];
  globalSettings: GlobalSettings;
}

// =====================================
// デフォルト設定
// =====================================

const VK_LSHIFT = 160;
const VK_RSHIFT = 161;

export const DEFAULT_REMAP_CONFIG: RemapConfig = {
  version: 1,
  layers: [
    {
      id: "base",
      bindings: {
        // Shift 長押しで shift レイヤーを有効化
        [VK_LSHIFT]: [
          {
            trigger: "hold",
            action: { type: "layerMomentary", layerId: "shift" },
          },
        ],
        [VK_RSHIFT]: [
          {
            trigger: "hold",
            action: { type: "layerMomentary", layerId: "shift" },
          },
        ],
      },
    },
    {
      id: "shift",
      bindings: {},
      defaultModifiers: { shift: true },
      passthroughTriggerKey: true,
    },
  ],
  macros: [
    {
      id: "cursor-return-macro",
      name: "カーソル位置を記憶して復帰",
      actions: [
        { type: "cursorSave" },
        { type: "delay", delayMs: 50 },
        { type: "cursorRestore" },
      ],
    },
  ],
  layerOrder: ["base", "shift"],
  globalSettings: {
    defaultHoldThresholdMs: 200,
    defaultTapIntervalMs: 300,
  },
};
