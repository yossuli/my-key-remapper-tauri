import { Reorder } from "framer-motion";
import { Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/atoms/Button";
import { Icon } from "@/components/atoms/Icon";
import { Input } from "@/components/atoms/Input";
import { WithRemoveBadge } from "@/components/atoms/RemoveBadge";
import { Else, Ternary, Then } from "@/components/control/Ternary";
import type { LayerActions } from "@/components/organisms/KeyRemapSection";
import type { LayerState } from "@/components/pages/KeyRemapperPage";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { LayoutType } from "@/types";
import { LayerSettingsModal } from "./LayerSettingsModal";

// TODO - まとめる必要はなさそう
interface LayerTabsProps {
  layerState: LayerState;
  layerActions: LayerActions;
  layout: LayoutType;
}

export function LayerTabs({
  layerState,
  layerActions,
  layout,
}: LayerTabsProps) {
  // 🎁 → 🔨🔥 (A. Layer Management Flow)
  // layerState から layers, layerId を使用
  // layerActions から setLayerId, addLayer, removeLayer, reorderLayers を使用
  const [isAdding, setIsAdding] = useState(false);
  const [newLayerName, setNewLayerName] = useState("");
  const [contextMenuLayerId, setContextMenuLayerId] = useState<string | null>(
    null
  );

  const orderedLayerIds = useMemo(
    () => layerState.layers.map((l) => l.id),
    [layerState.layers]
  );

  const handleAdd = () => {
    if (newLayerName.trim()) {
      layerActions.addLayer(newLayerName.trim());
      setNewLayerName("");
      setIsAdding(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleAdd();
    } else if (e.key === "Escape") {
      setIsAdding(false);
      setNewLayerName("");
    }
  };

  const handleRemoveClick = (layerId: string) => {
    layerActions.removeLayer(layerId);
  };

  return (
    <Tabs onValueChange={layerActions.setLayerId} value={layerState.layerId}>
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground text-sm">Layer:</span>

        <TabsList className="h-auto bg-muted/30 p-1">
          <Reorder.Group
            as="div"
            axis="x"
            className="flex items-center gap-1"
            onReorder={layerActions.reorderLayers}
            values={orderedLayerIds}
          >
            {orderedLayerIds.map((id) => (
              <Reorder.Item as="div" key={id} value={id}>
                <WithRemoveBadge onRemove={() => handleRemoveClick(id)}>
                  <ContextMenu>
                    <ContextMenuTrigger>
                      <TabsTrigger
                        className="data-[state=active]:bg-background"
                        value={id}
                      >
                        {id.charAt(0).toUpperCase() + id.slice(1)}
                      </TabsTrigger>
                    </ContextMenuTrigger>
                    <ContextMenuContent>
                      <ContextMenuItem
                        onSelect={() => setContextMenuLayerId(id)}
                      >
                        Layer Settings...
                      </ContextMenuItem>
                    </ContextMenuContent>
                  </ContextMenu>
                </WithRemoveBadge>
              </Reorder.Item>
            ))}
          </Reorder.Group>
        </TabsList>

        <Ternary condition={isAdding}>
          <Then>
            <Input
              id="new-layer-input"
              input-autoFocus
              input-className="h-8 w-24 text-sm"
              input-onBlur={() => {
                if (!newLayerName.trim()) {
                  setIsAdding(false);
                }
              }}
              input-onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setNewLayerName(e.target.value)
              }
              input-onKeyDown={handleKeyDown}
              input-placeholder="レイヤー名"
              input-value={newLayerName}
            />
          </Then>
          <Else>
            <Button onClick={() => setIsAdding(true)} size="sm" variant="ghost">
              <Icon icon={Plus} />
            </Button>
          </Else>
        </Ternary>
      </div>
      <LayerSettingsModal
        layerId={contextMenuLayerId}
        layers={layerState.layers}
        layout={layout}
        onClose={() => setContextMenuLayerId(null)}
        onUpdate={layerActions.updateLayer}
      />
    </Tabs>
  );
}
