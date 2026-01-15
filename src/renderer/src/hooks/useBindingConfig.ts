// バインディング設定読み込みフック

import type { ActionType, TriggerType } from "@shared/types/remapConfig";
import { useCallback, useEffect, useState } from "react";
import { useGetMappings } from "@/hooks/useInvoke";
import {
  actionToBindingState,
  type BindingState,
  createInitialBindingState,
} from "@/models/BindingState";

const DEFAULT_REPEAT_DELAY_MS = 500;
const DEFAULT_REPEAT_INTERVAL_MS = 100;
const DEFAULT_DELAY_MS = 500;
const DEFAULT_CURSOR_RETURN_DELAY_MS = 1000;

export interface UseBindingConfigProps {
  targetVk: number;
  layerId: string;
  defaultLayerId: string;
}

export interface UseBindingConfigReturn {
  state: BindingState;
  existingTiming: {
    holdThresholdMs: number | undefined;
    tapIntervalMs: number | undefined;
  };
  setActionType: (actionType: ActionType) => void;
  setTargetKeys: (targetKeys: number[]) => void;
  addTargetKey: (keyCode: number) => void;
  clearTargetKeys: () => void;
  setSelectedLayerId: (selectedLayerId: string) => void;
  setDelayActionMs: (delayActionMs: number) => void;
  loadBindingForTrigger: (trigger: TriggerType) => Promise<void>;
}

/**
 * アクションタイプ切り替え時の初期状態を生成（Union型対応）
 */
function getInitialStateForType(
  type: ActionType,
  base: BindingState
): BindingState {
  const common = {
    targetKeys: base.targetKeys,
    selectedLayerId: base.selectedLayerId,
    hasExistingBinding: base.hasExistingBinding,
  };

  switch (type) {
    case "remap":
      return {
        ...common,
        actionType: "remap",
        repeat: false,
        repeatDelayMs: DEFAULT_REPEAT_DELAY_MS,
        repeatIntervalMs: DEFAULT_REPEAT_INTERVAL_MS,
      };
    case "layerToggle":
      return { ...common, actionType: "layerToggle" };
    case "layerMomentary":
      return { ...common, actionType: "layerMomentary" };
    case "mouseMove":
      return {
        ...common,
        // 既存の mouseX が型ガードで取れれば引き継ぐこともできるが、
        // 単純化のため初期値
        actionType: "mouseMove",
        mouseX: 0,
        mouseY: 0,
      };
    case "mouseClick":
      return {
        ...common,
        actionType: "mouseClick",
        mouseX: 0,
        mouseY: 0,
        mouseButton: "left",
        clickCount: 1,
      };
    case "cursorReturn":
      return {
        ...common,
        actionType: "cursorReturn",
        cursorReturnDelayMs: DEFAULT_CURSOR_RETURN_DELAY_MS,
      };
    case "delay":
      return {
        ...common,
        actionType: "delay",
        delayActionMs: DEFAULT_DELAY_MS,
      };
    case "macro":
      return { ...common, actionType: "macro", macroId: "" };
    case "none":
      return { ...common, actionType: "none" };
    default:
      return { ...common, actionType: "none" };
  }
}

/**
 * 特定キーのバインディング設定を読み込むフック
 */
export function useBindingConfig({
  targetVk,
  layerId,
  defaultLayerId,
}: UseBindingConfigProps): UseBindingConfigReturn {
  const getMappings = useGetMappings();
  const [state, setState] = useState<BindingState>(() =>
    createInitialBindingState(defaultLayerId)
  );

  const [existingTiming, setExistingTiming] = useState<{
    holdThresholdMs: number | undefined;
    tapIntervalMs: number | undefined;
  }>({ holdThresholdMs: undefined, tapIntervalMs: undefined });

  // バインディングとタイミング設定を一度に取得
  const fetchBindings = useCallback(async () => {
    const allLayers = await getMappings();
    if (!allLayers) {
      return;
    }
    const layer = allLayers.layers.find((l) => l.id === layerId);
    return layer?.bindings[targetVk];
  }, [getMappings, layerId, targetVk]);

  // トリガー変更時にバインディングとタイミングを読み込み
  const loadBindingForTrigger = useCallback<
    UseBindingConfigReturn["loadBindingForTrigger"]
  >(
    async (trigger) => {
      // 状態をリセット
      const initialState = createInitialBindingState(defaultLayerId);

      const bindings = await fetchBindings();
      const binding = bindings?.find((b) => b.trigger === trigger);

      if (binding) {
        // actionToBindingState は Partial<BindingState> を返すため
        // discriminated union に適合するようにマージする必要がある
        // ここでは actionType を見て適切な初期状態を作り、そこにマージする
        const partial = actionToBindingState(binding.action);

        if (partial.actionType) {
          const base = getInitialStateForType(partial.actionType, initialState);
          // Partialの中身を強制的にマージ（型アサーションが必要な場合があるが、
          // getInitialStateForType で構造を作っているので展開で通るはず）
          setState({
            ...base,
            ...partial,
            hasExistingBinding: true,
          } as BindingState);
        } else {
          // actionTypeがない（異常系）
          setState(initialState);
        }
      } else {
        setState(initialState);
      }

      // タイミング設定を更新
      const holdTiming = bindings?.find((b) => b.trigger === "hold")?.timingMs;
      const doubleTapTiming = bindings?.find(
        (b) => b.trigger === "doubleTap"
      )?.timingMs;

      setExistingTiming({
        holdThresholdMs: holdTiming,
        tapIntervalMs: doubleTapTiming,
      });
    },
    [fetchBindings, defaultLayerId]
  );

  // 初期読み込み（マウント時に一度だけ実行）
  useEffect(() => {
    loadBindingForTrigger("tap");
  }, [loadBindingForTrigger]);

  // 状態セッター
  const setActionType = useCallback<UseBindingConfigReturn["setActionType"]>(
    (actionType) => {
      setState((prev) => getInitialStateForType(actionType, prev));
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
      setState((prev) => ({
        ...prev,
        targetKeys: prev.targetKeys.includes(keyCode)
          ? prev.targetKeys
          : [...prev.targetKeys, keyCode],
      }));
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

  return {
    state,
    existingTiming,
    setActionType,
    setTargetKeys,
    addTargetKey,
    clearTargetKeys,
    setSelectedLayerId,
    setDelayActionMs,
    loadBindingForTrigger,
  };
}
