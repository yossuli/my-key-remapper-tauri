// =====================================
// トリガー種別
// =====================================

/**
 * トリガーの種類
 * - tap: 単押し（短押し）
 * - hold: 長押し
 * - doubleTap: ダブルクリック
 * - tapHold: タップ後に長押し（未実装）
 */
export type TriggerType = "tap" | "hold" | "doubleTap"; // | "tapHold";

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
// アクション
// =====================================

/** 待機アクション */
export interface DelayAction {
  type: "delay";
  delayMs: number;
}

/** マクロ参照アクション（キー割り当て用） */
export interface MacroAction {
  type: "macro";
  macroId: string;
}

/** キーリマップアクション */
export interface RemapAction {
  type: "remap";
  keys: number[];
  /** 長押し中のリピート有効化 */
  repeat?: boolean;
  /** リピート開始までの遅延(ms) */
  repeatDelayMs?: number;
  /** リピート間隔(ms) */
  repeatIntervalMs?: number;
}

/** レイヤー切り替えアクション（トグル） */
export interface LayerToggleAction {
  type: "layerToggle";
  layerId: string;
}

/** レイヤー一時切り替えアクション（モーメンタリ） */
export interface LayerMomentaryAction {
  type: "layerMomentary";
  layerId: string;
}

/** 無効化アクション */
export interface NoneAction {
  type: "none";
}

/** パススルーアクション（そのまま通す） */
export interface PassthroughAction {
  type: "passthrough";
}

/** マウスカーソル移動アクション */
export interface MouseMoveAction {
  type: "mouseMove";
  /** 移動先X座標 (絶対ピクセル座標) */
  x?: number;
  /** 移動先Y座標 (絶対ピクセル座標) */
  y?: number;
}

/** マウスクリックアクション */
export interface MouseClickAction {
  type: "mouseClick";
  /** クリック座標X (絶対ピクセル座標) */
  x?: number;
  /** クリック座標Y (絶対ピクセル座標) */
  y?: number;
  /** クリックボタン */
  button: "left" | "right" | "middle";
  /** クリック回数 (1: シングル, 2: ダブル) */
  clickCount?: number;
}

/** カーソル位置記憶アクション */
export interface CursorSaveAction {
  type: "cursorSave";
}

/** カーソル位置復元アクション */
export interface CursorRestoreAction {
  type: "cursorRestore";
}

/** すべてのアクション種別 */
export type Action =
  | RemapAction
  | LayerToggleAction
  | LayerMomentaryAction
  | NoneAction
  | MouseMoveAction
  | MouseClickAction
  | CursorSaveAction
  | CursorRestoreAction
  | DelayAction
  | MacroAction;
// | PassthroughAction;

export type ActionType = Action["type"];

/** マクロ定義（データストア用） */
export interface MacroDef {
  id: string;
  name: string;
  /** マクロの手順。ネスト（マクロ内のマクロ呼び出し）は仕様上避けることが推奨される */
  actions: Action[];
}

// =====================================
// キーバインディング
// =====================================

export interface KeyBinding {
  trigger: TriggerType;
  action: Action;
  /** タイミング設定(ms)。Triggerに応じて意味が変わる。 hold=長押し判定時間、doubleTap=タップ間隔 */
  timingMs?: number;
  /** 割り込み時の挙動（Hold中など）。デフォルトは forceTap */
  interruptBehavior?: "forceTap" | "ignore";
}

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
