import { Layers } from "lucide-react";
import { Select } from "@/components/atoms/Select";
import { Show } from "@/components/control/Show";
import { IconLabel } from "@/components/molecules/IconLabel";
import { VStack } from "@/components/template/Flex";
import type { Layer } from "@/types/remapConfig";

interface LayerSelectorProps {
  layers: Pick<Layer, "id">[];
  selectedLayerId: string;
  onLayerChange: (layerId: string) => void;
  description?: string;
  className?: string;
}

export function LayerSelector({
  layers,
  selectedLayerId,
  onLayerChange,
  description,
  className,
}: LayerSelectorProps) {
  return (
    <VStack className={className} gap={2}>
      <Select
        id="selectLayer"
        label={<IconLabel icon={Layers} label="対象レイヤー" />}
        label-className="flex items-center gap-1 font-medium text-muted-foreground text-xs"
        onValueChange={(e) => onLayerChange(e)}
        options={layers.map((layer) => ({
          id: layer.id,
          value: layer.id,
          label: layer.id,
        }))}
        select-value={selectedLayerId}
      />
      <Show condition={Boolean(description)}>
        <p className="text-muted-foreground text-xs">{description}</p>
      </Show>
    </VStack>
  );
}
