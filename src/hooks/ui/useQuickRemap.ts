import { useCallback, useEffect, useMemo, useState } from "react";
import type { UseLayerStateReturn } from "@/hooks/api/useLayerState";
import { useKeyEventInput } from "@/hooks/ui/useKeyEventInput";
import { useKeyEditorActions } from "@/hooks/useKeyEditorAction";
import type { KeyboardLayout } from "@/types";
import type { Action, TriggerType } from "@/types/remapConfig";
import { getNextKeyVk } from "@/utils/getNextKeyVk";

export interface UseQuickRemapOptions {
  enabled: boolean;
  selectedLayerId: string;
  selectedTrigger: TriggerType;
  targetKeys: number[];
  keyboardLayout: KeyboardLayout;

  onSaveMapping: UseLayerStateReturn["saveMapping"];
}

export interface UseQuickRemapReturn {
  editingKey: number | null;
  startEditing: (vk: number) => void;
  cancelEditing: () => void;
}

export function useQuickRemap({
  enabled,
  selectedTrigger,
  onSaveMapping,
  selectedLayerId,
  targetKeys,
  keyboardLayout,
}: UseQuickRemapOptions): UseQuickRemapReturn {
  const [editingKey, setEditingKey] =
    useState<UseQuickRemapReturn["editingKey"]>(null);

  const editorState = useMemo(
    () => ({
      actionType: "remap" as const,
      targetKeys,
    }),
    [targetKeys]
  );

  const handleSaveMapping = useCallback(
    (_trigger: TriggerType, action: Action) => {
      if (editingKey !== null) {
        onSaveMapping(editingKey, selectedTrigger)(action);
      }
    },
    [editingKey, selectedTrigger, onSaveMapping]
  );

  const { canSave, holds, addHoldKey, removeHoldKey, handleSave, reset } =
    useKeyEditorActions({
      state: editorState,
      layerId: selectedLayerId,
      targetVk: editingKey,
      selectedTrigger,
      onSave: handleSaveMapping,
    });

  const startEditing = useCallback<UseQuickRemapReturn["startEditing"]>(
    (vk) => {
      if (!enabled) {
        return;
      }
      setEditingKey(vk);
    },
    [enabled]
  );

  const cancelEditing = useCallback<
    UseQuickRemapReturn["cancelEditing"]
  >(() => {
    setEditingKey(null);
  }, []);

  const handleKeyDown = useCallback(
    (vkCode: number) => {
      addHoldKey(vkCode);
    },
    [addHoldKey]
  );

  const handleKeyUp = useCallback(
    (vkCode: number) => {
      if (holds.length === 1 && holds[0] === vkCode) {
        if (canSave) {
          handleSave();
          reset();
        }
        if (editingKey !== null) {
          const nextVk = getNextKeyVk(keyboardLayout, editingKey);
          setEditingKey(nextVk);
        }
      }

      // キーを除去
      removeHoldKey(vkCode);
    },
    [
      holds,
      canSave,
      handleSave,
      keyboardLayout,
      editingKey,
      removeHoldKey,
      reset,
    ]
  );

  useKeyEventInput({
    enabled: enabled && editingKey !== null,
    onKeyDown: handleKeyDown,
    onKeyUp: handleKeyUp,
  });

  useEffect(() => {
    if (!enabled) {
      setEditingKey(null);
    }
  }, [enabled]);

  return {
    editingKey,
    startEditing,
    cancelEditing,
  };
}
