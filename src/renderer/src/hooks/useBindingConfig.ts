// バインディング設定読み込みフック

import type { RemapAction } from "@shared/types/remapConfig";

// --- Types for encapsulation ---

// キーエディタUI制御関連
export interface KeyEditorUIHandlers {
  setIsInputFocused: (focused: boolean) => void;
  setIsRecording: (recording: boolean) => void;
}

// マウス座標の状態
export interface MousePosition {
  x: number | undefined;
  y: number | undefined;
}

// マウスキャプチャの状態
export interface MouseCaptureState {
  isCapturing: boolean;
  countdown: number;
}

// マウス操作関連
export interface MouseHandlers {
  setMouseX: (x: number) => void;
  setMouseY: (y: number) => void;
  setMouseButton: (button: "left" | "right" | "middle") => void;
  setClickCount: (count: number) => void;
  setCursorReturnDelayMs: (ms: number) => void;
  onGetMousePosition: () => void;
}

// マウス状態関連
export interface MouseState extends MousePosition, MouseCaptureState {
  button: "left" | "right" | "middle";
  clickCount: number;
  cursorReturnDelayMs: number;
}

// リピート設定のグループ
export interface RepeatSettings
  extends Pick<RemapAction, "repeat" | "repeatDelayMs" | "repeatIntervalMs"> {
  onRepeatChange: (repeat: boolean, delay?: number, interval?: number) => void;
}

import type {
  Action,
  ActionType,
  TriggerType,
} from "@shared/types/remapConfig";
import { useCallback, useEffect, useState } from "react";
import { useGetMappings } from "@/hooks/useInvoke";
import { useMousePosition } from "@/hooks/useMousePosition";
import {
  actionToBindingState,
  type BindingState,
  convertBindingStateToAction,
  createInitialBindingState,
  getInitialStateForType,
} from "@/models/BindingState";
import type { UseKeyEditorActionsReturn } from "./useKeyEditorAction";

export interface UseBindingConfigProps {
  targetVk?: number;
  layerId?: string;
  defaultLayerId: string;
  initialState?: BindingState;
  onSave: (action: Action) => void;
  onRemove?: () => void;
  selectedTrigger: TriggerType;
}

export interface UseBindingConfigReturn {
  state: BindingState;
  existingTiming: {
    holdThresholdMs: number | undefined;
    tapIntervalMs: number | undefined;
  };
  setActionType: (type: ActionType) => void;
  setTargetKeys: (keys: number[]) => void;
  addTargetKey: (keyCode: number) => void;
  clearTargetKeys: () => void;
  setSelectedLayerId: (id: string) => void;
  setDelayActionMs: (ms: number) => void;
  setMouseX: (x: number) => void;
  setMouseY: (y: number) => void;
  setMouseButton: (button: "left" | "right" | "middle") => void;
  setClickCount: (count: number) => void;
  setCursorReturnDelayMs: (ms: number) => void;
  setMacroId: (id: string) => void;
  setRepeat: (repeat: boolean) => void;
  setRepeatDelayMs: (ms: number) => void;
  setRepeatIntervalMs: (ms: number) => void;
  loadBindingForTrigger: (trigger: TriggerType) => Promise<void>;

  // Editor Actions & Helper Objects
  handleSave: () => void;
  handleRemove: (() => void) | undefined;
  keyEditorActions: UseKeyEditorActionsReturn;
  mouseHandlers: MouseHandlers;
  mouseState: MouseState;
  repeatSettings: RepeatSettings;
  keyEditorUIHandlers: KeyEditorUIHandlers;

  // UI States
  isInputFocused: boolean;
  isRecording: boolean;
  isCapturing: boolean;
  countdown: number;
}

/**
 * 特定キーのバインディング設定を読み込む、または初期状態を管理するフック
 */
export function useBindingConfig({
  targetVk,
  layerId,
  initialState,
  onSave,
  onRemove: handleRemove,
}: UseBindingConfigProps): UseBindingConfigReturn {
  const getMappings = useGetMappings();
  const [state, setState] = useState<BindingState>(
    () => initialState ?? createInitialBindingState()
  );

  const [existingTiming, setExistingTiming] = useState<{
    holdThresholdMs: number | undefined;
    tapIntervalMs: number | undefined;
  }>({ holdThresholdMs: undefined, tapIntervalMs: undefined });

  const fetchBindings = useCallback(async () => {
    if (targetVk === undefined || !layerId) {
      return;
    }
    const allLayers = await getMappings();
    if (!allLayers) {
      return;
    }
    const layer = allLayers.layers.find((l) => l.id === layerId);
    const bindings = layer?.bindings[targetVk];
    return bindings;
  }, [getMappings, layerId, targetVk]);

  const loadBindingForTrigger = useCallback<
    UseBindingConfigReturn["loadBindingForTrigger"]
  >(
    async (trigger) => {
      const bindings = await fetchBindings();
      const binding = bindings?.find((b) => b.trigger === trigger);

      if (binding) {
        const partial = actionToBindingState(binding.action);
        setState(partial);
      } else {
        setState(createInitialBindingState());
      }

      const holdTiming = bindings?.find((b) => b.trigger === "hold")?.timingMs;
      const doubleTapTiming = bindings?.find(
        (b) => b.trigger === "doubleTap"
      )?.timingMs;

      setExistingTiming({
        holdThresholdMs: holdTiming,
        tapIntervalMs: doubleTapTiming,
      });
    },
    [fetchBindings]
  );

  // 自動ロード用の useEffect を削除
  // ユーザーの指示により、イベント駆動で状態を管理するため、
  // 自動的な同期（useEffect）は廃止し、呼び出し側が責任を持ってロードを行う設計とする。

  // initialState が外部から変わった場合は同期する（主にマクロ編集用）
  useEffect(() => {
    if (initialState) {
      setState(initialState);
    }
  }, [initialState]);

  // --- UI States ---
  const [isCapturing, setIsCapturing] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [isInputFocused, setIsInputFocused] = useState(false);
  const [isRecording, setIsRecording] = useState(false);

  const MOUSE_CAPTURE_COUNTDOWN_START = 3;
  const COUNTDOWN_INTERVAL_MS = 1000;
  const DEFAULT_CURSOR_RETURN_DELAY_MS = 1000;

  // --- Setters ---
  const setActionType = useCallback<UseBindingConfigReturn["setActionType"]>(
    (actionType) => {
      setState(() => getInitialStateForType(actionType));
    },
    []
  );

  const setTargetKeys = useCallback<UseBindingConfigReturn["setTargetKeys"]>(
    (targetKeys) => {
      setState((prev) => ({ ...prev, targetKeys }));
    },
    []
  );

  const addTargetKey = useCallback<UseBindingConfigReturn["addTargetKey"]>(
    (keyCode) => {
      setState((prev) => {
        if (prev.actionType === "remap") {
          return {
            ...prev,
            targetKeys: prev.targetKeys.includes(keyCode)
              ? prev.targetKeys
              : [...prev.targetKeys, keyCode],
          };
        }
        return prev;
      });
    },
    []
  );

  const clearTargetKeys = useCallback<
    UseBindingConfigReturn["clearTargetKeys"]
  >(() => {
    setState((prev) => ({ ...prev, targetKeys: [] }));
  }, []);

  const setSelectedLayerId = useCallback<
    UseBindingConfigReturn["setSelectedLayerId"]
  >((selectedLayerId) => {
    setState((prev) => ({ ...prev, selectedLayerId }));
  }, []);

  const setDelayActionMs = useCallback<
    UseBindingConfigReturn["setDelayActionMs"]
  >((delayActionMs) => {
    setState((prev) => ({ ...prev, delayActionMs }));
  }, []);

  const setMouseX = useCallback<UseBindingConfigReturn["setMouseX"]>((x) => {
    setState((prev) => ({ ...prev, mouseX: x }));
  }, []);

  const setMouseY = useCallback<UseBindingConfigReturn["setMouseY"]>((y) => {
    setState((prev) => ({ ...prev, mouseY: y }));
  }, []);

  const setMouseButton = useCallback<UseBindingConfigReturn["setMouseButton"]>(
    (button) => {
      setState((prev) => ({ ...prev, mouseButton: button }));
    },
    []
  );

  const setClickCount = useCallback<UseBindingConfigReturn["setClickCount"]>(
    (count) => {
      setState((prev) => ({ ...prev, clickCount: count }));
    },
    []
  );

  const setCursorReturnDelayMs = useCallback<
    UseBindingConfigReturn["setCursorReturnDelayMs"]
  >((ms) => {
    setState((prev) => ({ ...prev, cursorReturnDelayMs: ms }));
  }, []);

  const setMacroId = useCallback<UseBindingConfigReturn["setMacroId"]>((id) => {
    setState((prev) => ({ ...prev, macroId: id }));
  }, []);

  const setRepeat = useCallback<UseBindingConfigReturn["setRepeat"]>(
    (repeat) => {
      setState((prev) => ({ ...prev, repeat }));
    },
    []
  );

  const setRepeatDelayMs = useCallback<
    UseBindingConfigReturn["setRepeatDelayMs"]
  >((ms) => {
    setState((prev) => ({ ...prev, repeatDelayMs: ms }));
  }, []);

  const setRepeatIntervalMs = useCallback<
    UseBindingConfigReturn["setRepeatIntervalMs"]
  >((ms) => {
    setState((prev) => ({ ...prev, repeatIntervalMs: ms }));
  }, []);

  // --- Actions ---
  const handleSave = useCallback(() => {
    const action = convertBindingStateToAction(state);
    onSave(action);
  }, [state, onSave]);

  const keyEditorActions: UseKeyEditorActionsReturn = {
    handleSave,
    handleRemove,
    canSave: state.actionType !== "none",
    keys: state.actionType === "remap" ? state.targetKeys : [],
    setKeys: setTargetKeys,
    reset: clearTargetKeys,
    holds: [],
    removeKey: (vk) =>
      setTargetKeys(
        state.actionType === "remap"
          ? state.targetKeys.filter((k) => k !== vk)
          : []
      ),
    addHoldKey: addTargetKey,
    removeHoldKey: () => {
      /* no-op */
    },
  };

  // --- Mouse & Repeat Logic ---
  const { getCursorPosition } = useMousePosition();
  const handleGetMousePosition = useCallback((): void => {
    setIsCapturing(true);
    setCountdown(MOUSE_CAPTURE_COUNTDOWN_START);
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          getCursorPosition().then((pos) => {
            setMouseX(pos.x);
            setMouseY(pos.y);
            setIsCapturing(false);
          });
          return 0;
        }
        return prev - 1;
      });
    }, COUNTDOWN_INTERVAL_MS);
  }, [getCursorPosition, setMouseX, setMouseY]);

  const mouseHandlers: MouseHandlers = {
    setMouseX,
    setMouseY,
    setMouseButton,
    setClickCount,
    setCursorReturnDelayMs,
    onGetMousePosition: handleGetMousePosition,
  };

  const mouseState: MouseState = {
    x:
      state.actionType === "mouseMove" || state.actionType === "mouseClick"
        ? state.mouseX
        : undefined,
    y:
      state.actionType === "mouseMove" || state.actionType === "mouseClick"
        ? state.mouseY
        : undefined,
    button: state.actionType === "mouseClick" ? state.mouseButton : "left",
    clickCount: state.actionType === "mouseClick" ? state.clickCount : 1,
    cursorReturnDelayMs:
      state.actionType === "cursorReturn"
        ? state.cursorReturnDelayMs
        : DEFAULT_CURSOR_RETURN_DELAY_MS,
    isCapturing,
    countdown,
  };

  const repeatSettings: RepeatSettings = {
    repeat: state.actionType === "remap" ? state.repeat : undefined,
    repeatDelayMs:
      state.actionType === "remap" ? state.repeatDelayMs : undefined,
    repeatIntervalMs:
      state.actionType === "remap" ? state.repeatIntervalMs : undefined,
    onRepeatChange: (r, d, i) => {
      setRepeat(r);
      if (d !== undefined) {
        setRepeatDelayMs(d);
      }
      if (i !== undefined) {
        setRepeatIntervalMs(i);
      }
    },
  };

  const keyEditorUIHandlers: KeyEditorUIHandlers = {
    setIsInputFocused,
    setIsRecording,
  };

  return {
    state,
    existingTiming,
    setActionType,
    setTargetKeys,
    addTargetKey,
    clearTargetKeys,
    setSelectedLayerId,
    setDelayActionMs,
    setMouseX,
    setMouseY,
    setMouseButton,
    setClickCount,
    setCursorReturnDelayMs,
    setMacroId,
    setRepeat,
    setRepeatDelayMs,
    setRepeatIntervalMs,
    loadBindingForTrigger,
    handleSave,
    handleRemove,
    keyEditorActions,
    mouseHandlers,
    mouseState,
    repeatSettings,
    keyEditorUIHandlers,
    isInputFocused,
    isRecording,
    isCapturing,
    countdown,
  };
}
