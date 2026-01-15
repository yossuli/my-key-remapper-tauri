import type { Action } from "@shared/types/remapConfig";
import { objectiveDiscriminantSwitch } from "@shared/utils/objectiveSwitch";

interface BindingStateBase {
  targetKeys: number[];
  selectedLayerId: string;
  hasExistingBinding: boolean;
}

export interface RemapBindingState extends BindingStateBase {
  actionType: "remap";
  repeat?: boolean;
  repeatDelayMs?: number;
  repeatIntervalMs?: number;
}

export interface LayerToggleBindingState extends BindingStateBase {
  actionType: "layerToggle";
}

export interface LayerMomentaryBindingState extends BindingStateBase {
  actionType: "layerMomentary";
}

export interface MouseMoveBindingState extends BindingStateBase {
  actionType: "mouseMove";
  mouseX: number;
  mouseY: number;
}

export interface MouseClickBindingState extends BindingStateBase {
  actionType: "mouseClick";
  mouseX: number;
  mouseY: number;
  mouseButton: "left" | "right" | "middle";
  clickCount: number;
}

export interface NoneBindingState extends BindingStateBase {
  actionType: "none";
}

export interface CursorReturnBindingState extends BindingStateBase {
  actionType: "cursorReturn";
  cursorReturnDelayMs: number;
}

export interface DelayBindingState extends BindingStateBase {
  actionType: "delay";
  delayActionMs: number;
}

export interface MacroBindingState extends BindingStateBase {
  actionType: "macro";
  macroId: string;
}

export type BindingState =
  | RemapBindingState
  | LayerToggleBindingState
  | LayerMomentaryBindingState
  | MouseMoveBindingState
  | MouseClickBindingState
  | NoneBindingState
  | CursorReturnBindingState
  | DelayBindingState
  | MacroBindingState;

/**
 * ActionからBindingStateへ変換
 */
export function actionToBindingState(action: Action): Partial<BindingState> {
  return objectiveDiscriminantSwitch<Action, "type", Partial<BindingState>>(
    {
      remap: (act) => ({
        actionType: "remap",
        targetKeys: act.keys,
        repeat: act.repeat,
        repeatDelayMs: act.repeatDelayMs,
        repeatIntervalMs: act.repeatIntervalMs,
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
      cursorReturn: (act) => ({
        actionType: "cursorReturn",
        cursorReturnDelayMs: act.delayMs,
      }),
      delay: (act) => ({
        actionType: "delay",
        delayActionMs: act.delayMs,
      }),
      macro: (act) => ({
        actionType: "macro",
        macroId: act.macroId,
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
      cursorReturn: (s) => ({
        type: "cursorReturn",
        delayMs: s.cursorReturnDelayMs,
      }),
      delay: (s) => ({ type: "delay", delayMs: s.delayActionMs }),
      none: () => ({ type: "none" }),
    },
    state,
    "actionType"
  );
}

/**
 * 初期BindingStateを作成
 */
export function createInitialBindingState(
  defaultLayerId: string
): BindingState {
  return {
    actionType: "remap",
    targetKeys: [],
    selectedLayerId: defaultLayerId,
    hasExistingBinding: false,
    repeat: false,
    repeatDelayMs: 500,
    repeatIntervalMs: 100,
  };
}
