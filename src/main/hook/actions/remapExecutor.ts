import type { RemapAction, TriggerType } from "@shared/types/remapConfig";
import { sendKey } from "../../native/sender";
import { remapRules } from "../../state/rules";
import { debugLog } from "../../utils/debugLogger";

const DEFAULT_REPEAT_DELAY_MS = 500;
const DEFAULT_REPEAT_INTERVAL_MS = 100;

/** 現在押しっぱなし（Hold）状態のリマップキー（物理vkCode -> 送信中vkCode配列） */
const activeRemapKeys = new Map<number, number[]>();

/** リピート実行中のタイマー（物理vkCode -> Timeout/Interval ID） */
const repeatingTimers = new Map<number, NodeJS.Timeout>();

/** レイヤーモーメンタリ用：どのキーがどのレイヤーを有効にしているか */
const momentaryLayerKeys = new Map<number, string>();

/**
 * リマップアクション（ホールド）を停止
 */
export function stopRemapAction(vkCode: number): void {
  // リピートタイマーがあれば停止
  if (repeatingTimers.has(vkCode)) {
    debugLog("remapExecutor.ts-stopRemapAction-clear-repeat", { vkCode });
    const timerId = repeatingTimers.get(vkCode);
    if (timerId) {
      clearTimeout(timerId);
      clearInterval(timerId);
    }
    repeatingTimers.delete(vkCode);
  }

  const activeKeys = activeRemapKeys.get(vkCode);
  if (activeKeys) {
    debugLog("remapExecutor.ts-stopRemapAction-releasing", {
      vkCode,
      activeKeys,
    });
    // 逆順にキーアップを送信
    for (const key of activeKeys.toReversed()) {
      sendKey(key, true, "remap-stop");
    }
    activeRemapKeys.delete(vkCode);
  }
}

/**
 * リマップアクションを実行
 */
export function executeRemapAction(
  vkCode: number,
  trigger: TriggerType,
  action: RemapAction
) {
  debugLog("remapExecutor.ts-executeRemapAction", {
    vkCode,
    trigger,
  });

  // 既存のアクションがあれば停止
  stopRemapAction(vkCode);

  if (trigger === "hold") {
    // リマップキー送信時に全アクティブレイヤーの修飾キーも反映する
    const layerModifiers = remapRules.getAllActiveModifiers();

    if (action.repeat) {
      debugLog("remapExecutor.ts-executeRemapAction-repeat-start", {
        vkCode,
        delay: action.repeatDelayMs,
        interval: action.repeatIntervalMs,
      });

      // 初回実行 (Tap)
      sendLayerKeys(action.keys, false, layerModifiers); // 合算キーを送信
      sendLayerKeys(action.keys, true, layerModifiers);

      const delay = action.repeatDelayMs ?? DEFAULT_REPEAT_DELAY_MS;
      const interval = action.repeatIntervalMs ?? DEFAULT_REPEAT_INTERVAL_MS;

      // 遅延後にリピート開始
      const timeoutId = setTimeout(() => {
        debugLog("remapExecutor.ts-executeRemapAction-repeat-tick-initial");
        sendLayerKeys(action.keys, false, layerModifiers);
        sendLayerKeys(action.keys, true, layerModifiers);

        const intervalId = setInterval(() => {
          debugLog("remapExecutor.ts-executeRemapAction-repeat-tick");
          sendLayerKeys(action.keys, false, layerModifiers);
          sendLayerKeys(action.keys, true, layerModifiers);
        }, interval);

        repeatingTimers.set(vkCode, intervalId);
      }, delay);

      repeatingTimers.set(vkCode, timeoutId);
    } else {
      // 押しっぱなしにする (デフォルト)
      // 修飾キーを押してからリマップキーを押す
      for (const vk of layerModifiers) {
        sendKey(vk, false, "remap-modifier");
      }
      for (const key of action.keys) {
        sendKey(key, false, "remap-down");
      }
      // activeRemapKeys には「解除が必要な全キー」を記録しておく
      activeRemapKeys.set(vkCode, [...layerModifiers, ...action.keys]);
    }
  } else {
    // tap / doubleTap
    const layerModifiers = remapRules.getAllActiveModifiers();
    sendLayerKeys(action.keys, false, layerModifiers);
    sendLayerKeys(action.keys, true, layerModifiers);
  }
}

/**
 * キーアップ時のモーメンタリレイヤー解除
 */
export function releaseMomentaryLayer(vkCode: number) {
  const layerId = momentaryLayerKeys.get(vkCode);
  if (layerId) {
    debugLog("remapExecutor.ts-releaseMomentaryLayer", {
      vkCode,
      layerId,
    });
    // 現在のスタックに基づく全修飾キーを取得（popする前）
    const layerKeys = remapRules.getAllActiveModifiers();

    remapRules.popLayer(layerId);
    momentaryLayerKeys.delete(vkCode);

    // 全レイヤー設定に基づく修飾キーの解除（物理キーUP）
    // NOTE: 厳密にはスタックが変化した後の差分だけを管理すべきだが、
    // 現在の実装に合わせて全リリースを行う。
    for (const vk of layerKeys.toReversed()) {
      sendKey(vk, true, "layer-remove");
    }
  }
}

/**
 * モーメンタリレイヤーを追加
 */
export function addMomentaryLayer(vkCode: number, layerId: string) {
  const isLayerSetCurrent = momentaryLayerKeys.get(vkCode);
  if (isLayerSetCurrent === undefined) {
    debugLog("remapExecutor.ts-addMomentaryLayer", { vkCode, layerId });

    // レイヤーをスタックに追加した後の全集約キーを取得
    remapRules.pushLayer(layerId);
    momentaryLayerKeys.set(vkCode, layerId);

    const layerKeys = remapRules.getAllActiveModifiers();

    // 集約された全修飾キーを送信（物理キーDOWN）
    for (const vk of layerKeys) {
      sendKey(vk, false, "layer-add");
    }
  }
}

/**
 * 指定キーがモーメンタリレイヤーを発火中かどうか
 */
export function isLayerMomentaryKey(vkCode: number): boolean {
  return momentaryLayerKeys.has(vkCode);
}

/**
 * レイヤーキーと一緒にキーを送信するヘルパー
 */
function sendLayerKeys(keys: number[], isUp: boolean, layerKeys: number[]) {
  if (isUp) {
    // keyUp: キー郡を離してから アクティブキー を離す
    for (const vk of keys.toReversed()) {
      sendKey(vk, true);
    }
    for (const vk of layerKeys.toReversed()) {
      sendKey(vk, true);
    }
  } else {
    // keyDown: アクティブキー を押してから キー郡 を押す
    for (const vk of layerKeys) {
      sendKey(vk, false);
    }
    for (const vk of keys) {
      sendKey(vk, false);
    }
  }
}

/**
 * 現在のレイヤーに応じた修飾キー付きでキーを送信
 */
export function sendKeyWithLayerModifiers(vkCode: number, isUp: boolean): void {
  debugLog("remapExecutor.ts-sendKeyWithLayerModifiers", {
    vkCode,
    isUp,
  });

  const layerKeys = remapRules.getAllActiveModifiers();

  if (layerKeys.length > 0) {
    sendLayerKeys([vkCode], isUp, layerKeys);
  } else {
    sendKey(vkCode, isUp);
  }
}
