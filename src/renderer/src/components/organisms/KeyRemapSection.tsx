import type { KeyBinding, TriggerType } from "@shared/types/remapConfig";
import { Settings, Zap } from "lucide-react";
import {
  type Dispatch,
  type SetStateAction,
  useCallback,
  useState,
} from "react";
import { Button } from "@/components/atoms/Button";
import { Icon } from "@/components/atoms/Icon";
import { LayoutToggle } from "@/components/molecules/display/LayoutToggle";
import { TriggerTabs } from "@/components/molecules/forms/TriggerTabs";
import { KeyboardGrid } from "@/components/organisms/KeyboardGrid";
import { LayerTabs } from "@/components/organisms/keyboard/LayerTabs";
import type {
  LayerState,
  MappingActions,
} from "@/components/pages/KeyRemapperPage";
import { HStack, VStack } from "@/components/template/Flex";
import type { UseGlobalSettingsReturn } from "@/hooks/api/useGlobalSettings";
import type { UseLayerStateReturn } from "@/hooks/api/useLayerState";
import type { UseRemapControlReturn } from "@/hooks/api/useRemapControl";
import type { UseKeyEventLogReturn } from "@/hooks/ui/useKeyEventLog";
import type { UseLayerStackReturn } from "@/hooks/ui/useLayerStack";
import { useQuickRemap } from "@/hooks/ui/useQuickRemap";
import type { KeyboardLayout, LayoutType } from "@/types";
import { cn } from "@/utils/cn";

export type LayerActions = Pick<
  UseLayerStateReturn,
  "setLayerId" | "addLayer" | "removeLayer" | "reorderLayers" | "updateLayer"
>;

export type RemapActions = Pick<
  UseRemapControlReturn,
  "toggleActive" | "enableRemap" | "disableRemap"
>;

export type GlobalSettingsControl = Pick<
  UseGlobalSettingsReturn,
  "updateGlobalSettings"
>;

export type LayerStackControl = Pick<
  UseLayerStackReturn,
  "stack" | "refresh" | "resetToLayer"
>;

export type LogState = Pick<UseKeyEventLogReturn, "logs">;

interface KeyRemapSectionProps {
  // Layer state & actions
  layerState: LayerState;
  layerActions: LayerActions;

  // Mapping actions
  mappingActions: MappingActions;

  // Remap actions
  remapActions: RemapActions;

  // UI state
  layout: LayoutType;
  keyboardLayout: KeyboardLayout;
  bindings: Record<number, KeyBinding[]>;
  selectedTrigger: TriggerType;
  toggleLayout: () => void;
  setSelectedTrigger: (trigger: TriggerType) => void;
  setEditingKey: Dispatch<SetStateAction<number | null>>;
}

export function KeyRemapSection({
  layerState,
  layerActions,
  mappingActions,
  remapActions,
  layout,
  keyboardLayout,
  bindings,
  selectedTrigger,
  toggleLayout,
  setSelectedTrigger,
  setEditingKey,
}: KeyRemapSectionProps) {
  const [isQuickEditMode, setIsQuickEditMode] = useState(false);

  // クイック設定モード
  const { editingKey: quickEditingKey, startEditing: startQuickEditing } =
    useQuickRemap({
      enabled: isQuickEditMode,
      selectedLayerId: layerState.layerId,
      targetKeys: [],
      selectedTrigger,
      keyboardLayout,
      onSaveMapping: mappingActions.saveMapping,
    });

  const onKeyClick = (vk: number) => {
    if (isQuickEditMode) {
      startQuickEditing(vk);
      return;
    }
    remapActions.disableRemap();
    setEditingKey(vk);
  };

  const onToggleQuickEditMode = useCallback(() => {
    setIsQuickEditMode((prev) => {
      const next = !prev;
      if (next) {
        remapActions.disableRemap();
      } else {
        remapActions.enableRemap();
      }
      return next;
    });
  }, [remapActions]);

  return (
    <VStack as="section" gap={4}>
      <HStack className="justify-between gap-4">
        <LayerTabs
          layerActions={layerActions}
          layerState={layerState}
          layout={layout}
        />
        <HStack className="gap-2">
          <TriggerTabs
            onTriggerChange={setSelectedTrigger}
            selectedTrigger={selectedTrigger}
            size="compact"
          />
          <Button
            className={cn(
              "gap-1",
              isQuickEditMode ? "bg-yellow-500 hover:bg-yellow-600" : ""
            )}
            onClick={onToggleQuickEditMode}
            variant={isQuickEditMode ? "default" : "secondary"}
          >
            <Icon icon={Zap} />
            {isQuickEditMode ? "Quick ON" : "Quick"}
          </Button>
        </HStack>
      </HStack>

      <div className="overflow-x-auto">
        <KeyboardGrid
          bindings={bindings}
          keyboardLayout={keyboardLayout}
          layerState={layerState}
          layout={layout}
          mappingActions={mappingActions}
          onKeyClick={onKeyClick}
          quickEditingKey={quickEditingKey}
          selectedTrigger={selectedTrigger}
        />
      </div>
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 font-semibold text-lg">
          <Icon className="opacity-70" icon={Settings} size="md" />
          Keyboard Layout: {layout}
        </h2>
        <LayoutToggle currentLayout={layout} onToggle={toggleLayout} />
      </div>
    </VStack>
  );
}
