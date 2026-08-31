import { Layers } from "lucide-react";
import { EditorSection } from "@/components/molecules/EditorSection";
import { LayerSelector } from "@/components/molecules/forms/LayerSelector";
import type { ActionSetters } from "@/hooks/ui/useBindingConfig";
import type {
  LayerMomentaryBindingState,
  LayerToggleBindingState,
} from "@/models/bindingStateModel";
import type { Layer } from "@/types/remapConfig";
import { getLayerDescription } from "@/utils/getLayerDescription";

interface LayerActionSettingsProps {
  actionType: "layerToggle" | "layerMomentary";
  state: LayerToggleBindingState | LayerMomentaryBindingState;
  actionSetters: ActionSetters;
  layers: Layer[];
}

export function LayerActionSettings({
  actionType,
  state,
  actionSetters,
  layers,
}: LayerActionSettingsProps) {
  const handleLayerChange = (layerId: string) => {
    if (actionType === "layerToggle") {
      actionSetters.setLayerAction("toggle", layerId);
    } else {
      actionSetters.setLayerAction("momentary", layerId);
    }
  };

  return (
    <EditorSection
      description={getLayerDescription(actionType)}
      icon={Layers}
      title="レイヤー切り替え"
    >
      <LayerSelector
        description=""
        layers={layers}
        onLayerChange={handleLayerChange}
        selectedLayerId={state.selectedLayerId}
      />
    </EditorSection>
  );
}
