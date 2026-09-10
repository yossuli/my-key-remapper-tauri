import { Reorder } from "framer-motion";
import { Check, FolderTree, Plus, Settings, Trash2 } from "lucide-react";
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
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
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
            {orderedLayerIds.map((id) => {
              const currentLayer = layerState.layers.find((l) => l.id === id);
              const validParentCandidates = layerState.layers.filter((l) => {
                if (l.id === id) return false;
                let curr = l;
                const visited = new Set<string>([l.id]);
                while (curr.parentLayerId) {
                  if (curr.parentLayerId === id) return false;
                  if (visited.has(curr.parentLayerId)) break;
                  visited.add(curr.parentLayerId);
                  const next = layerState.layers.find((x) => x.id === curr.parentLayerId);
                  if (!next) break;
                  curr = next;
                }
                return true;
              });

              return (
                <Reorder.Item as="div" key={id} value={id}>
                  <WithRemoveBadge
                    disabled={id === "base"}
                    onRemove={() => handleRemoveClick(id)}
                  >
                    <ContextMenu>
                      <ContextMenuTrigger>
                        <TabsTrigger
                          className="data-[state=active]:bg-background"
                          value={id}
                        >
                          {id.charAt(0).toUpperCase() + id.slice(1)}
                        </TabsTrigger>
                      </ContextMenuTrigger>
                      <ContextMenuContent className="w-52">
                        <ContextMenuItem
                          className="flex items-center gap-2 cursor-pointer"
                          onSelect={() => setContextMenuLayerId(id)}
                        >
                          <Settings className="h-4 w-4" />
                          <span>レイヤー設定...</span>
                        </ContextMenuItem>

                        <ContextMenuSub>
                          <ContextMenuSubTrigger className="flex items-center gap-2 cursor-pointer">
                            <FolderTree className="h-4 w-4" />
                            <span>親レイヤー (継承元)</span>
                          </ContextMenuSubTrigger>
                          <ContextMenuSubContent className="w-48">
                            <ContextMenuItem
                              className="flex items-center justify-between cursor-pointer"
                              onSelect={() =>
                                layerActions.updateLayer(id, {
                                  parentLayerId: undefined,
                                })
                              }
                            >
                              <span>なし (None)</span>
                              {!currentLayer?.parentLayerId && (
                                <Check className="h-4 w-4 text-primary" />
                              )}
                            </ContextMenuItem>
                            <ContextMenuSeparator />
                            {validParentCandidates.map((parent) => (
                              <ContextMenuItem
                                className="flex items-center justify-between cursor-pointer"
                                key={parent.id}
                                onSelect={() =>
                                  layerActions.updateLayer(id, {
                                    parentLayerId: parent.id,
                                  })
                                }
                              >
                                <span>
                                  {parent.id.charAt(0).toUpperCase() +
                                    parent.id.slice(1)}
                                </span>
                                {currentLayer?.parentLayerId === parent.id && (
                                  <Check className="h-4 w-4 text-primary" />
                                )}
                              </ContextMenuItem>
                            ))}
                          </ContextMenuSubContent>
                        </ContextMenuSub>

                        {id !== "base" && (
                          <>
                            <ContextMenuSeparator />
                            <ContextMenuItem
                              className="flex items-center gap-2 cursor-pointer text-destructive focus:text-destructive"
                              onSelect={() => handleRemoveClick(id)}
                            >
                              <Trash2 className="h-4 w-4" />
                              <span>レイヤーを削除</span>
                            </ContextMenuItem>
                          </>
                        )}
                      </ContextMenuContent>
                    </ContextMenu>
                  </WithRemoveBadge>
                </Reorder.Item>
              );
            })}
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
