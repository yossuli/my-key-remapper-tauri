import type { ActionType, Layer, TriggerType } from "@shared/types/remapConfig";
import { isCircularMacro } from "@shared/utils/macroUtils";
import {
  objectiveDiscriminantPartialSwitch,
  objectiveMergeSwitch,
  objectiveSwitch,
} from "@shared/utils/objectiveSwitch";
import { useState } from "react";
import { Button } from "@/components/atoms/Button";
import { Select } from "@/components/atoms/Select";
import { ToggleButton } from "@/components/atoms/ToggleButton";
import { Show } from "@/components/control/Show";
import {
  ActionSelector,
  ActionSelectorContent,
} from "@/components/molecules/forms/ActionSelector";
import { LayerSelector } from "@/components/molecules/forms/LayerSelector";
import { MousePositionInput } from "@/components/molecules/forms/MousePositionInput";
import { TimingInput } from "@/components/molecules/forms/TimingInput";

import { RemapKeySection } from "@/components/organisms/editor/RemapKeySection";
import { HStack, VStack } from "@/components/template/Flex";
import { useMacros } from "@/hooks/api/useMacros";
import type { ActionSetters } from "@/hooks/ui/useBindingConfig";
import { useMousePosition } from "@/hooks/ui/useMousePosition";
import type { BindingState } from "@/models/BindingState";
import type { LayoutType } from "@/types";
import { getLayerDescription } from "@/utils/getLayerDescription";

const DEFAULT_CURSOR_RETURN_DELAY_MS = 1000;
const DEFAULT_DELAY_MS = 500;
const COUNTDOWN_START_VALUE = 3;
const COUNTDOWN_INTERVAL_MS = 1000;

interface ActionSettingsSectionProps {
  selectedTrigger: TriggerType;
  layers: Layer[];
  layout: LayoutType;
  targetVk: number;

  // アクション設定
  actionSetters: ActionSetters;
  state: BindingState;

  // UI制御
  isInputFocused: boolean;
  setIsInputFocused: (focused: boolean) => void;

  // 追加ハンドラー
  onOpenMacros?: () => void;
  currentMacroId?: string;
}

export function ActionSettingsSection({
  state,
  actionSetters,
  currentMacroId,
  layers,
  layout,
  onOpenMacros,
  selectedTrigger,
  targetVk,
  isInputFocused,
  setIsInputFocused,
}: ActionSettingsSectionProps) {
  const { macros } = useMacros();
  const { actionType } = state;
  const { getCursorPosition } = useMousePosition();

  const handleActionTypeChange = (type: ActionType) => {
    objectiveSwitch(
      {
        none: () => actionSetters.setNoneAction(),
        remap: () => actionSetters.setRemapAction([], { enabled: false }),
        layerToggle: () =>
          actionSetters.setLayerAction("toggle", layers[0]?.id || ""),
        layerMomentary: () =>
          actionSetters.setLayerAction("momentary", layers[0]?.id || ""),
        mouseMove: () => actionSetters.setMouseMoveAction(0, 0),
        mouseClick: () => actionSetters.setMouseClickAction(0, 0, "left", 1),
        cursorReturn: () =>
          actionSetters.setCursorReturnAction(DEFAULT_CURSOR_RETURN_DELAY_MS),
        macro: () => actionSetters.setMacroAction(macros[0]?.id || ""),
        delay: () => actionSetters.setDelayAction(DEFAULT_DELAY_MS),
      },
      type
    );
  };

  const [mouseX, setMouseX] = useState<number>(
    (state.actionType === "mouseMove" || state.actionType === "mouseClick") &&
      state.mouseX !== undefined
      ? state.mouseX
      : 0
  );
  const [mouseY, setMouseY] = useState<number>(
    (state.actionType === "mouseMove" || state.actionType === "mouseClick") &&
      state.mouseY !== undefined
      ? state.mouseY
      : 0
  );
  const [mouseButton, setMouseButton] = useState<"left" | "right" | "middle">(
    state.actionType === "mouseClick" ? state.mouseButton : "left"
  );
  const [clickCount, setClickCount] = useState<number>(
    state.actionType === "mouseClick" ? state.clickCount : 1
  );
  const [cursorReturnDelayMs, setCursorReturnDelayMs] = useState<number>(
    state.actionType === "cursorReturn"
      ? state.cursorReturnDelayMs
      : DEFAULT_CURSOR_RETURN_DELAY_MS
  );
  const [isCapturing, setIsCapturing] = useState(false);
  const [countdown, setCountdown] = useState(0);

  const macroOptions = macros
    .filter((m) => !isCircularMacro(currentMacroId, m.id, macros))
    .map((m) => ({
      id: m.id,
      value: m.id,
      label: m.name,
    }));

  const handleGetMousePosition = () => {
    setIsCapturing(true);
    setCountdown(COUNTDOWN_START_VALUE);
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          getCursorPosition().then((pos) => {
            setMouseX(pos.x);
            setMouseY(pos.y);
            setIsCapturing(false);
            objectiveDiscriminantPartialSwitch(
              {
                mouseMove: () => actionSetters.setMouseMoveAction(pos.x, pos.y),
                mouseClick: () =>
                  actionSetters.setMouseClickAction(
                    pos.x,
                    pos.y,
                    mouseButton,
                    clickCount
                  ),
              },
              state,
              "actionType"
            );
          });
          return 0;
        }
        return prev - 1;
      });
    }, COUNTDOWN_INTERVAL_MS);
  };

  return (
    <ActionSelector
      actionType={actionType}
      gap={2}
      onActionTypeChange={handleActionTypeChange}
      triggerType={selectedTrigger}
    >
      {objectiveMergeSwitch(
        {
          remap: (s) => (
            <ActionSelectorContent value="remap">
              <RemapKeySection
                actionSetters={actionSetters}
                isInputFocused={isInputFocused}
                layout={layout}
                selectedTrigger={selectedTrigger}
                setIsInputFocused={setIsInputFocused}
                state={s}
                targetVk={targetVk}
              />
            </ActionSelectorContent>
          ),
          "layerToggle-layerMomentary": (s) => (
            <ActionSelectorContent value={["layerToggle", "layerMomentary"]}>
              <LayerSelector
                description={getLayerDescription(actionType)}
                layers={layers}
                onLayerChange={(layerId) => {
                  if (actionType === "layerToggle") {
                    actionSetters.setLayerAction("toggle", layerId);
                  } else {
                    actionSetters.setLayerAction("momentary", layerId);
                  }
                }}
                selectedLayerId={s.selectedLayerId}
              />
            </ActionSelectorContent>
          ),
          mouseMove: () => (
            <ActionSelectorContent value="mouseMove">
              <VStack gap={4}>
                <p className="text-muted-foreground text-sm">
                  マウスカーソルを指定座標に移動します
                </p>

                <MousePositionInput
                  idPrefix="move"
                  mouseHandlers={{
                    onGetMousePosition: handleGetMousePosition,
                    setMouseX: (val) => {
                      setMouseX(val);
                      actionSetters.setMouseMoveAction(val, mouseY);
                    },
                    setMouseY: (val) => {
                      setMouseY(val);
                      actionSetters.setMouseMoveAction(mouseX, val);
                    },
                  }}
                  mouseState={{
                    x: mouseX,
                    y: mouseY,
                    isCapturing,
                    countdown,
                  }}
                  setIsInputFocused={setIsInputFocused}
                />
              </VStack>
            </ActionSelectorContent>
          ),
          mouseClick: () => (
            <ActionSelectorContent value="mouseClick">
              <VStack className="w-full justify-center" gap={4}>
                <p className="text-muted-foreground text-sm">
                  指定座標をクリックします
                </p>

                <MousePositionInput
                  idPrefix="click"
                  mouseHandlers={{
                    onGetMousePosition: handleGetMousePosition,
                    setMouseX: (val) => {
                      setMouseX(val);
                      actionSetters.setMouseClickAction(
                        val,
                        mouseY,
                        mouseButton,
                        clickCount
                      );
                    },
                    setMouseY: (val) => {
                      setMouseY(val);
                      actionSetters.setMouseClickAction(
                        mouseX,
                        val,
                        mouseButton,
                        clickCount
                      );
                    },
                  }}
                  mouseState={{
                    x: mouseX,
                    y: mouseY,
                    isCapturing,
                    countdown,
                  }}
                  setIsInputFocused={setIsInputFocused}
                >
                  <VStack className="h-full justify-around" gap={2}>
                    <ToggleButton
                      className="w-24"
                      labels={{
                        left: "左",
                        middle: "中",
                        right: "右",
                      }}
                      onChange={(btn) => {
                        setMouseButton(btn);
                        actionSetters.setMouseClickAction(
                          mouseX,
                          mouseY,
                          btn,
                          clickCount
                        );
                      }}
                      options={["left", "middle", "right"] as const}
                      value={mouseButton}
                    />

                    <ToggleButton
                      className="w-24"
                      labels={{
                        1: "1回",
                        2: "2回",
                      }}
                      onChange={(count) => {
                        setClickCount(count);
                        actionSetters.setMouseClickAction(
                          mouseX,
                          mouseY,
                          mouseButton,
                          count
                        );
                      }}
                      options={[1, 2] as const}
                      value={clickCount}
                    />
                  </VStack>
                </MousePositionInput>
              </VStack>
            </ActionSelectorContent>
          ),

          cursorReturn: () => (
            <ActionSelectorContent value="cursorReturn">
              <VStack gap={4}>
                <p className="text-muted-foreground text-sm">
                  キー押下時のカーソル位置を記録し、指定時間後に戻ります
                </p>

                <TimingInput
                  defaultValue={DEFAULT_CURSOR_RETURN_DELAY_MS}
                  id="cursorReturnDelay"
                  label="遅延時間 (ms)"
                  onValueChange={(val) => {
                    if (val !== undefined) {
                      setCursorReturnDelayMs(val);
                      actionSetters.setCursorReturnAction(val);
                    }
                  }}
                  setFocused={setIsInputFocused}
                  value={cursorReturnDelayMs}
                />
              </VStack>
            </ActionSelectorContent>
          ),
          macro: (s) => (
            <ActionSelectorContent value="macro">
              <VStack gap={4}>
                <p className="text-muted-foreground text-sm">
                  事前に定義したマクロ（一連の操作）を実行します
                </p>
                <HStack className="items-end" gap={2}>
                  <div className="flex-1">
                    <Select
                      id="macroSelect"
                      label="マクロを選択"
                      onValueChange={(macroId) =>
                        actionSetters.setMacroAction(macroId)
                      }
                      options={macroOptions}
                      select-value={s.macroId}
                    />
                  </div>
                  <Show condition={!!onOpenMacros}>
                    <Button onClick={onOpenMacros} variant="secondary">
                      マクロを管理
                    </Button>
                  </Show>
                </HStack>
              </VStack>
            </ActionSelectorContent>
          ),
          delay: (s) => (
            <ActionSelectorContent value="delay">
              <VStack gap={4}>
                <p className="text-muted-foreground text-sm">
                  指定した時間（ミリ秒）待機します
                </p>
                <TimingInput
                  defaultValue={500}
                  id="delayActionInput"
                  label="待機時間 (ms)"
                  onValueChange={(val) => {
                    if (val !== undefined) {
                      actionSetters.setDelayAction(val);
                    }
                  }}
                  setFocused={setIsInputFocused}
                  value={s.delayActionMs}
                />
              </VStack>
            </ActionSelectorContent>
          ),
        },
        state,
        "actionType",
        {
          remap: "remap",
          layerToggle: "layerToggle-layerMomentary",
          layerMomentary: "layerToggle-layerMomentary",
          mouseMove: "mouseMove",
          mouseClick: "mouseClick",
          cursorReturn: "cursorReturn",
          delay: "delay",
          macro: "macro",
        }
      )}
    </ActionSelector>
  );
}
