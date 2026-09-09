import { useEffect, useMemo, useState } from "react";
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
  const [includeOtherLayers, setIncludeOtherLayers] = useState(false);

  // 他のレイヤーで移動元キーにリマップが設定されているレイヤー
  const otherLayersWithMappings = useMemo(() => {
    if (!target) {
      return [];
    }
    return layers.filter(
      (l) =>
        l.id !== currentLayerId && Boolean(l.bindings[target.fromVk]?.length)
    );
  }, [layers, currentLayerId, target]);

  // モーダルオープン時に初期値を設定
  useEffect(() => {
    if (target) {
      const currentLayer = layers.find((l) => l.id === currentLayerId);
      const hasCurrent = Boolean(currentLayer?.bindings[target.fromVk]?.length);
      // 現在のレイヤーにリマップがなく他レイヤーにある場合はデフォルトでチェックをONにする
      setIncludeOtherLayers(!hasCurrent && otherLayersWithMappings.length > 0);
    }
  }, [target, layers, currentLayerId, otherLayersWithMappings.length]);

  // 移動先のキーにすでにリマップが存在するかどうか
  const hasExistingMappingOnTarget = useMemo(() => {
    if (!target) {
      return false;
    }
    const currentLayer = layers.find((l) => l.id === currentLayerId);
    return Boolean(currentLayer?.bindings[target.toVk]?.length);
  }, [layers, currentLayerId, target]);

  const isOpen = target !== null;

  const handleConfirm = () => {
    if (!target) {
      return;
    }
    const targetLayerIds = includeOtherLayers
      ? layers.map((l) => l.id)
      : [currentLayerId];
    onConfirm(target.fromVk, target.toVk, targetLayerIds);
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
            キーリマップの割り当てを変更します。
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="flex flex-col gap-4 py-2">
          <p className="text-center font-medium text-foreground text-sm">
            本当に変更しますか？
          </p>

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

          <Show condition={hasExistingMappingOnTarget}>
            <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-2.5 text-amber-600 text-xs dark:text-amber-400">
              ⚠️ 移動先キー「{target.toLabel}
              」に設定されている既存のリマップは上書きされます。
            </div>
          </Show>

          <div className="flex items-start gap-3 rounded-lg border bg-muted/30 p-3">
            <Checkbox
              checked={includeOtherLayers}
              id="include-other-layers"
              onCheckedChange={(checked) =>
                setIncludeOtherLayers(checked === true)
              }
            />
            <div className="grid gap-1">
              <label
                className="cursor-pointer font-medium text-foreground text-sm leading-none"
                htmlFor="include-other-layers"
              >
                他のレイヤーのリマップについても一緒に移動する
              </label>
              <p className="text-muted-foreground text-xs leading-relaxed">
                {otherLayersWithMappings.length > 0 ? (
                  <>
                    他のレイヤーにもリマップ設定があります:{" "}
                    <span className="font-semibold text-foreground">
                      {otherLayersWithMappings.map((l) => l.id).join(", ")}
                    </span>
                  </>
                ) : (
                  "（他のレイヤーにはこのキーのリマップは設定されていません）"
                )}
              </p>
            </div>
          </div>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel}>キャンセル</AlertDialogCancel>
          <AlertDialogAction onClick={handleConfirm}>
            変更する
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
