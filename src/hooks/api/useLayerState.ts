// レイヤー状態とマッピング管理のカスタムフック

import { useCallback, useEffect, useMemo, useState } from "react";
import { useIpc } from "@/hooks/api/useIpc";
import type { Action, Layer, TriggerType } from "@/types/remapConfig";
import { remove, upsert } from "@/utils/handleMapping";

const REFRESH_DELAY_MS = 100;

export interface UseLayerStateReturn {
  layers: Layer[];
  layerOrder: string[]; // 追加
  layerId: string;
  setLayerId: React.Dispatch<React.SetStateAction<string>>;
  currentBindings: Layer["bindings"];
  addLayer: (newLayerId: string) => void;
  removeLayer: (targetLayerId: string) => void;
  reorderLayers: (newOrder: string[]) => void; // 追加
  saveMapping: (
    from: number,
    selectedTrigger: TriggerType
  ) => (
    action: Action,
    timing?: {
      hold?: number;
      doubleTap?: number;
      interruptBehavior?: "forceTap" | "forceHold" | "ignore";
    },
    activeTrigger?: TriggerType
  ) => void;
  removeMapping: (from: number, trigger: TriggerType) => void;
  moveMappings: (
    fromVk: number,
    toVk: number,
    targetLayerIds: string[]
  ) => void;
  updateLayer: (layerId: string, updates: Partial<Layer>) => void; // 追加
  reloadLayers: () => Promise<void>; // 追加
}

/**
 * レイヤーとマッピングを管理するカスタムフック
 */
export function useLayerState(): UseLayerStateReturn {
  const { send, invoke } = useIpc();
  const [layers, setLayers] = useState<UseLayerStateReturn["layers"]>([]);
  const [layerId, setLayerId] =
    useState<UseLayerStateReturn["layerId"]>("base");
  const [layerOrder, setLayerOrder] = useState<
    UseLayerStateReturn["layerOrder"]
  >([]); // 追加

  // 初期化：マッピングを取得
  const loadLayers = useCallback(async () => {
    const initial = await invoke<{ layers: Layer[]; layerOrder: string[] }>(
      "get-mappings"
    );
    if (initial) {
      setLayers(initial.layers);
      setLayerOrder(initial.layerOrder);
    }
  }, [invoke]);

  useEffect(() => {
    loadLayers();
  }, [loadLayers]);

  // レイヤー追加
  const addLayer = useCallback<UseLayerStateReturn["addLayer"]>(
    (newLayerId) => {
      send("add-layer", { layerId: newLayerId });
      // 楽観的更新
      setLayers((prev) => [...prev, { id: newLayerId, bindings: {} }]);
      setLayerOrder((prev) => [...prev, newLayerId]);
    },
    [send]
  );

  // レイヤー削除
  const removeLayer = useCallback<UseLayerStateReturn["removeLayer"]>(
    (targetLayerId) => {
      if (targetLayerId === "base") {
        console.warn("baseレイヤーは削除できません。");
        return;
      }
      send("remove-layer", { layerId: targetLayerId });
      // 楽観的更新
      setLayers((prev) => prev.filter((l) => l.id !== targetLayerId));
      setLayerOrder((prev) => prev.filter((id) => id !== targetLayerId));
      // 削除したレイヤーが選択中だった場合はbaseに戻す
      setLayerId((prev) => (prev === targetLayerId ? "base" : prev));
    },
    [send]
  );

  // レイヤー並べ替え
  const reorderLayers = useCallback<UseLayerStateReturn["reorderLayers"]>(
    (newOrder) => {
      send("reorder-layers", { newOrder });
      // 楽観的更新
      setLayerOrder(newOrder);
    },
    [send]
  );

  // マッピング保存
  const saveMapping = useCallback<UseLayerStateReturn["saveMapping"]>(
    (from, selectedTrigger) => (action, timing, activeTrigger) => {
      // triggerに応じたtimingMsを決定
      const trigger = activeTrigger || selectedTrigger;
      let timingMs: number | undefined;
      if (trigger === "hold") {
        timingMs = timing?.hold;
      } else if (trigger === "doubleTap") {
        timingMs = timing?.doubleTap;
      }
      const interruptBehavior =
        trigger === "hold" ? timing?.interruptBehavior : undefined;

      send("save-key-config", {
        layerId,
        from,
        binding: { trigger, action, timingMs, interruptBehavior },
      });
      // 楽観的更新
      setLayers(upsert(layerId, from, trigger, action));
      // 設定が変更された場合は再読み込みしてUIを更新
      setTimeout(() => {
        loadLayers();
      }, REFRESH_DELAY_MS);
    },
    [send, layerId, loadLayers]
  );

  // マッピング削除
  const removeMapping = useCallback<UseLayerStateReturn["removeMapping"]>(
    (from, trigger) => {
      send("remove-binding", { layerId, from, trigger });
      // 楽観的更新
      setLayers(remove(layerId, from, trigger));
    },
    [send, layerId]
  );

  // マッピング移動（D&D用）
  const moveMappings = useCallback<UseLayerStateReturn["moveMappings"]>(
    (fromVk, toVk, targetLayerIds) => {
      send("move-key-mappings", { fromVk, toVk, layerIds: targetLayerIds });
      // 楽観的更新
      setLayers((prev) =>
        prev.map((layer) => {
          if (!(targetLayerIds.includes(layer.id) && layer.bindings[fromVk])) {
            return layer;
          }
          const sourceBindings = layer.bindings[fromVk];
          const { [fromVk]: _, ...remainingBindings } = layer.bindings;
          return {
            ...layer,
            bindings: {
              ...remainingBindings,
              [toVk]: sourceBindings,
            },
          };
        })
      );
      setTimeout(() => {
        loadLayers();
      }, REFRESH_DELAY_MS);
    },
    [send, loadLayers]
  );

  // レイヤーをlayerOrderに基づいてソート
  const sortedLayers = useMemo(() => {
    if (layerOrder.length === 0) {
      return layers;
    }

    // layerOrderのインデックスをマップ化
    const orderMap = new Map(layerOrder.map((id, index) => [id, index]));

    return [...layers].sort((a, b) => {
      const ia = orderMap.get(a.id) ?? Number.MAX_SAFE_INTEGER;
      const ib = orderMap.get(b.id) ?? Number.MAX_SAFE_INTEGER;
      return ia - ib;
    });
  }, [layers, layerOrder]);

  // 現在のレイヤーのバインディング
  const currentBindings =
    sortedLayers.find((l) => l.id === layerId)?.bindings ?? {};

  // レイヤー更新
  const updateLayer = useCallback(
    (targetLayerId: string, updates: Partial<Layer>) => {
      send("update-layer", { layerId: targetLayerId, updates });
      // 楽観的更新
      setLayers((prev) =>
        prev.map((l) => (l.id === targetLayerId ? { ...l, ...updates } : l))
      );
    },
    [send]
  );

  return {
    layers: sortedLayers,
    layerOrder,
    layerId,
    setLayerId,
    currentBindings,
    addLayer,
    removeLayer,
    updateLayer,
    reorderLayers,
    saveMapping,
    removeMapping,
    moveMappings,
    reloadLayers: loadLayers,
  };
}
