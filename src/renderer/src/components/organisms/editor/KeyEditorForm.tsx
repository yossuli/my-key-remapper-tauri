import type { Action, Layer, TriggerType } from "@shared/types/remapConfig";
import { useMemo } from "react";
import { UnifiedActionEditor } from "@/components/organisms/editor/UnifiedActionEditor";
import { useBindingConfig } from "@/hooks/useBindingConfig";
import { convertBindingStateToAction } from "@/models/BindingState";
import type { LayoutType } from "@/types";

// キーエディタUI制御関連
export interface KeyEditorUIHandlers {
  setIsInputFocused: (focused: boolean) => void;
}

// ... (skipping to props)

interface KeyEditorFormProps {
  targetVk: number;
  layerId: string;
  layout: LayoutType;
  layers: Layer[];
  trigger: TriggerType;
  onSave: (
    trigger: TriggerType,
    action: Action,
    timing?: number | null
  ) => void;
  onRemove: (trigger: TriggerType) => void;
  onClose: () => void;
  onOpenMacros: () => void;
}

export function KeyEditorForm({
  targetVk,
  layerId,
  layout,
  layers,
  trigger,
  onSave,
  onRemove,
  onClose,
  onOpenMacros,
}: KeyEditorFormProps) {
  const { existingTiming, state } = useBindingConfig({
    targetVk,
    layerId,
    defaultLayerId: layers[0]?.id || "",
  });

  const initialAction: Action = useMemo(
    () => convertBindingStateToAction(state),
    [state]
  );

  // キーリマップモードの場合は、タイミング設定も渡す
  const existingTimingProp = useMemo(
    () => ({
      holdThresholdMs: existingTiming?.holdThresholdMs,
      tapIntervalMs: existingTiming?.tapIntervalMs,
    }),
    [existingTiming]
  );

  return (
    <UnifiedActionEditor
      existingTiming={existingTimingProp}
      initialAction={initialAction}
      initialTrigger={trigger}
      layerId={layerId}
      layers={layers}
      layout={layout}
      onCancel={onClose}
      onOpenMacros={onOpenMacros}
      onRemove={() => onRemove(trigger)}
      onSave={(action, timing, activeTrigger) => {
        // activeTrigger が不明な場合は初期トリガーまたはタップを使用
        const currentTrigger = activeTrigger || trigger;

        // Timing Mapping
        let timingVal: number | undefined | null;
        if (timing) {
          if (currentTrigger === "hold") {
            timingVal = timing.hold;
          } else if (currentTrigger === "doubleTap") {
            timingVal = timing.doubleTap;
          }
        }

        onSave(currentTrigger, action, timingVal);
      }}
      targetVk={targetVk}
    />
  );
}
