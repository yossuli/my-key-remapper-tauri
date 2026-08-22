import type { Action, TriggerType } from "@/types/remapConfig";
import { useCallback, useEffect, useState } from "react";
import { useGetMappings } from "@/hooks/api/useInvoke";
import {
  actionToBindingState,
  type BindingState,
  convertBindingStateToAction,
  createInitialBindingState,
  DEFAULT_REPEAT_DELAY_MS,
  DEFAULT_REPEAT_INTERVAL_MS,
} from "@/models/bindingStateModel";

export interface RepeatConfig {
  enabled: boolean;
  delayMs?: number;
  intervalMs?: number;
}

export interface ActionSetters {
  setRemapAction: (keys: number[], repeat?: RepeatConfig) => void;
  setLayerAction: (type: "toggle" | "momentary", layerId: string) => void;
  setMouseMoveAction: (x: number | undefined, y: number | undefined) => void;
  setMouseClickAction: (
    x: number | undefined,
    y: number | undefined,
    button: "left" | "right" | "middle",
    clickCount: number
  ) => void;
  setCursorSaveAction: () => void;
  setCursorRestoreAction: () => void;
  setMacroAction: (macroId: string) => void;
  setDelayAction: (delayMs: number) => void;
  setNoneAction: () => void;
}

export interface UseBindingConfigProps {
  targetVk?: number;
  layerId?: string;
  trigger?: TriggerType;
  initialState?: BindingState;
  onSave: (action: Action) => void;
  onRemove?: () => void;
}

export interface UseBindingConfigReturn {
  state: BindingState;
  isLoading: boolean;
  actionSetters: ActionSetters;
  getAction: () => Action;
  loadBinding: (trigger: TriggerType) => Promise<void>;
  handleSave: () => void;
  handleRemove: (() => void) | undefined;
  existingTiming: {
    holdThresholdMs: number | undefined;
    tapIntervalMs: number | undefined;
    interruptBehavior: "forceTap" | "ignore" | undefined;
  };
}

export function useBindingConfig({
  targetVk,
  layerId,
  trigger,
  initialState,
  onSave,
  onRemove,
}: UseBindingConfigProps): UseBindingConfigReturn {
  const getMappings = useGetMappings();

  const [state, setState] = useState<BindingState>(
    () => initialState ?? createInitialBindingState()
  );

  const [isLoading, setIsLoading] = useState(false);

  const [existingTiming, setExistingTiming] = useState<{
    holdThresholdMs: number | undefined;
    tapIntervalMs: number | undefined;
    interruptBehavior: "forceTap" | "ignore" | undefined;
  }>({ holdThresholdMs: undefined, tapIntervalMs: undefined, interruptBehavior: undefined });

  const loadBinding = useCallback<UseBindingConfigReturn["loadBinding"]>(
    async (t) => {
      if (targetVk === undefined || !layerId) {
        return;
      }

      setIsLoading(true);
      try {
        const allLayers = await getMappings();
        if (!allLayers) {
          return;
        }

        const layer = allLayers.layers.find((l) => l.id === layerId);
        const bindings = layer?.bindings[targetVk];
        const binding = bindings?.find((b) => b.trigger === t);

        if (binding) {
          const partial = actionToBindingState(binding.action);
          setState(partial);
          setExistingTiming((prev) => ({
            ...prev,
            holdThresholdMs: t === "hold" ? binding.timingMs : prev.holdThresholdMs,
            tapIntervalMs: t === "doubleTap" ? binding.timingMs : prev.tapIntervalMs,
            interruptBehavior: t === "hold" ? binding.interruptBehavior : prev.interruptBehavior,
          }));
        } else {
          setState(createInitialBindingState());
        }

        const holdTiming = bindings?.find(
          (b) => b.trigger === "hold"
        )?.timingMs;
        const doubleTapTiming = bindings?.find(
          (b) => b.trigger === "doubleTap"
        )?.timingMs;
        const interruptBehavior = bindings?.find(
          (b) => b.trigger === "hold"
        )?.interruptBehavior;

        setExistingTiming({
          holdThresholdMs: holdTiming,
          tapIntervalMs: doubleTapTiming,
          interruptBehavior: interruptBehavior,
        });
      } catch (err) {
        console.error("Failed to load binding config:", err);
      } finally {
        setIsLoading(false);
      }
    },
    [getMappings, layerId, targetVk]
  );

  useEffect(() => {
    if (trigger) {
      loadBinding(trigger);
    }
  }, [trigger, loadBinding]);

  const setRemapAction = useCallback<ActionSetters["setRemapAction"]>(
    (keys, repeat) => {
      setState({
        actionType: "remap",
        targetKeys: keys,
        repeat: repeat?.enabled ?? false,
        repeatDelayMs: repeat?.delayMs ?? DEFAULT_REPEAT_DELAY_MS,
        repeatIntervalMs: repeat?.intervalMs ?? DEFAULT_REPEAT_INTERVAL_MS,
      });
    },
    []
  );

  const setLayerAction = useCallback<ActionSetters["setLayerAction"]>(
    (type, targetLayerId) => {
      if (type === "toggle") {
        setState({ actionType: "layerToggle", selectedLayerId: targetLayerId });
      } else {
        setState({
          actionType: "layerMomentary",
          selectedLayerId: targetLayerId,
        });
      }
    },
    []
  );

  const setMouseMoveAction = useCallback<ActionSetters["setMouseMoveAction"]>(
    (x, y) => {
      setState({ actionType: "mouseMove", mouseX: x, mouseY: y });
    },
    []
  );

  const setMouseClickAction = useCallback<ActionSetters["setMouseClickAction"]>(
    (x, y, button, clickCount) => {
      setState({
        actionType: "mouseClick",
        mouseX: x,
        mouseY: y,
        mouseButton: button,
        clickCount,
      });
    },
    []
  );

  const setCursorSaveAction = useCallback<
    ActionSetters["setCursorSaveAction"]
  >(() => {
    setState({ actionType: "cursorSave" });
  }, []);

  const setCursorRestoreAction = useCallback<
    ActionSetters["setCursorRestoreAction"]
  >(() => {
    setState({ actionType: "cursorRestore" });
  }, []);

  const setMacroAction = useCallback<ActionSetters["setMacroAction"]>(
    (macroId) => {
      setState({ actionType: "macro", macroId });
    },
    []
  );

  const setDelayAction = useCallback<ActionSetters["setDelayAction"]>(
    (delayMs) => {
      setState({ actionType: "delay", delayActionMs: delayMs });
    },
    []
  );

  const setNoneAction = useCallback<ActionSetters["setNoneAction"]>(() => {
    setState({ actionType: "none" });
  }, []);

  const actionSetters: ActionSetters = {
    setRemapAction,
    setLayerAction,
    setMouseMoveAction,
    setMouseClickAction,
    setCursorSaveAction,
    setCursorRestoreAction,
    setMacroAction,
    setDelayAction,
    setNoneAction,
  };

  const getAction = useCallback<UseBindingConfigReturn["getAction"]>(
    () => convertBindingStateToAction(state),
    [state]
  );

  const handleSave = useCallback(() => {
    const action = getAction();
    onSave(action);
  }, [getAction, onSave]);

  const handleRemove = onRemove;

  return {
    state,
    isLoading,
    actionSetters,
    getAction,
    loadBinding,
    handleSave,
    handleRemove,
    existingTiming,
  };
}
