import { VK } from "@shared/constants/vk";
import type {
  Action,
  ActionType,
  Layer,
  RemapAction,
  TriggerType,
} from "@shared/types/remapConfig";
import { objectiveSwitch } from "@shared/utils/objectiveSwitch";
import { ArrowRight } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/atoms/Button";
import { Icon } from "@/components/atoms/Icon";
import { Show } from "@/components/control/Show";
import { KeyDisplay } from "@/components/molecules/display/KeyDisplay";
import { TriggerTabs } from "@/components/molecules/forms/TriggerTabs";
import { ActionSettingsSection } from "@/components/organisms/editor/ActionSettingsSection";

// キーエディタUI制御関連
export interface KeyEditorUIHandlers {
  setIsInputFocused: (focused: boolean) => void;
}

// マウス座標の状態
export interface MousePosition {
  x: number;
  y: number;
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

import { TimingSettingsSection } from "@/components/organisms/editor/TimingSettingsSection";
import { HStack, VStack } from "@/components/template/Flex";
import { useEventHandler } from "@/hooks/useEventHandler";
import type { UseKeyEditorActionsReturn } from "@/hooks/useKeyEditorAction";
import { useKeyHoldAction } from "@/hooks/useKeyHoldAction";
import { useMousePosition } from "@/hooks/useMousePosition";
import type { LayoutType } from "@/types";

const MOUSE_CAPTURE_COUNTDOWN_START = 3;
const COUNTDOWN_INTERVAL_MS = 1000;
const DEFAULT_CURSOR_RETURN_DELAY_MS = 1000;
const DEFAULT_REPEAT_DELAY_MS = 500;
const DEFAULT_REPEAT_INTERVAL_MS = 100;
const DEFAULT_DELAY_MS = 500;

export interface UnifiedActionEditorProps {
  // 初期状態
  initialAction?: Action;
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
  onCancel: () => void;
  onRemove?: () => void; // 削除ボタン表示用
  onOpenMacros?: () => void;

  // Timing Config (Optional - mainly for KeyRemapper)
  existingTiming?: {
    holdThresholdMs?: number;
    tapIntervalMs?: number;
  };
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Logic consolidated for Unified Editor
export function UnifiedActionEditor({
  initialAction,
  initialTrigger = "tap",
  layers,
  layout,
  targetVk,
  currentMacroId,
  onSave,
  onCancel,
  onRemove,
  onOpenMacros,
  existingTiming,
}: UnifiedActionEditorProps) {
  // === UI State ===
  const [selectedTrigger, setSelectedTrigger] =
    useState<TriggerType>(initialTrigger);
  const [_isInputFocused, setIsInputFocused] = useState(false);

  // === Action State (managed via useBindingConfig for KeyRemapper logic availability) ===
  // Note: Even for macro editing, we can reuse some state logic or manually manage it.
  // Ideally useBindingConfig is tied to remapping state. For macros, we might need manual state if we don't want to pollute global store.
  // However, UnifiedActionEditor is designed to handle both.

  // Let's use manual state management for typical action properties to keep it simple and unified
  // unless we strictly need valid bindings from store.

  const [actionType, setActionType] = useState<ActionType>(
    initialAction?.type ?? "remap"
  );
  const [selectedLayerId, setSelectedLayerId] = useState<string>(
    (initialAction && "layerId" in initialAction
      ? initialAction.layerId
      : undefined) ??
      layers[0]?.id ??
      ""
  );
  const [targetKeys, setTargetKeys] = useState<number[]>(
    initialAction?.type === "remap" ? initialAction.keys : []
  );
  const [macroId, setMacroId] = useState<string>(
    initialAction?.type === "macro" ? initialAction.macroId : ""
  );
  const [delayActionMs, setDelayActionMs] = useState<number>(
    initialAction?.type === "delay" ? initialAction.delayMs : DEFAULT_DELAY_MS
  );

  // Mouse State
  const [mouseX, setMouseX] = useState<number>(
    initialAction && "x" in initialAction ? initialAction.x : 0
  );
  const [mouseY, setMouseY] = useState<number>(
    initialAction && "y" in initialAction ? initialAction.y : 0
  );
  const [mouseButton, setMouseButton] = useState<"left" | "right" | "middle">(
    initialAction?.type === "mouseClick" ? initialAction.button : "left"
  );
  const [clickCount, setClickCount] = useState<number>(
    initialAction?.type === "mouseClick" ? (initialAction.clickCount ?? 1) : 1
  );
  const [cursorReturnDelayMs, setCursorReturnDelayMs] = useState<number>(
    initialAction?.type === "cursorReturn"
      ? initialAction.delayMs
      : DEFAULT_CURSOR_RETURN_DELAY_MS
  );

  // Mouse Capture
  const [isCapturing, setIsCapturing] = useState(false);
  const [countdown, setCountdown] = useState(0);

  // Repeat Settings
  const [repeat, setRepeat] = useState(
    initialAction?.type === "remap" ? (initialAction.repeat ?? false) : false
  );
  const [repeatDelayMs, setRepeatDelayMs] = useState<number | undefined>(
    initialAction?.type === "remap"
      ? initialAction.repeatDelayMs
      : DEFAULT_REPEAT_DELAY_MS
  );
  const [repeatIntervalMs, setRepeatIntervalMs] = useState<number | undefined>(
    initialAction?.type === "remap"
      ? initialAction.repeatIntervalMs
      : DEFAULT_REPEAT_INTERVAL_MS
  );

  // Timing Settings
  const [holdThresholdMs, setHoldThresholdMs] = useState<number | undefined>(
    existingTiming?.holdThresholdMs
  );
  const [tapIntervalMs, setTapIntervalMs] = useState<number | undefined>(
    existingTiming?.tapIntervalMs
  );

  // Update effect for initialAction changes if props change dynamically
  useEffect(() => {
    if (initialAction) {
      setActionType(initialAction.type);
      setTargetKeys(initialAction.type === "remap" ? initialAction.keys : []);
      // ... apply other properties if needed for re-initialization
      // skipping exhaustive mapping for brevity, assuming initial render handles most
    }
  }, [initialAction]);

  // === Logic / Handlers ===

  const addTargetKey = useCallback((vk: number) => {
    setTargetKeys((prev) => (prev.includes(vk) ? prev : [...prev, vk]));
  }, []);

  /* Enter Key Handling (Unified Logic) */
  const handleSaveInternal = () => {
    const action = objectiveSwitch<ActionType, Action>(
      {
        remap: () => ({
          type: "remap",
          keys: targetKeys,
          repeat,
          repeatDelayMs,
          repeatIntervalMs,
        }),
        layerToggle: () => ({ type: "layerToggle", layerId: selectedLayerId }),
        layerMomentary: () => ({
          type: "layerMomentary",
          layerId: selectedLayerId,
        }),
        mouseMove: () => ({ type: "mouseMove", x: mouseX, y: mouseY }),
        mouseClick: () => ({
          type: "mouseClick",
          x: mouseX,
          y: mouseY,
          button: mouseButton,
          clickCount,
        }),
        cursorReturn: () => ({
          type: "cursorReturn",
          delayMs: cursorReturnDelayMs,
        }),
        delay: () => ({ type: "delay", delayMs: delayActionMs }),
        macro: () => ({ type: "macro", macroId }),
        none: () => ({ type: "none" }),
      },
      actionType
    );

    const timing = targetVk
      ? { hold: holdThresholdMs, doubleTap: tapIntervalMs }
      : undefined;
    onSave(action, timing, selectedTrigger);
  };

  const { handleHoldKeyDown, handleHoldKeyUp } = useKeyHoldAction({
    targetKey: VK.ENTER,
    holdMs: 800,
  });

  useEventHandler(
    [
      {
        type: "keydown",
        handler: (e) => {
          // ここで KeyEditorForm のように全キーキャプチャはしない
          // Enter の長押しのみ監視
          handleHoldKeyDown(e.keyCode, {
            onHold: handleSaveInternal,
          });
        },
      },
      {
        type: "keyup",
        handler: (e) => {
          handleHoldKeyUp(e.keyCode, {
            onTap: () => {
              if (actionType === "remap") {
                addTargetKey(VK.ENTER);
              }
            },
            onHold: handleSaveInternal,
          });
        },
      },
    ],
    [
      actionType,
      addTargetKey,
      handleHoldKeyDown,
      handleHoldKeyUp,
      handleSaveInternal,
    ],
    { enabled: !_isInputFocused }
  );

  // Mouse Position Capture
  const { getCursorPosition } = useMousePosition();
  const handleGetMousePosition = (): void => {
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
  };

  // Helper Objects
  const mouseHandlers: MouseHandlers = {
    setMouseX,
    setMouseY,
    setMouseButton,
    setClickCount,
    setCursorReturnDelayMs,
    onGetMousePosition: handleGetMousePosition,
  };

  const mouseState: MouseState = {
    x: mouseX,
    y: mouseY,
    button: mouseButton,
    clickCount,
    isCapturing,
    countdown,
    cursorReturnDelayMs,
  };

  const repeatSettings: RepeatSettings = {
    repeat,
    repeatDelayMs,
    repeatIntervalMs,
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

  const keyEditorUIHandlers: KeyEditorUIHandlers = { setIsInputFocused };

  const keyEditorActions: UseKeyEditorActionsReturn = {
    handleSave: handleSaveInternal,
    handleRemove: onRemove,
    canSave: actionType !== "none",
    keys: targetKeys,
    setKeys: setTargetKeys,
    reset: () => setTargetKeys([]),
    holds: [],
    removeKey: (vk) => setTargetKeys((prev) => prev.filter((k) => k !== vk)),
    addHoldKey: addTargetKey,
    removeHoldKey: () => {
      /* no-op */
    },
  };

  // === Render ===
  return (
    <VStack
      className={targetVk ? "px-6" : "h-full min-h-[400px] p-6"}
      // biome-ignore lint/style/noMagicNumbers: UIなのでいったん無視する
      gap={targetVk ? 4 : 6}
    >
      <Show condition={!!targetVk}>
        <div className="flex items-center justify-center gap-4 font-bold text-2xl">
          <KeyDisplay layout={layout} vkCode={targetVk || 0} />
          <Show condition={targetKeys.length > 0}>
            <Icon icon={ArrowRight} size="md" />
            {targetKeys.map((vk) => (
              <KeyDisplay
                key={vk}
                layout={layout}
                variant="primary"
                vkCode={vk}
              />
            ))}
          </Show>
        </div>
      </Show>
      <Show condition={!targetVk}>
        <h2 className="border-b pb-2 font-bold text-xl">アクションの編集</h2>
      </Show>

      {targetVk ? (
        <TriggerTabs
          gap={4}
          onTriggerChange={(t) => setSelectedTrigger(t)}
          selectedTrigger={selectedTrigger}
        >
          <ActionSettingsSection
            actionType={actionType}
            currentMacroId={currentMacroId}
            delayActionMs={delayActionMs}
            keyEditorActions={keyEditorActions}
            keyEditorUIHandlers={keyEditorUIHandlers}
            layers={layers}
            layout={layout}
            macroId={macroId}
            mouseHandlers={mouseHandlers}
            mouseState={mouseState}
            onOpenMacros={onOpenMacros}
            repeatSettings={repeatSettings}
            selectedLayerId={selectedLayerId}
            selectedTrigger={selectedTrigger}
            setActionType={setActionType}
            setDelayActionMs={setDelayActionMs}
            setMacroId={setMacroId}
            setSelectedLayerId={setSelectedLayerId}
            targetVk={targetVk || 0}
          />
          <TimingSettingsSection
            defaultHoldThresholdMs={200} // TODO: Pass defaults
            defaultTapIntervalMs={300} // TODO: Pass defaults
            holdThresholdMs={holdThresholdMs}
            selectedTrigger={selectedTrigger}
            setHoldThresholdMs={setHoldThresholdMs}
            setIsInputFocused={setIsInputFocused}
            setTapIntervalMs={setTapIntervalMs}
            tapIntervalMs={tapIntervalMs}
          />
        </TriggerTabs>
      ) : (
        <div className="flex-1 overflow-auto">
          <ActionSettingsSection
            actionType={actionType}
            currentMacroId={currentMacroId}
            delayActionMs={delayActionMs}
            keyEditorActions={keyEditorActions}
            keyEditorUIHandlers={keyEditorUIHandlers}
            layers={layers}
            layout={layout}
            macroId={macroId}
            mouseHandlers={mouseHandlers}
            mouseState={mouseState}
            onOpenMacros={onOpenMacros}
            repeatSettings={repeatSettings}
            selectedLayerId={selectedLayerId}
            selectedTrigger="tap"
            setActionType={setActionType}
            setDelayActionMs={setDelayActionMs}
            setMacroId={setMacroId}
            setSelectedLayerId={setSelectedLayerId}
            targetVk={0}
          />
        </div>
      )}

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
          <Button onClick={onCancel} variant="ghost">
            キャンセル
          </Button>
        </Show>
        <Button
          disabled={actionType === "none"}
          label={targetVk ? "保存" : "決定"}
          onClick={handleSaveInternal}
          size="default"
          variant="default"
        />
      </HStack>
    </VStack>
  );
}
