// 保存・削除アクションのフック

import type { Action, TriggerType } from "@shared/types/remapConfig";
import { useCallback, useMemo, useState } from "react";
import {
  type BindingState,
  convertBindingStateToAction,
} from "@/models/BindingState";

export interface UseKeyEditorActionsProps {
  state: BindingState;
  layerId: string;
  targetVk: number | null;
  selectedTrigger: TriggerType;
  onSave: (trigger: TriggerType, action: Action) => void;
  onRemove?: (trigger: TriggerType) => void;
  onClose?: () => void;
  onClearTargetKeys?: () => void;
}

export interface UseKeyEditorActionsReturn {
  // 基本状態
  keys: number[];
  holds: number[]; // 互換性のために保持（現在は主に useQuickRemap で使用）
  canSave: boolean;

  // 基本操作
  setKeys: (keys: number[]) => void;
  removeKey: (vk: number) => void;
  reset: () => void;
  handleSave: () => void;
  handleRemove?: () => void; // Updated to optional per refactor

  addHoldKey: (vk: number) => void;
  removeHoldKey: (vk: number) => void;
}

/**
 * キーエディターの保存・削除アクションフック
 */
export function useKeyEditorActions({
  state,
  layerId,
  targetVk,
  selectedTrigger,
  onSave,
  onRemove,
  onClose,
}: UseKeyEditorActionsProps): UseKeyEditorActionsReturn {
  const { actionType } = state;
  // remap 型のみ targetKeys を持つため、型ガード付きで取得
  const targetKeys = state.actionType === "remap" ? state.targetKeys : [];

  console.log("[DEBUG] useKeyEditorActions - render", {
    actionType,
    targetKeys,
    selectedTrigger,
  });
  // 下書き（ドラフト）状態
  const [keys, setKeys] = useState<number[]>(targetKeys);
  // キャプチャ中のキー（互換性用）
  const [holds, setHolds] = useState<number[]>([]);

  // 読み込まれた設定が変わったらリセットする useEffect を削除
  // ユーザーの指示により、イベント駆動で状態を管理するため、
  // 自動的な同期（useEffect）は廃止し、呼び出し側が責任を持って reset または初期化を行う設計とする。

  const _addKey = useCallback((vk: number) => {
    setKeys((prev) => (prev.includes(vk) ? prev : [...prev, vk]));
  }, []);

  const removeKey = useCallback((vk: number) => {
    setKeys((prev) => prev.filter((k) => k !== vk));
  }, []);

  const reset = useCallback(() => {
    setKeys([]);
    setHolds([]);
  }, []);

  // 互換用：ホールド（キャプチャ中）管理としての addKey
  const addHoldKey = useCallback((vk: number) => {
    setHolds((prev) => (prev.includes(vk) ? prev : [...prev, vk]));
    // QuickRemap などではホールドしたキーをそのままターゲットに加える挙動を期待している場合がある
    setKeys((prev) => (prev.includes(vk) ? prev : [...prev, vk]));
  }, []);

  const removeHoldKey = useCallback((vk: number) => {
    setHolds((prev) => prev.filter((k) => k !== vk));
  }, []);

  const canSave = useMemo(
    () =>
      targetVk !== null &&
      !(
        actionType === "remap" &&
        (keys.length === 0 ||
          (keys.length === 1 && layerId === "base" && keys[0] === targetVk))
      ),
    [actionType, keys, targetVk, layerId]
  );

  const handleSave = useCallback<
    UseKeyEditorActionsReturn["handleSave"]
  >(() => {
    if (!canSave) {
      return;
    }

    // remap の場合は最新の keys を合成する
    const currentState =
      state.actionType === "remap" ? { ...state, targetKeys: keys } : state;

    const action = convertBindingStateToAction(currentState);

    onSave(selectedTrigger, action);
    onClose?.();
  }, [state, keys, selectedTrigger, onClose, onSave, canSave]);

  const handleRemove = useCallback(() => {
    onRemove?.(selectedTrigger);
    onClose?.();
  }, [onClose, onRemove, selectedTrigger]);

  return {
    keys,
    holds,
    canSave,
    addHoldKey,
    removeHoldKey,
    removeKey,
    reset,
    handleSave,
    handleRemove,
    setKeys,
  };
}
