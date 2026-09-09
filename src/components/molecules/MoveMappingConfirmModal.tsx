import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/atoms/Badge";
import { Show } from "@/components/control/Show";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import type { Layer } from "@/types/remapConfig";

export interface MoveMappingTarget {
  fromVk: number;
  fromLabel: string;
  toVk: number;
  toLabel: string;
}

interface MoveMappingConfirmModalProps {
  target: MoveMappingTarget | null;
  currentLayerId: string;
  layers: Layer[];
  onConfirm: (fromVk: number, toVk: number, targetLayerIds: string[]) => void;
  onCancel: () => void;
}

export function MoveMappingConfirmModal({
  target,
  currentLayerId,
  layers,
  onConfirm,
  onCancel,
}: MoveMappingConfirmModalProps) {
  const [selectedLayerIds, setSelectedLayerIds] = useState<string[]>([]);

  // 現在のレイヤー
  const currentLayer = useMemo(
    () => layers.find((l) => l.id === currentLayerId),
    [layers, currentLayerId]
  );

  // 現在のレイヤーに移動元キーのリマップがあるか
  const hasCurrentLayerMapping = useMemo(() => {
    if (!target) {
      return false;
    }
    return Boolean(currentLayer?.bindings[target.fromVk]?.length);
  }, [currentLayer, target]);

  // 他のレイヤーで移動元キーにリマップが設定されているレイヤー一覧
  const otherLayersWithMappings = useMemo(() => {
    if (!target) {
      return [];
    }
    return layers.filter(
      (l) =>
        l.id !== currentLayerId && Boolean(l.bindings[target.fromVk]?.length)
    );
  }, [layers, currentLayerId, target]);

  // モーダルオープン時に初期選択レイヤーを設定
  useEffect(() => {
    if (!target) {
      return;
    }
    const current = layers.find((l) => l.id === currentLayerId);
    const hasCurrent = Boolean(current?.bindings[target.fromVk]?.length);
    const others = layers.filter(
      (l) =>
        l.id !== currentLayerId && Boolean(l.bindings[target.fromVk]?.length)
    );

    if (hasCurrent) {
      // 現在のレイヤーにリマップがある場合は現在のレイヤーを初期選択
      setSelectedLayerIds([currentLayerId]);
    } else if (others.length > 0) {
      // 現在のレイヤーにリマップがなく他レイヤーにある場合は他レイヤーをすべて選択
      setSelectedLayerIds(others.map((l) => l.id));
    } else {
      setSelectedLayerIds([]);
    }
  }, [target, layers, currentLayerId]);

  // レイヤーの選択切り替え
  const toggleLayer = (layerId: string) => {
    setSelectedLayerIds((prev) =>
      prev.includes(layerId)
        ? prev.filter((id) => id !== layerId)
        : [...prev, layerId]
    );
  };

  // 他レイヤーの一括選択・解除
  const otherLayerIds = useMemo(
    () => otherLayersWithMappings.map((l) => l.id),
    [otherLayersWithMappings]
  );
  const isAllOtherSelected =
    otherLayerIds.length > 0 &&
    otherLayerIds.every((id) => selectedLayerIds.includes(id));

  const toggleAllOtherLayers = () => {
    if (isAllOtherSelected) {
      setSelectedLayerIds((prev) =>
        prev.filter((id) => !otherLayerIds.includes(id))
      );
    } else {
      setSelectedLayerIds((prev) => {
        const set = new Set([...prev, ...otherLayerIds]);
        return Array.from(set);
      });
    }
  };

  // 選択されたレイヤーのうち、移動先キーに既存のリマップが存在するレイヤー
  const overwritingLayers = useMemo(() => {
    if (!target) {
      return [];
    }
    return layers.filter(
      (l) =>
        selectedLayerIds.includes(l.id) &&
        Boolean(l.bindings[target.toVk]?.length)
    );
  }, [layers, selectedLayerIds, target]);

  const isOpen = target !== null;

  const handleConfirm = () => {
    if (!target || selectedLayerIds.length === 0) {
      return;
    }
    onConfirm(target.fromVk, target.toVk, selectedLayerIds);
  };

  if (!target) {
    return null;
  }

  return (
    <AlertDialog
      onOpenChange={(open) => {
        if (!open) {
          onCancel();
        }
      }}
      open={isOpen}
    >
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle>キーリマップの移動確認</AlertDialogTitle>
          <AlertDialogDescription>
            キーリマップの割り当てを変更します。移動するレイヤーを選択してください。
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="flex flex-col gap-4 py-2">
          <div className="flex items-center justify-center gap-3 rounded-lg border bg-muted/30 p-3">
            <div className="flex flex-col items-center gap-1">
              <span className="text-[11px] text-muted-foreground">移動元</span>
              <span className="rounded border bg-background px-3 py-1 font-mono font-semibold text-sm shadow-xs">
                {target.fromLabel}
              </span>
            </div>
            <span className="text-lg text-muted-foreground">➔</span>
            <div className="flex flex-col items-center gap-1">
              <span className="text-[11px] text-muted-foreground">移動先</span>
              <span className="rounded border border-primary/30 bg-primary/10 px-3 py-1 font-mono font-semibold text-primary text-sm shadow-xs">
                {target.toLabel}
              </span>
            </div>
          </div>

          <Show condition={overwritingLayers.length > 0}>
            <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-2.5 text-amber-600 text-xs dark:text-amber-400">
              ⚠️ 移動先キー「{target.toLabel}
              」に既存のリマップがあるため上書きされます。
              <div className="mt-1 font-medium">
                対象レイヤー: {overwritingLayers.map((l) => l.id).join(", ")}
              </div>
            </div>
          </Show>

          {/* 現在のレイヤー */}
          <div className="flex flex-col gap-1.5">
            <span className="font-semibold text-muted-foreground text-xs">
              現在のレイヤー
            </span>
            {hasCurrentLayerMapping ? (
              <label
                className="flex cursor-pointer items-center justify-between rounded-lg border bg-muted/30 p-2.5 transition-colors hover:bg-muted/50"
                htmlFor={`layer-checkbox-${currentLayerId}`}
              >
                <div className="flex items-center gap-2.5">
                  <Checkbox
                    checked={selectedLayerIds.includes(currentLayerId)}
                    id={`layer-checkbox-${currentLayerId}`}
                    onCheckedChange={() => toggleLayer(currentLayerId)}
                  />
                  <span className="font-medium text-foreground text-sm">
                    {currentLayerId}
                  </span>
                  <Badge className="px-1.5 py-0 text-[10px]" variant="primary">
                    現在のレイヤー
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground text-xs">
                    {currentLayer?.bindings[target.fromVk]?.length ?? 0} 件の設定
                  </span>
                  {Boolean(currentLayer?.bindings[target.toVk]?.length) && (
                    <Badge
                      className="border-amber-500/30 bg-amber-500/20 text-[10px] text-amber-600 dark:text-amber-400"
                      variant="accent"
                    >
                      上書き
                    </Badge>
                  )}
                </div>
              </label>
            ) : (
              <div className="rounded-lg border border-dashed p-2.5 text-center text-muted-foreground text-xs">
                現在のレイヤー（{currentLayerId}）にはリマップ設定がありません
              </div>
            )}
          </div>

          {/* 他のレイヤー */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-muted-foreground text-xs">
                他のレイヤー
              </span>
              {otherLayersWithMappings.length > 1 && (
                <button
                  className="cursor-pointer font-medium text-primary text-xs hover:underline"
                  onClick={toggleAllOtherLayers}
                  type="button"
                >
                  {isAllOtherSelected ? "すべて解除" : "すべて選択"}
                </button>
              )}
            </div>

            {otherLayersWithMappings.length > 0 ? (
              <div className="flex max-h-44 flex-col gap-1.5 overflow-y-auto pr-0.5">
                {otherLayersWithMappings.map((layer) => {
                  const isChecked = selectedLayerIds.includes(layer.id);
                  const count = layer.bindings[target.fromVk]?.length ?? 0;
                  const hasTargetConflict = Boolean(
                    layer.bindings[target.toVk]?.length
                  );
                  return (
                    <label
                      className="flex cursor-pointer items-center justify-between rounded-lg border bg-muted/30 p-2.5 transition-colors hover:bg-muted/50"
                      htmlFor={`layer-checkbox-${layer.id}`}
                      key={layer.id}
                    >
                      <div className="flex items-center gap-2.5">
                        <Checkbox
                          checked={isChecked}
                          id={`layer-checkbox-${layer.id}`}
                          onCheckedChange={() => toggleLayer(layer.id)}
                        />
                        <span className="font-medium text-foreground text-sm">
                          {layer.id}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground text-xs">
                          {count} 件の設定
                        </span>
                        {hasTargetConflict && (
                          <Badge
                            className="border-amber-500/30 bg-amber-500/20 text-[10px] text-amber-600 dark:text-amber-400"
                            variant="accent"
                          >
                            上書き
                          </Badge>
                        )}
                      </div>
                    </label>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-lg border border-dashed p-2.5 text-center text-muted-foreground text-xs">
                他のレイヤーにはこのキーのリマップは設定されていません
              </div>
            )}
          </div>

          <Show condition={selectedLayerIds.length === 0}>
            <p className="text-center text-destructive text-xs">
              ※ 移動対象のレイヤーを1つ以上選択してください
            </p>
          </Show>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel}>キャンセル</AlertDialogCancel>
          <AlertDialogAction
            disabled={selectedLayerIds.length === 0}
            onClick={handleConfirm}
          >
            変更する
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
