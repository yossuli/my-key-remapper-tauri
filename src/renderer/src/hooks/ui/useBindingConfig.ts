import type { Action, TriggerType } from "@shared/types/remapConfig";
import { useCallback, useEffect, useState } from "react";
import { useGetMappings } from "@/hooks/api/useInvoke";
import {
  actionToBindingState,
  type BindingState,
  convertBindingStateToAction,
  createInitialBindingState,
} from "@/models/bindingStateModel";

export const DEFAULT_REPEAT_DELAY_MS = 500;
export const DEFAULT_REPEAT_INTERVAL_MS = 100;

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
  setCursorReturnAction: (delayMs: number) => void;
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
  }>({ holdThresholdMs: undefined, tapIntervalMs: undefined });

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
        } else {
          setState(createInitialBindingState());
        }

        const holdTiming = bindings?.find(
          (b) => b.trigger === "hold"
        )?.timingMs;
        const doubleTapTiming = bindings?.find(
          (b) => b.trigger === "doubleTap"
        )?.timingMs;

        setExistingTiming({
          holdThresholdMs: holdTiming,
          tapIntervalMs: doubleTapTiming,
        });
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

  const setCursorReturnAction = useCallback<
    ActionSetters["setCursorReturnAction"]
  >((delayMs) => {
    setState({ actionType: "cursorReturn", cursorReturnDelayMs: delayMs });
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
    setCursorReturnAction,
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
