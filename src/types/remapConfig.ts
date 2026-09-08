import type {
  Action as GeneratedAction,
  Binding as GeneratedBinding,
  InterruptBehavior as GeneratedInterruptBehavior,
  MacroDef as GeneratedMacroDef,
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
// 修飾キー
// =====================================

/**
 * 修飾キーの出力指定
 */
export interface ModifierOutput {
  ctrl?: boolean | "left" | "right";
  shift?: boolean | "left" | "right";
  alt?: boolean | "left" | "right";
  win?: boolean | "left" | "right";
}

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
// レイヤー
// =====================================
/** レイヤー定義 */
export interface Layer {
  id: string;
  /** キーコード → バインディング配列 */
  bindings: Record<number, KeyBinding[]>;
  /** "layerMomentary"で有効にしている場合、ほかのキーを押したときにこのキーを送信する（未実装）*/
  // passThroughKeys?: number[];
  /** レイヤーアクティブ時にデフォルトで送信する修飾キー。tap アクションが設定されているキーは除外。*/
  defaultModifiers?: ModifierOutput;
  /** レイヤーアクティブ時に押しっぱなしにする追加キー（任意のキーコード） */
  activeKeys?: number[];
  /** 下位レイヤーの defaultModifiers と activeKeys を継承して合成するかどうか（デフォルト true） */
  inheritModifiers?: boolean;
  /** もともとのキー（レイヤーを発火させたトリガーキー）の長押しを無効化しない（OSに通す） */
  passthroughTriggerKey?: boolean;
}

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
