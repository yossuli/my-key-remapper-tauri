import { ArrowRight } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/atoms/Button";
import { Icon } from "@/components/atoms/Icon";
import { Mapped } from "@/components/control/Mapped";
import { Show } from "@/components/control/Show";
import { KeyDisplay } from "@/components/molecules/display/KeyDisplay";
import { TriggerTabs } from "@/components/molecules/forms/TriggerTabs";
import { ActionSettingsSection } from "@/components/organisms/editor/ActionSettingsSection";
import { TimingSettingsSection } from "@/components/organisms/editor/TimingSettingsSection";
import { HStack, VStack } from "@/components/template/Flex";
import { VK } from "@/constants/vk";
import { useBindingConfig } from "@/hooks/ui/useBindingConfig";
import { useKeyHoldAction } from "@/hooks/ui/useKeyHoldAction";
import {
  type BindingState,
  createBindingStateFromAction,
} from "@/models/bindingStateModel";
import type { LayoutType } from "@/types";
import type { Action, Layer, TriggerType } from "@/types/remapConfig";

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
    timing?: {
      hold?: number;
      doubleTap?: number;
      interruptBehavior?: "forceTap" | "forceHold" | "ignore";
    },
    trigger?: TriggerType
  ) => void;
  handleEditorClose: () => void;
  onRemove?: () => void; // 削除ボタン表示用
  onOpenMacros?: () => void;

  // Timing Config (Optional - mainly for KeyRemapper)
  existingTiming?: {
    holdThresholdMs?: number;
    tapIntervalMs?: number;
    interruptBehavior?: "forceTap" | "forceHold" | "ignore";
  };
}

const GAP_COMPACT = 4;
const GAP_DEFAULT = 6;

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
  const [selectedTrigger, setSelectedTrigger] =
    useState<TriggerType>(initialTrigger);

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
  const [localInterruptBehavior, setLocalInterruptBehavior] = useState<
    "forceTap" | "forceHold" | "ignore" | undefined
  >(undefined);

  const handleSaveInternal = useCallback(
    (action: Action) => {
      const timing = targetVk
        ? {
            hold: localHoldThresholdMs,
            doubleTap: localTapIntervalMs,
            interruptBehavior: localInterruptBehavior,
          }
        : undefined;
      onSave(action, timing, selectedTrigger);
      handleEditorClose?.();
    },
    [
      targetVk,
      localHoldThresholdMs,
      localTapIntervalMs,
      localInterruptBehavior,
      onSave,
      selectedTrigger,
      handleEditorClose,
    ]
  );

  // UIローカル状態
  const [isInputFocused, setIsInputFocused] = useState(false);

  // 3. useBindingConfig の呼び出し (initialState, handleSaveInternal に依存)
  const {
    state,
    isLoading,
    existingTiming: fetchedTiming,
    actionSetters,
    handleSave,
  } = useBindingConfig({
    targetVk,
    layerId,
    trigger: selectedTrigger,
    initialState,
    onSave: handleSaveInternal,
    onRemove,
  });

  // 🌟 エンター長押し保存ロジック 🌟
  const { handleHoldKeyDown, handleHoldKeyUp } = useKeyHoldAction({
    targetKey: VK.ENTER,
    holdMs: 600, // UX的に600ms程度が適当
  });

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (isInputFocused) {
      return;
    }

    // getVkCode の代わりに簡易的に e.keyCode を渡すか、VK.ENTER を期待するか
    // ここでは key が Enter なら VK.ENTER を渡すようにする。
    const vkCode = e.key === "Enter" ? VK.ENTER : e.keyCode;

    handleHoldKeyDown(vkCode, {
      onHold: () => {
        console.log("[DEBUG] エンター長押し完了。モーダルを保存して閉じます。");
        handleSave();
      },
    });
  };

  const onKeyUp = (e: React.KeyboardEvent) => {
    if (isInputFocused) {
      return;
    }
    const vkCode = e.key === "Enter" ? VK.ENTER : e.keyCode;
    handleHoldKeyUp(vkCode, {});
  };

  const handleTriggerChange = useCallback((trigger: TriggerType) => {
    setSelectedTrigger(trigger);
  }, []);

  const vstackRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (vstackRef.current) {
      vstackRef.current.focus();
    }
  }, []);

  useEffect(() => {
    setLocalHoldThresholdMs(
      fetchedTiming.holdThresholdMs ?? existingTimingProp?.holdThresholdMs
    );
    setLocalTapIntervalMs(
      fetchedTiming.tapIntervalMs ?? existingTimingProp?.tapIntervalMs
    );
    setLocalInterruptBehavior(
      fetchedTiming.interruptBehavior ?? existingTimingProp?.interruptBehavior
    );
  }, [fetchedTiming, existingTimingProp]);

  const targetKeys = state.actionType === "remap" ? state.targetKeys : null;

  if (isLoading) {
    return (
      <VStack className="h-full items-center justify-center" gap={4}>
        <div className="h-8 w-8 animate-spin rounded-full border-primary border-b-2" />
        <p className="text-muted-foreground text-sm">読み込み中...</p>
      </VStack>
    );
  }

  const { actionType } = state;
  const containerClassName =
    targetVk !== undefined
      ? "px-6 focus:outline-none"
      : "h-full min-h-[400px] p-6 focus:outline-none";
  const gap = targetVk !== undefined ? GAP_COMPACT : GAP_DEFAULT;

  console.log(
    `[UnifiedActionEditor] Rendering: targetVk=${targetVk}, layerId=${layerId}, trigger=${selectedTrigger}, actionType=${actionType}`
  );

  return (
    <VStack
      className={containerClassName}
      gap={gap}
      onKeyDown={onKeyDown}
      onKeyUp={onKeyUp}
      ref={vstackRef}
      tabIndex={0}
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
          actionSetters={actionSetters}
          currentMacroId={currentMacroId}
          isInputFocused={isInputFocused}
          layers={layers}
          layout={layout}
          onOpenMacros={onOpenMacros}
          selectedTrigger={selectedTrigger}
          setIsInputFocused={setIsInputFocused}
          state={state}
          targetVk={targetVk || 0}
        />
        <TimingSettingsSection
          defaultHoldThresholdMs={200}
          defaultTapIntervalMs={300}
          holdThresholdMs={localHoldThresholdMs}
          interruptBehavior={localInterruptBehavior}
          selectedTrigger={selectedTrigger}
          setHoldThresholdMs={setLocalHoldThresholdMs}
          setInterruptBehavior={setLocalInterruptBehavior}
          setIsInputFocused={setIsInputFocused}
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
          label={targetVk ? "保存 (Enter長押し)" : "決定 (Enter長押し)"}
          onClick={handleSave}
          size="default"
          variant="default"
        />
      </HStack>
    </VStack>
  );
}
