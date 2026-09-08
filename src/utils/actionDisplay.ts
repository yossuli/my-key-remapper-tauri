import type { LayoutType } from "@/types";
import type { Action, ActionType } from "@/types/remapConfig";
import { getKeyLabel, isNumpadVk } from "./getKeyLabel";

export type ActionStyleVariant =
  | "remap"
  | "numpad"
  | "macro"
  | "mouse"
  | "layer"
  | "delay"
  | "disabled"
  | "default";

export interface ActionDisplayInfo {
  actionType: ActionType | "none_default";
  label: string;
  badge?: string;
  styleVariant: ActionStyleVariant;
  tooltip: string;
  isNumpad?: boolean;
}

const formatRemap = (
  action: Extract<Action, { type: "remap" }>,
  defaultLabel: string,
  layout: LayoutType
): ActionDisplayInfo => {
  const keys = action.keys ?? [];
  if (keys.length === 0) {
    return {
      actionType: "remap",
      label: defaultLabel,
      styleVariant: "default",
      tooltip: `未設定 (${defaultLabel})`,
    };
  }

  const isSingleNumpad = keys.length === 1 && isNumpadVk(keys[0]);
  const label = getKeyLabel(keys, layout);

  if (isSingleNumpad) {
    return {
      actionType: "remap",
      label,
      badge: "NUM",
      styleVariant: "numpad",
      tooltip: `テンキーリマップ: Num ${label} (${defaultLabel} → Num ${label})`,
      isNumpad: true,
    };
  }

  return {
    actionType: "remap",
    label,
    styleVariant: "remap",
    tooltip: `キーリマップ: ${label} (${defaultLabel} → ${label})`,
  };
};

const formatMacro = (
  action: Extract<Action, { type: "macro" }>,
  macroNameMap?: Record<string, string>
): ActionDisplayInfo => {
  const macroName = macroNameMap?.[action.macroId] ?? action.macroId;
  return {
    actionType: "macro",
    label: macroName,
    badge: "MACRO",
    styleVariant: "macro",
    tooltip: `マクロ実行: ${macroName} (ID: ${action.macroId})`,
  };
};

const formatMouseMove = (
  action: Extract<Action, { type: "mouseMove" }>
): ActionDisplayInfo => {
  const xText = action.x !== undefined ? `X:${action.x}` : "";
  const yText = action.y !== undefined ? `Y:${action.y}` : "";
  const coordText = [xText, yText].filter(Boolean).join(" ");
  return {
    actionType: "mouseMove",
    label: coordText || "Move",
    badge: "MOUSE",
    styleVariant: "mouse",
    tooltip: `マウス移動: X:${action.x ?? "維持"}, Y:${action.y ?? "維持"}`,
  };
};

const MOUSE_BUTTON_LABELS: Record<string, string> = {
  left: "L-Click",
  right: "R-Click",
  middle: "M-Click",
  x1: "MB4",
  x2: "MB5",
};

const formatMouseClick = (
  action: Extract<Action, { type: "mouseClick" }>
): ActionDisplayInfo => {
  const btnLabel = MOUSE_BUTTON_LABELS[action.button] ?? action.button;
  const count = action.clickCount ?? 1;
  const countSuffix = count > 1 ? ` x${count}` : "";
  return {
    actionType: "mouseClick",
    label: `${btnLabel}${countSuffix}`,
    badge: "CLICK",
    styleVariant: "mouse",
    tooltip: `マウスクリック: ${btnLabel}${countSuffix}`,
  };
};

const formatScrollMode = (
  action: Extract<Action, { type: "scrollMode" }>
): ActionDisplayInfo => {
  const sens = action.sensitivity !== undefined ? `${action.sensitivity}x` : "";
  return {
    actionType: "scrollMode",
    label: sens ? `Scroll ${sens}` : "Scroll",
    badge: "SCROLL",
    styleVariant: "mouse",
    tooltip: `スクロールモード (感度: ${action.sensitivity ?? 1}x, 反転: ${
      action.invert ? "有効" : "無効"
    })`,
  };
};

export function getActionDisplayInfo(
  action: Action | undefined,
  defaultLabel: string,
  layout: LayoutType,
  macroNameMap?: Record<string, string>
): ActionDisplayInfo {
  if (!action) {
    return {
      actionType: "none_default",
      label: defaultLabel,
      styleVariant: "default",
      tooltip: `キー: ${defaultLabel}`,
    };
  }

  switch (action.type) {
    case "remap":
      return formatRemap(action, defaultLabel, layout);
    case "macro":
      return formatMacro(action, macroNameMap);
    case "layerToggle":
      return {
        actionType: "layerToggle",
        label: `[${action.layerId}]`,
        badge: "LAYER",
        styleVariant: "layer",
        tooltip: `レイヤー切替: ${action.layerId}`,
      };
    case "layerMomentary":
      return {
        actionType: "layerMomentary",
        label: `(${action.layerId})`,
        badge: "LAYER",
        styleVariant: "layer",
        tooltip: `レイヤー一時切替 (押下中): ${action.layerId}`,
      };
    case "mouseMove":
      return formatMouseMove(action);
    case "mouseClick":
      return formatMouseClick(action);
    case "cursorSave":
      return {
        actionType: "cursorSave",
        label: "Pos 💾",
        badge: "MOUSE",
        styleVariant: "mouse",
        tooltip: "カーソル位置記憶",
      };
    case "cursorRestore":
      return {
        actionType: "cursorRestore",
        label: "Pos ↩",
        badge: "MOUSE",
        styleVariant: "mouse",
        tooltip: "記憶したカーソル位置を復元",
      };
    case "scrollMode":
      return formatScrollMode(action);
    case "delay":
      return {
        actionType: "delay",
        label: `${action.delayMs}ms`,
        badge: "WAIT",
        styleVariant: "delay",
        tooltip: `待機: ${action.delayMs}ms`,
      };
    case "none":
      return {
        actionType: "none",
        label: "×",
        badge: "OFF",
        styleVariant: "disabled",
        tooltip: `キー無効化 (${defaultLabel})`,
      };
    default:
      return {
        actionType: "none_default",
        label: defaultLabel,
        styleVariant: "default",
        tooltip: `キー: ${defaultLabel}`,
      };
  }
}
