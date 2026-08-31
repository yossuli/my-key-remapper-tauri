import type { Action, ActionType } from "@/types/remapConfig";
import { objectiveDiscriminantSwitch } from "@/utils/objectiveSwitch";

export interface RemapBindingState {
  actionType: "remap";
  targetKeys: number[];
  repeat?: boolean;
  repeatDelayMs?: number;
  repeatIntervalMs?: number;
}

export interface LayerToggleBindingState {
  actionType: "layerToggle";
  selectedLayerId: string;
}

export interface LayerMomentaryBindingState {
  actionType: "layerMomentary";
  selectedLayerId: string;
}

export interface MouseMoveBindingState {
  actionType: "mouseMove";
  mouseX?: number;
  mouseY?: number;
}

export interface MouseClickBindingState {
  actionType: "mouseClick";
  mouseX?: number;
  mouseY?: number;
  mouseButton: "left" | "right" | "middle";
  clickCount: number;
}

export interface NoneBindingState {
  actionType: "none";
}

export interface CursorSaveBindingState {
  actionType: "cursorSave";
}

export interface CursorRestoreBindingState {
  actionType: "cursorRestore";
}

export interface DelayBindingState {
  actionType: "delay";
  delayActionMs: number;
}

export interface MacroBindingState {
  actionType: "macro";
  macroId: string;
}

export interface ScrollModeBindingState {
  actionType: "scrollMode";
  sensitivity?: number;
  invert?: boolean;
  axis?: "both" | "vertical" | "horizontal";
}

export type BindingState =
  | RemapBindingState
  | LayerToggleBindingState
  | LayerMomentaryBindingState
  | MouseMoveBindingState
  | MouseClickBindingState
  | NoneBindingState
  | CursorSaveBindingState
  | CursorRestoreBindingState
  | ScrollModeBindingState
  | DelayBindingState
  | MacroBindingState;

/**
 * ActionからBindingStateへ変換
 */
export function actionToBindingState(action: Action): BindingState {
  return objectiveDiscriminantSwitch<Action, "type", BindingState>(
    {
      remap: (act) => ({
        actionType: "remap",
        targetKeys: act.keys,
        repeat: act.repeat ?? false,
        repeatDelayMs: act.repeatDelayMs ?? DEFAULT_REPEAT_DELAY_MS,
        repeatIntervalMs: act.repeatIntervalMs ?? DEFAULT_REPEAT_INTERVAL_MS,
      }),
      layerToggle: (act) => ({
        actionType: "layerToggle",
        selectedLayerId: act.layerId,
      }),
      layerMomentary: (act) => ({
        actionType: "layerMomentary",
        selectedLayerId: act.layerId,
      }),
      mouseMove: (act) => ({
        actionType: "mouseMove",
        mouseX: act.x,
        mouseY: act.y,
      }),
      mouseClick: (act) => ({
        actionType: "mouseClick",
        mouseX: act.x,
        mouseY: act.y,
        mouseButton: act.button,
        clickCount: act.clickCount ?? 1,
      }),
      none: () => ({ actionType: "none" }),
      cursorSave: () => ({ actionType: "cursorSave" }),
      cursorRestore: () => ({ actionType: "cursorRestore" }),
      delay: (act) => ({
        actionType: "delay",
        delayActionMs: act.delayMs,
      }),
      macro: (act) => ({
        actionType: "macro",
        macroId: act.macroId,
      }),
      scrollMode: (act) => ({
        actionType: "scrollMode",
        sensitivity: act.sensitivity ?? 1.0,
        invert: act.invert ?? false,
        axis: act.axis ?? "both",
      }),
    },
    action,
    "type"
  );
}

/**
 * BindingStateからActionへ変換
 */
export function convertBindingStateToAction(state: BindingState): Action {
  return objectiveDiscriminantSwitch<BindingState, "actionType", Action>(
    {
      remap: (s) => ({
        type: "remap",
        keys: s.targetKeys,
        repeat: s.repeat,
        repeatDelayMs: s.repeatDelayMs,
        repeatIntervalMs: s.repeatIntervalMs,
      }),
      macro: (s) => ({ type: "macro", macroId: s.macroId }),
      layerToggle: (s) => ({
        type: "layerToggle",
        layerId: s.selectedLayerId,
      }),
      layerMomentary: (s) => ({
        type: "layerMomentary",
        layerId: s.selectedLayerId,
      }),
      mouseClick: (s) => ({
        type: "mouseClick",
        x: s.mouseX,
        y: s.mouseY,
        button: s.mouseButton,
        clickCount: s.clickCount,
      }),
      mouseMove: (s) => ({
        type: "mouseMove",
        x: s.mouseX,
        y: s.mouseY,
      }),
      cursorSave: () => ({ type: "cursorSave" }),
      cursorRestore: () => ({ type: "cursorRestore" }),
      scrollMode: (s) => ({
        type: "scrollMode",
        sensitivity: s.sensitivity,
        invert: s.invert,
        axis: s.axis,
      }),
      delay: (s) => ({ type: "delay", delayMs: s.delayActionMs }),
      none: () => ({ type: "none" }),
    },
    state,
    "actionType"
  );
}

// Constants (Source of Truth)
export const DEFAULT_REPEAT_DELAY_MS = 500;
export const DEFAULT_REPEAT_INTERVAL_MS = 100;
export const DEFAULT_DELAY_MS = 500;
export const DEFAULT_LAYER_ID = "base";
export const DEFAULT_MOUSE_X = 0;
export const DEFAULT_MOUSE_Y = 0;

/**
 * アクションタイプ切り替え時の初期状態を生成
 */
export function getInitialStateForType(type: ActionType): BindingState {
  switch (type) {
    case "remap":
      return {
        actionType: "remap",
        repeat: false,
        targetKeys: [],
        repeatDelayMs: DEFAULT_REPEAT_DELAY_MS,
        repeatIntervalMs: DEFAULT_REPEAT_INTERVAL_MS,
      };
    case "layerToggle":
      return {
        actionType: "layerToggle",
        selectedLayerId: DEFAULT_LAYER_ID,
      };
    case "layerMomentary":
      return {
        actionType: "layerMomentary",
        selectedLayerId: DEFAULT_LAYER_ID,
      };
    case "mouseMove":
      return {
        actionType: "mouseMove",
        mouseX: undefined,
        mouseY: undefined,
      };
    case "mouseClick":
      return {
        actionType: "mouseClick",
        mouseX: undefined,
        mouseY: undefined,
        mouseButton: "left",
        clickCount: 1,
      };
    case "cursorSave":
      return { actionType: "cursorSave" };
    case "cursorRestore":
      return { actionType: "cursorRestore" };
    case "scrollMode":
      return {
        actionType: "scrollMode",
        sensitivity: 1.0,
        invert: false,
        axis: "both",
      };
    case "delay":
      return {
        actionType: "delay",
        delayActionMs: DEFAULT_DELAY_MS,
      };
    case "macro":
      return { actionType: "macro", macroId: "" };
    case "none":
      return { actionType: "none" };
    default:
      return { actionType: "none" };
  }
}

/**
 * Actionから完全なBindingStateを生成（デフォルト値補完付き）
 */
export function createBindingStateFromAction(action: Action): BindingState {
  const partial = actionToBindingState(action);

  const typeBase = getInitialStateForType(partial.actionType);
  return { ...typeBase, ...partial } as BindingState;
}

/**
 * 初期BindingStateを作成
 */
export function createInitialBindingState(): BindingState {
  return {
    actionType: "remap",
    targetKeys: [],

    repeat: false,
    repeatDelayMs: DEFAULT_REPEAT_DELAY_MS,
    repeatIntervalMs: DEFAULT_REPEAT_INTERVAL_MS,
  };
}
