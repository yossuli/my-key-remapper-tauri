// 押下中のキーを表示するパネルコンポーネント

import { RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/atoms/Button";
import { HandleEmpty } from "@/components/control/HandleEmpty";
import { Show } from "@/components/control/Show";
import { VStack } from "@/components/template/Flex";
import { useGetPressedKeys, useReleaseAllKeys } from "@/hooks/api/useInvoke";
import type { LayoutType } from "@/types";
import { getKeyLabel } from "@/utils/getKeyLabel";

interface PressedKeysPanelProps {
  /** キーボードレイアウト */
  layout: LayoutType;
  /** 自動更新間隔（ミリ秒）。0で無効 */
  autoRefreshMs?: number;
}

/**
 * 押下中のキーを表示するパネル
 * - 現在押下中のキーをリアルタイム表示
 * - 一括リリースボタン
 */
export function PressedKeysPanel({
  layout, // 🆕 → 🔥 (F. Pressed Keys Panel)
  autoRefreshMs = 1000,
}: PressedKeysPanelProps) {
  const getPressedKeys = useGetPressedKeys();
  const releaseAllKeys = useReleaseAllKeys();
  const [pressedKeys, setPressedKeys] = useState<number[]>([]);

  // キー取得
  const refresh = useCallback(() => {
    getPressedKeys().then((result) => {
      if (result) {
        setPressedKeys(result);
      }
    });
  }, [getPressedKeys]);

  // 初期取得と自動更新
  useEffect(() => {
    refresh();
    if (autoRefreshMs > 0) {
      const interval = setInterval(refresh, autoRefreshMs);
      return () => clearInterval(interval);
    }
  }, [refresh, autoRefreshMs]);

  // 一括リリース
  const handleReleaseAll = useCallback(() => {
    releaseAllKeys().then(() => {
      setPressedKeys([]);
    });
  }, [releaseAllKeys]);

  return (
    <VStack className="rounded-lg border border-border bg-card p-4" gap={3}>
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm">押下中のキー</h3>
        <Button onClick={refresh} variant="ghost">
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>
      <div className="flex flex-wrap gap-2">
        <HandleEmpty
          array={pressedKeys.map((vk) => ({ id: vk }))}
          empty={
            <div className="w-full py-2 text-center font-medium text-muted-foreground text-xs">
              押されているキーはありません
            </div>
          }
        >
          {({ id: vk }) => (
            <div
              className="rounded bg-destructive/10 px-2 py-1 font-mono text-destructive text-xs ring-1 ring-destructive/20"
              key={vk}
            >
              {getKeyLabel([vk], layout)}
            </div>
          )}
        </HandleEmpty>
      </div>
      <Show condition={pressedKeys.length > 0}>
        <Button
          className="w-full"
          label="すべてリリース"
          onClick={handleReleaseAll}
          variant="destructive"
        />
      </Show>
    </VStack>
  );
}
