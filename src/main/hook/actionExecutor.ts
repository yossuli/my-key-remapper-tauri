import type {
  Action,
  KeyBinding,
  TriggerType,
} from "@shared/types/remapConfig";
import { clickAt, getCursorPosition, moveMouse } from "../native/mouseSender";
import { sendKey } from "../native/sender";
import { remapRules } from "../state/rules";
import { debugLog } from "../utils/debugLogger";

import { executeMacroAction } from "./actions/macroExecutor";
import {
  addMomentaryLayer,
  executeRemapAction,
  sendKeyWithLayerModifiers,
} from "./actions/remapExecutor";

/**
 * tap のみのバインディングを処理
 */
export function handleTapOnlyBindings(
  vkCode: number,
  bindings: KeyBinding[],
  isUp: boolean
): number | null {
  for (const { trigger } of bindings) {
    if (trigger !== "tap") {
      debugLog("actionExecutor.ts-88-handleTapOnlyBindings-skip-non-tap", {
        trigger,
      });
      return null;
    }
  }

  const action = remapRules.getAction(vkCode, "tap");

  if (action) {
    if (action.type === "remap") {
      debugLog("actionExecutor.ts-98-handleTapOnlyBindings-remap", { action });
      for (const key of action.keys) {
        sendKey(key, isUp);
      }
      return 1;
    }
    if (isUp) {
      debugLog("actionExecutor.ts-106-handleTapOnlyBindings-up-action", {
        action,
      });
      executeActionInternal(vkCode, "tap", action).catch((err) => {
        console.error("Error in handleTapOnlyBindings internal exec:", err);
      });
      return 1;
    }
    return 1;
  }

  debugLog("actionExecutor.ts-113-handleTapOnlyBindings-passthrough");
  sendKeyWithLayerModifiers(vkCode, isUp);
  return 1;
}

/**
 * アクションを実行する内部関数（再帰・非同期）
 */
export async function executeActionInternal(
  vkCode: number,
  trigger: TriggerType,
  action: Action
): Promise<void> {
  debugLog("actionExecutor.ts-executeActionInternal-start", {
    actionType: action.type,
  });
  switch (action.type) {
    case "macro":
      await executeMacroAction(vkCode, trigger, action);
      break;

    case "delay":
      // 指定時間待機
      debugLog("actionExecutor.ts-executeActionInternal-delay", {
        ms: action.delayMs,
      });
      await new Promise((resolve) => setTimeout(resolve, action.delayMs));
      break;

    case "mouseMove": {
      const current = getCursorPosition();
      moveMouse(action.x ?? current.x, action.y ?? current.y);
      break;
    }
    case "mouseClick": {
      const current = getCursorPosition();
      await clickAt(
        action.x ?? current.x,
        action.y ?? current.y,
        action.button,
        action.clickCount ?? 1
      );
      break;
    }
    case "layerToggle":
      remapRules.setLayer(action.layerId);
      break;
    case "layerMomentary":
      addMomentaryLayer(vkCode, action.layerId);
      break;
    case "none":
      break;
    case "remap":
      executeRemapAction(vkCode, trigger, action);
      break;
    case "cursorReturn": {
      const savedPosition = getCursorPosition();
      setTimeout(() => {
        moveMouse(savedPosition.x, savedPosition.y);
      }, action.delayMs);
      break;
    }
    default: {
      const _: never = action;
      break;
    }
  }
}

/**
 * トリガーに対応するアクションを実行
 */
export function executeAction(vkCode: number, trigger: TriggerType) {
  debugLog("actionExecutor.ts-163-executeAction-start", { vkCode, trigger });
  const action = remapRules.getAction(vkCode, trigger);
  const bindings = remapRules.getBindings(vkCode);

  const tapResult = handleTapOnlyBindings(vkCode, bindings, true);
  if (tapResult !== null) {
    debugLog("actionExecutor.ts-169-executeAction-handled-by-tap-logic");
    return;
  }

  if (!action) {
    debugLog("actionExecutor.ts-173-executeAction-no-action");
    sendKeyWithLayerModifiers(vkCode, false);
    sendKeyWithLayerModifiers(vkCode, true);
    return;
  }

  // Fire-and-forget: フックをブロックせずバックグラウンド実行
  executeActionInternal(vkCode, trigger, action).catch((err) => {
    console.error("Error in executeActionInternal:", err);
  });
}
