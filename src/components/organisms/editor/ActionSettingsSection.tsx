import type { ActionType, Layer, TriggerType } from "@/types/remapConfig";
import { isCircularMacro } from "@/utils/macroUtils";
import {
  objectiveDiscriminantSwitch,
  objectiveMergeSwitch,
} from "@/utils/objectiveSwitch";
import { Keyboard, RotateCcw, Timer } from "lucide-react";
import { EditorSection } from "@/components/molecules/EditorSection";
import { ActionNumericInput } from "@/components/molecules/forms/ActionNumericInput";
import { ActionSelector } from "@/components/molecules/forms/ActionSelector";

import { RemapKeySection } from "@/components/organisms/editor/RemapKeySection";
import { useMacros } from "@/hooks/api/useMacros";
import type { ActionSetters } from "@/hooks/ui/useBindingConfig";
import {
  type BindingState,
  type CursorReturnBindingState,
  DEFAULT_CURSOR_RETURN_DELAY_MS,
  DEFAULT_DELAY_MS,
  type DelayBindingState,
  getInitialStateForType,
  type LayerMomentaryBindingState,
  type LayerToggleBindingState,
  type MacroBindingState,
  type MouseClickBindingState,
  type MouseMoveBindingState,
  type RemapBindingState,
} from "@/models/bindingStateModel";
import type { LayoutType } from "@/types";
import { LayerActionSettings } from "./LayerActionSettings";
import { MacroActionSettings } from "./MacroActionSettings";
import { MouseClickActionSettings } from "./MouseClickActionSettings";
import { MouseMoveActionSettings } from "./MouseMoveActionSettings";

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

  const handleActionTypeChange = (type: ActionType) => {
    const initialState = getInitialStateForType(type);
    objectiveDiscriminantSwitch<BindingState, "actionType", void>(
      {
        none: () => actionSetters.setNoneAction(),
        remap: (s: RemapBindingState) =>
          actionSetters.setRemapAction(s.targetKeys, {
            enabled: s.repeat ?? false,
            delayMs: s.repeatDelayMs,
            intervalMs: s.repeatIntervalMs,
          }),
        layerToggle: (s: LayerToggleBindingState) =>
          actionSetters.setLayerAction("toggle", s.selectedLayerId),
        layerMomentary: (s: LayerMomentaryBindingState) =>
          actionSetters.setLayerAction("momentary", s.selectedLayerId),
        mouseMove: (s: MouseMoveBindingState) =>
          actionSetters.setMouseMoveAction(s.mouseX, s.mouseY),
        mouseClick: (s: MouseClickBindingState) =>
          actionSetters.setMouseClickAction(
            s.mouseX,
            s.mouseY,
            s.mouseButton,
            s.clickCount
          ),
        cursorReturn: (s: CursorReturnBindingState) =>
          actionSetters.setCursorReturnAction(s.cursorReturnDelayMs),
        macro: (s: MacroBindingState) =>
          actionSetters.setMacroAction(s.macroId),
        delay: (s: DelayBindingState) =>
          actionSetters.setDelayAction(s.delayActionMs),
      },
      initialState,
      "actionType"
    );
  };

  const macroOptions = macros
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
      onActionTypeChange={handleActionTypeChange}
      triggerType={selectedTrigger}
    >
      {objectiveMergeSwitch(
        {
          remap: (s) => (
            <EditorSection
              description="指定したキーまたは一連のキーを出力します"
              icon={Keyboard}
              title="キー再割り当て"
            >
              <RemapKeySection
                actionSetters={actionSetters}
                isInputFocused={isInputFocused}
                layout={layout}
                selectedTrigger={selectedTrigger}
                setIsInputFocused={setIsInputFocused}
                state={s}
                targetVk={targetVk}
              />
            </EditorSection>
          ),
          "layerToggle-layerMomentary": (s, k) => (
            <LayerActionSettings
              actionSetters={actionSetters}
              actionType={k}
              layers={layers}
              state={s}
            />
          ),
          mouseMove: (s) => (
            <MouseMoveActionSettings
              actionSetters={actionSetters}
              setIsInputFocused={setIsInputFocused}
              state={s}
            />
          ),
          mouseClick: (s) => (
            <MouseClickActionSettings
              actionSetters={actionSetters}
              setIsInputFocused={setIsInputFocused}
              state={s}
            />
          ),
          cursorReturn: (s) => (
            <EditorSection
              description="キー押下時のカーソル位置を記録し、指定時間後に戻ります"
              icon={RotateCcw}
              title="カーソル復帰"
            >
              <ActionNumericInput
                id="cursorReturnDelay"
                label="遅延時間 (ms)"
                onValueChange={(val) => {
                  actionSetters.setCursorReturnAction(
                    val ?? DEFAULT_CURSOR_RETURN_DELAY_MS
                  );
                }}
                placeholder={String(DEFAULT_CURSOR_RETURN_DELAY_MS)}
                setIsInputFocused={setIsInputFocused}
                value={s.cursorReturnDelayMs}
              />
            </EditorSection>
          ),
          macro: (s) => (
            <MacroActionSettings
              actionSetters={actionSetters}
              macroOptions={macroOptions}
              onOpenMacros={onOpenMacros}
              state={s}
            />
          ),
          delay: (s) => (
            <EditorSection
              description="指定した時間（ミリ秒）待機します"
              icon={Timer}
              title="待機"
            >
              <ActionNumericInput
                id="delayActionInput"
                label="待機時間 (ms)"
                onValueChange={(val) => {
                  actionSetters.setDelayAction(val ?? DEFAULT_DELAY_MS);
                }}
                placeholder="500"
                setIsInputFocused={setIsInputFocused}
                value={s.delayActionMs}
              />
            </EditorSection>
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
