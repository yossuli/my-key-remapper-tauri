import type { ActionType, Layer, TriggerType } from "@shared/types/remapConfig";
import { isCircularMacro } from "@shared/utils/macroUtils";
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
import type { UseKeyEditorActionsReturn } from "@/hooks/useKeyEditorAction";
import { useMacros } from "@/hooks/useMacros";
import type { LayoutType } from "@/types";
import { getLayerDescription } from "@/utils/getLayerDescription";

import type {
  KeyEditorUIHandlers,
  MouseHandlers,
  MouseState,
  RepeatSettings,
} from "./UnifiedActionEditor";

const DEFAULT_CURSOR_RETURN_DELAY_MS = 1000;

interface ActionSettingsSectionProps {
  actionType: ActionType;
  selectedTrigger: TriggerType;
  selectedLayerId: string;
  layers: Layer[];
  layout: LayoutType;
  targetVk: number;

  // Grouped state & handlers
  mouseState: MouseState;
  mouseHandlers: MouseHandlers;
  keyEditorActions: UseKeyEditorActionsReturn;
  keyEditorUIHandlers: KeyEditorUIHandlers;

  // Repeat Settings
  repeatSettings: RepeatSettings;

  // Additional handlers
  setActionType: (type: ActionType) => void;
  setSelectedLayerId: (id: string) => void;

  // Macro State
  macroId: string;
  setMacroId: (id: string) => void;
  onOpenMacros?: () => void;
  currentMacroId?: string;

  // Delay State
  delayActionMs: number;
  setDelayActionMs: (ms: number) => void;
}

export function ActionSettingsSection({
  actionType,
  selectedTrigger,
  selectedLayerId,
  layers,
  layout,
  targetVk,
  mouseState,
  mouseHandlers,
  keyEditorActions,
  keyEditorUIHandlers,
  setActionType,
  setSelectedLayerId,
  repeatSettings,
  macroId,
  setMacroId,
  onOpenMacros,
  currentMacroId,
  delayActionMs,
  setDelayActionMs,
}: ActionSettingsSectionProps) {
  const { macros } = useMacros();

  // マクロ選択肢の作成
  const macroOptions = macros
    // TODO - 簡略化
    .filter((m) => !isCircularMacro(currentMacroId, m.id, macros))
    .map((m) => ({
      id: m.id,
      value: m.id,
      label: m.name,
    }));

  return (
    <ActionSelector
      actionType={actionType}
      gap={2}
      onActionTypeChange={setActionType}
      triggerType={selectedTrigger}
    >
      <ActionSelectorContent value="remap">
        <RemapKeySection
          keyEditorActions={keyEditorActions}
          keyEditorUIHandlers={keyEditorUIHandlers}
          layout={layout}
          repeatSettings={repeatSettings}
          selectedTrigger={selectedTrigger}
          setIsInputFocused={keyEditorUIHandlers.setIsInputFocused}
          targetVk={targetVk}
        />
      </ActionSelectorContent>

      <ActionSelectorContent value={["layerToggle", "layerMomentary"]}>
        <LayerSelector
          description={getLayerDescription(actionType)}
          layers={layers}
          onLayerChange={setSelectedLayerId}
          selectedLayerId={selectedLayerId}
        />
      </ActionSelectorContent>

      <ActionSelectorContent value="mouseMove">
        {/* TODO - ActionSelectorContentの改良によってこれをプロパティ化 */}
        <VStack gap={4}>
          <p className="text-muted-foreground text-sm">
            マウスカーソルを指定座標に移動します
          </p>

          <MousePositionInput
            idPrefix="mouse"
            mouseHandlers={mouseHandlers}
            mouseState={mouseState}
            setFocused={keyEditorUIHandlers.setIsInputFocused}
          />
        </VStack>
      </ActionSelectorContent>

      <ActionSelectorContent value="mouseClick">
        <VStack className="w-full justify-center" gap={4}>
          <p className="text-muted-foreground text-sm">
            指定座標をクリックします
          </p>

          <MousePositionInput
            idPrefix="click"
            mouseHandlers={mouseHandlers}
            mouseState={mouseState}
            setFocused={keyEditorUIHandlers.setIsInputFocused}
          >
            <VStack className="h-full justify-around" gap={2}>
              <ToggleButton
                className="w-full"
                labels={{
                  left: "左クリック",
                  middle: "中クリック",
                  right: "右クリック",
                }}
                onChange={mouseHandlers.setMouseButton}
                options={["left", "middle", "right"] as const}
                value={mouseState.button}
              />

              <ToggleButton
                className="w-full"
                labels={{
                  1: "シングル",
                  2: "ダブル",
                }}
                onChange={mouseHandlers.setClickCount}
                options={[1, 2] as const}
                value={mouseState.clickCount}
              />
            </VStack>
          </MousePositionInput>
        </VStack>
      </ActionSelectorContent>

      <ActionSelectorContent value="cursorReturn">
        <VStack gap={4}>
          <p className="text-muted-foreground text-sm">
            キー押下時のカーソル位置を記録し、指定時間後に戻ります
          </p>

          <TimingInput
            defaultValue={DEFAULT_CURSOR_RETURN_DELAY_MS}
            id="cursorReturnDelay"
            label="遅延時間 (ms)"
            onValueChange={(val) =>
              val !== undefined && mouseHandlers.setCursorReturnDelayMs(val)
            }
            setFocused={keyEditorUIHandlers.setIsInputFocused}
            value={mouseState.cursorReturnDelayMs}
          />
        </VStack>
      </ActionSelectorContent>

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
                onValueChange={setMacroId}
                options={macroOptions}
                select-value={macroId}
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

      <ActionSelectorContent value="delay">
        <VStack gap={4}>
          <p className="text-muted-foreground text-sm">
            指定した時間（ミリ秒）待機します
          </p>
          <TimingInput
            defaultValue={500}
            id="delayActionInput"
            label="待機時間 (ms)"
            onValueChange={(val) => val !== undefined && setDelayActionMs(val)}
            setFocused={keyEditorUIHandlers.setIsInputFocused}
            value={delayActionMs}
          />
        </VStack>
      </ActionSelectorContent>
    </ActionSelector>
  );
}
