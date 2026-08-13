import { Play } from "lucide-react";
import { Button } from "@/components/atoms/Button";
import { Select } from "@/components/atoms/Select";
import { Show } from "@/components/control/Show";
import { EditorSection } from "@/components/molecules/EditorSection";
import { HStack } from "@/components/template/Flex";
import type { ActionSetters } from "@/hooks/ui/useBindingConfig";
import type { MacroBindingState } from "@/models/bindingStateModel";

interface MacroActionSettingsProps {
  state: MacroBindingState;
  actionSetters: ActionSetters;
  macroOptions: { id: string; value: string; label: string }[];
  onOpenMacros?: () => void;
}

export function MacroActionSettings({
  state,
  actionSetters,
  macroOptions,
  onOpenMacros,
}: MacroActionSettingsProps) {
  return (
    <EditorSection
      description="事前に定義したマクロ（一連の操作）を実行します"
      icon={Play}
      title="マクロ実行"
    >
      <HStack className="items-end" gap={2}>
        <div className="flex-1">
          <Select
            id="macroSelect"
            label="マクロを選択"
            onValueChange={(macroId) => actionSetters.setMacroAction(macroId)}
            options={macroOptions}
            select-value={state.macroId}
          />
        </div>
        <Show condition={!!onOpenMacros}>
          <Button onClick={onOpenMacros} variant="secondary">
            マクロを管理
          </Button>
        </Show>
      </HStack>
    </EditorSection>
  );
}
