import { VK } from "@/constants/vk";
import type { RemapConfig } from "@/types/remapConfig";

const DEFAULT_HOLD_MS = 200;
const DEFAULT_TAP_MS = 300;
const DELAY_50_MS = 50;
const DELAY_100_MS = 100;

/**
 * 基本のデフォルト設定
 */
export const DEFAULT_PROFILE: RemapConfig = {
  version: 1,
  layers: [
    {
      id: "base",
      bindings: {
        [VK.LSHIFT]: [
          {
            trigger: "hold",
            action: { type: "layerMomentary", layerId: "shift" },
          },
        ],
        [VK.RSHIFT]: [
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
        { type: "delay", delayMs: DELAY_50_MS },
        { type: "cursorRestore" },
      ],
    },
  ],
  layerOrder: ["base", "shift"],
  globalSettings: {
    defaultHoldThresholdMs: DEFAULT_HOLD_MS,
    defaultTapIntervalMs: DEFAULT_TAP_MS,
  },
};

/**
 * モックモード用のサンプルプロファイル
 * エージェントがブラウザで開いた際に動作確認しやすい豊富なバインディング・レイヤー・マクロを定義
 */
export const MOCK_SAMPLE_PROFILE: RemapConfig = {
  version: 1,
  layers: [
    {
      id: "base",
      bindings: {
        // CapsLock -> Left Ctrl
        [VK.CAPS_LOCK]: [
          {
            trigger: "tap",
            action: { type: "remap", keys: [VK.LCTRL] },
          },
          {
            trigger: "hold",
            action: { type: "remap", keys: [VK.LCTRL] },
          },
        ],
        // Space長押し -> fnレイヤー
        [VK.SPACE]: [
          {
            trigger: "hold",
            action: { type: "layerMomentary", layerId: "fn" },
          },
        ],
        // 無変換 -> baseリセット
        [VK.NON_CONVERT]: [
          {
            trigger: "tap",
            action: { type: "layerToggle", layerId: "base" },
          },
        ],
        // 変換 -> numpadレイヤートグル
        [VK.CONVERT]: [
          {
            trigger: "tap",
            action: { type: "layerToggle", layerId: "numpad" },
          },
        ],
        // Fキーダブルタップ -> Enter
        [VK.KEY_F]: [
          {
            trigger: "doubleTap",
            action: { type: "remap", keys: [VK.ENTER] },
            timingMs: DEFAULT_TAP_MS,
          },
        ],
        // Dキー長押し -> カーソル復帰マクロ
        [VK.KEY_D]: [
          {
            trigger: "hold",
            action: { type: "macro", macroId: "cursor-return-macro" },
            timingMs: DEFAULT_HOLD_MS,
          },
        ],
        // Shiftキー長押し -> shiftレイヤー
        [VK.LSHIFT]: [
          {
            trigger: "hold",
            action: { type: "layerMomentary", layerId: "shift" },
          },
        ],
        [VK.RSHIFT]: [
          {
            trigger: "hold",
            action: { type: "layerMomentary", layerId: "shift" },
          },
        ],
      },
    },
    {
      id: "fn",
      bindings: {
        // H, J, K, L -> 矢印キー
        [VK.KEY_H]: [
          {
            trigger: "tap",
            action: { type: "remap", keys: [VK.LEFT] },
          },
        ],
        [VK.KEY_J]: [
          {
            trigger: "tap",
            action: { type: "remap", keys: [VK.DOWN] },
          },
        ],
        [VK.KEY_K]: [
          {
            trigger: "tap",
            action: { type: "remap", keys: [VK.UP] },
          },
        ],
        [VK.KEY_L]: [
          {
            trigger: "tap",
            action: { type: "remap", keys: [VK.RIGHT] },
          },
        ],
        // U -> 左クリック, I -> 右クリック
        [VK.KEY_U]: [
          {
            trigger: "tap",
            action: { type: "mouseClick", button: "left" },
          },
        ],
        [VK.KEY_I]: [
          {
            trigger: "tap",
            action: { type: "mouseClick", button: "right" },
          },
        ],
        // S -> 保存マクロ
        [VK.KEY_S]: [
          {
            trigger: "tap",
            action: { type: "macro", macroId: "save-shortcut-macro" },
          },
        ],
      },
    },
    {
      id: "numpad",
      bindings: {
        // テンキー配置サンプル (7,8,9, U,I,O, J,K,L, M)
        [VK.KEY_7]: [
          { trigger: "tap", action: { type: "remap", keys: [VK.NUMPAD7] } },
        ],
        [VK.KEY_8]: [
          { trigger: "tap", action: { type: "remap", keys: [VK.NUMPAD8] } },
        ],
        [VK.KEY_9]: [
          { trigger: "tap", action: { type: "remap", keys: [VK.NUMPAD9] } },
        ],
        [VK.KEY_U]: [
          { trigger: "tap", action: { type: "remap", keys: [VK.NUMPAD4] } },
        ],
        [VK.KEY_I]: [
          { trigger: "tap", action: { type: "remap", keys: [VK.NUMPAD5] } },
        ],
        [VK.KEY_O]: [
          { trigger: "tap", action: { type: "remap", keys: [VK.NUMPAD6] } },
        ],
        [VK.KEY_J]: [
          { trigger: "tap", action: { type: "remap", keys: [VK.NUMPAD1] } },
        ],
        [VK.KEY_K]: [
          { trigger: "tap", action: { type: "remap", keys: [VK.NUMPAD2] } },
        ],
        [VK.KEY_L]: [
          { trigger: "tap", action: { type: "remap", keys: [VK.NUMPAD3] } },
        ],
        [VK.KEY_M]: [
          { trigger: "tap", action: { type: "remap", keys: [VK.NUMPAD0] } },
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
        { type: "delay", delayMs: DELAY_50_MS },
        { type: "cursorRestore" },
      ],
    },
    {
      id: "save-shortcut-macro",
      name: "Ctrl+S 保存マクロ",
      actions: [
        {
          type: "remap",
          keys: [VK.LCTRL, VK.KEY_S],
        },
        { type: "delay", delayMs: DELAY_100_MS },
      ],
    },
  ],
  layerOrder: ["base", "fn", "numpad", "shift"],
  globalSettings: {
    defaultHoldThresholdMs: DEFAULT_HOLD_MS,
    defaultTapIntervalMs: DEFAULT_TAP_MS,
  },
};

/**
 * モック初期化時のデフォルトプロファイルマップ
 */
export const INITIAL_MOCK_PROFILES: Record<string, RemapConfig> = {
  default: DEFAULT_PROFILE,
  "mock-sample": MOCK_SAMPLE_PROFILE,
};

export const INITIAL_MOCK_ACTIVE_PROFILE = "mock-sample";
