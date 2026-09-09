// レイヤースタック状態を取得・監視するフック

import { useCallback, useEffect, useState } from "react";
import { useIpc, useIpcEvent } from "@/hooks/api/useIpc";

export interface UseLayerStackReturn {
  /** 現在のレイヤースタック */
  stack: string[];
  /** 手動でスタックを再取得 */
  refresh: () => void;
  /** 指定レイヤーに強制リセット */
  resetToLayer: (layerId: string) => void;
}

/**
 * レイヤースタック状態を取得・監視するフック
 * - イベント購読でリアルタイム更新
 * - 手動リフレッシュも可能
 */
export function useLayerStack(): UseLayerStackReturn {
  const { send, invoke } = useIpc();
  const [stack, setStack] = useState<UseLayerStackReturn["stack"]>(["base"]);

  // 初期取得
  const refresh = useCallback<UseLayerStackReturn["refresh"]>(() => {
    invoke<string[]>("get-layer-stack").then((result) => {
      if (result) {
        setStack(result);
      }
    });
  }, [invoke]);

  // 初期化時に取得
  useEffect(() => {
    refresh();
  }, [refresh]);

  // レイヤー変更イベントを購読
  useIpcEvent("layer-stack-changed", (payload: unknown) => {
    if (Array.isArray(payload)) {
      setStack(payload);
    } else if (payload && typeof payload === "object" && "stack" in payload) {
      const data = payload as { stack: string[] };
      if (Array.isArray(data.stack)) {
        setStack(data.stack);
      }
    }
  });

  // 指定レイヤーに強制リセット
  const resetToLayer = useCallback<UseLayerStackReturn["resetToLayer"]>(
    (layerId) => {
      send("reset-layer", { layerId });
      // 楽観的更新
      setStack([layerId]);
    },
    [send]
  );

  return {
    stack,
    refresh,
    resetToLayer,
  };
}
