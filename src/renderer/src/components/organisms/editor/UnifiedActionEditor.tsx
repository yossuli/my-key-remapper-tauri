import { VK } from "@shared/constants/vk";
import type { Action, Layer, TriggerType } from "@shared/types/remapConfig";
import { ArrowRight } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/atoms/Button";
import { Icon } from "@/components/atoms/Icon";
import { Mapped } from "@/components/control/Mapped";
import { Show } from "@/components/control/Show";
import { KeyDisplay } from "@/components/molecules/display/KeyDisplay";
import { TriggerTabs } from "@/components/molecules/forms/TriggerTabs";
import { ActionSettingsSection } from "@/components/organisms/editor/ActionSettingsSection";
import { TimingSettingsSection } from "@/components/organisms/editor/TimingSettingsSection";
import { HStack, VStack } from "@/components/template/Flex";
import { useBindingConfig } from "@/hooks/useBindingConfig";
import { useEventHandler } from "@/hooks/useEventHandler";
import { useKeyHoldAction } from "@/hooks/useKeyHoldAction";
import {
  type BindingState,
  createBindingStateFromAction,
} from "@/models/BindingState";
import type { LayoutType } from "@/types";

export interface UnifiedActionEditorProps {
  // 初期状態
  initialAction?: Action;
  initialBindingState?: BindingState;
  initialTrigger?: TriggerType;

  // コンテキスト
  layers: Layer[];
  layout: LayoutType;

  // 編集モード判定用 (KeyRemapper specific)
  targetVk?: number; // 指定された場合、キーリマップ編集モードとして振る舞う（タイミング設定などを表示）
  layerId?: string; // KeyRemapperモードで必要

  // マクロ編集用 (Macro specific)
  currentMacroId?: string; // 循環参照防止用

  // ハンドラー
  onSave: (
    action: Action,
    timing?: { hold?: number; doubleTap?: number },
    trigger?: TriggerType
  ) => void;
  handleEditorClose: () => void;
  onRemove?: () => void; // 削除ボタン表示用
  onOpenMacros?: () => void;

  // Timing Config (Optional - mainly for KeyRemapper)
  existingTiming?: {
    holdThresholdMs?: number;
    tapIntervalMs?: number;
  };
}

export function UnifiedActionEditor({
  initialAction,
  initialBindingState, // May be passed directly if no targetVk/layerId or prefetched
  initialTrigger = "tap",
  layers,
  layout,
  targetVk,
  layerId,
  currentMacroId,
  onSave,
  handleEditorClose,
  onRemove,
  onOpenMacros,
  existingTiming: existingTimingProp,
}: UnifiedActionEditorProps) {
  // === UI State ===
  const [selectedTrigger, setSelectedTrigger] =
    useState<TriggerType>(initialTrigger);

  // 1. initialState の計算 (依存なし)
  const initialState = useMemo(() => {
    if (initialBindingState) {
      return initialBindingState;
    }
    if (initialAction) {
      return createBindingStateFromAction(initialAction);
    }
    return;
  }, [initialBindingState, initialAction]);

  const [localHoldThresholdMs, setLocalHoldThresholdMs] = useState<
    number | undefined
  >(undefined);
  const [localTapIntervalMs, setLocalTapIntervalMs] = useState<
    number | undefined
  >(undefined);

  // 2. handleSaveInternal の定義 (state 依存なし)
  const handleSaveInternal = useCallback(
    (action: Action) => {
      const timing = targetVk
        ? { hold: localHoldThresholdMs, doubleTap: localTapIntervalMs }
        : undefined;
      onSave(action, timing, selectedTrigger);
      handleEditorClose?.();
    },
    [
      targetVk,
      localHoldThresholdMs,
      localTapIntervalMs,
      onSave,
      selectedTrigger,
      handleEditorClose,
    ]
  );

  // 3. useBindingConfig の呼び出し (initialState, handleSaveInternal に依存)
  const {
    state,
    existingTiming: fetchedTiming,
    handleSave,
    addTargetKey,
    isInputFocused,
    isRecording,
    keyEditorUIHandlers,
    ...bindingActions
  } = useBindingConfig({
    targetVk,
    layerId,
    defaultLayerId: layers[0]?.id || "",
    initialState,
    selectedTrigger,
    onSave: handleSaveInternal,
    onRemove,
  });

  // マウント時のみ初期ロード
  useEffect(() => {
    if (targetVk !== undefined) {
      bindingActions.loadBindingForTrigger(initialTrigger);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleTriggerChange = useCallback(
    (trigger: TriggerType) => {
      setSelectedTrigger(trigger);
      if (targetVk !== undefined) {
        bindingActions.loadBindingForTrigger(trigger);
      }
    },
    [bindingActions.loadBindingForTrigger, targetVk]
  );



  useEffect(() => {
    setLocalHoldThresholdMs(
      fetchedTiming.holdThresholdMs ?? existingTimingProp?.holdThresholdMs
    );
    setLocalTapIntervalMs(
      fetchedTiming.tapIntervalMs ?? existingTimingProp?.tapIntervalMs
    );
  }, [fetchedTiming]);

  const { actionType } = state;

  // === Event Handlers ===
  const { handleHoldKeyDown, handleHoldKeyUp } = useKeyHoldAction({
    targetKey: VK.ENTER,
    holdMs: 500, // UX改善: 800ms -> 500ms
  });

  const eventHandlers = useMemo(
    () => [
      {
        type: "keydown" as const,
        handler: (e: KeyboardEvent) => {
          if (e.keyCode === VK.ENTER && !isRecording) {
            // ブラウザのデフォルト挙動を抑止（これが保存できない原因だった可能性大）
            e.preventDefault();
            e.stopPropagation();
            handleHoldKeyDown(e.keyCode, {
              onHold: handleSave,
            });
          }
        },
      },
      {
        type: "keyup" as const,
        handler: (e: KeyboardEvent) => {
          if (e.keyCode === VK.ENTER && !isRecording) {
            e.preventDefault();
            e.stopPropagation();
            handleHoldKeyUp(e.keyCode, {
              onTap: () => state.actionType === "remap" && addTargetKey(VK.ENTER),
              onHold: handleSave,
            });
          }
        },
      },
    ],
    [
      handleHoldKeyDown,
      handleHoldKeyUp,
      handleSave,
      state.actionType,
      addTargetKey,
      isRecording,
    ]
  );

  useEventHandler(eventHandlers, [eventHandlers], { enabled: !isRecording });

  const targetKeys = state.actionType === "remap" ? state.targetKeys : null;

  return (
    <VStack
      className={targetVk ? "px-6" : "h-full min-h-[400px] p-6"}
      // biome-ignore lint/style/noMagicNumbers: UIなのでいったん無視する
      gap={targetVk ? 4 : 6}
    >
      <Show condition={!!targetVk}>
        <div className="flex items-center justify-center gap-4 font-bold text-2xl">
          <KeyDisplay layout={layout} vkCode={targetVk || 0} />
          <Show condition={!!targetKeys && targetKeys.length > 0}>
            <Icon icon={ArrowRight} size="md" />
            <Mapped value={(targetKeys || []).map((vk) => ({ id: vk }))}>
              {({ id: vk }) => (
                <KeyDisplay
                  key={vk}
                  layout={layout}
                  variant="primary"
                  vkCode={vk}
                />
              )}
            </Mapped>
          </Show>
        </div>
      </Show>
      <Show condition={!targetVk}>
        <h2 className="border-b pb-2 font-bold text-xl">アクションの編集</h2>
      </Show>

      <TriggerTabs
        gap={4}
        onTriggerChange={handleTriggerChange}
        selectedTrigger={selectedTrigger}
      >
        <ActionSettingsSection
          bindingActions={{ ...bindingActions, addTargetKey, handleSave }}
          currentMacroId={currentMacroId}
          isInputFocused={isInputFocused}
          isRecording={isRecording}
          keyEditorUIHandlers={keyEditorUIHandlers}
          layers={layers}
          layout={layout}
          onOpenMacros={onOpenMacros}
          selectedTrigger={selectedTrigger}
          state={state}
          targetVk={targetVk || 0}
        />
        <TimingSettingsSection
          defaultHoldThresholdMs={200} // TODO: Pass defaults
          defaultTapIntervalMs={300} // TODO: Pass defaults
          holdThresholdMs={localHoldThresholdMs}
          selectedTrigger={selectedTrigger}
          setHoldThresholdMs={setLocalHoldThresholdMs}
          setIsInputFocused={keyEditorUIHandlers.setIsInputFocused}
          setTapIntervalMs={setLocalTapIntervalMs}
          tapIntervalMs={localTapIntervalMs}
        />
      </TriggerTabs>
      <HStack
        className={targetVk ? "justify-end" : "justify-end border-t pt-4"}
        gap={2}
      >
        <Show condition={!!onRemove && !!targetVk}>
          <Button
            label="削除"
            onClick={onRemove}
            size="default"
            variant="destructive"
          />
        </Show>
        <Show condition={!targetVk}>
          <Button
            label="キャンセル"
            onClick={handleEditorClose}
            variant="ghost"
          />
        </Show>
        <Button
          disabled={actionType === "none"}
          label={targetVk ? "保存" : "決定"}
          onClick={handleSave}
          size="default"
          variant="default"
        />
      </HStack>
    </VStack>
  );
}
