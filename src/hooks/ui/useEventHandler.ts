// イベントリスナーの登録・解除を管理するフック

import { useEffect } from "react";

type EventMapKey = keyof WindowEventMap;
type EventHandler<K extends EventMapKey> = (e: WindowEventMap[K]) => void;

interface EventHandlerConfig<K extends EventMapKey> {
  /** イベントタイプ（例: "keydown", "click" など） */
  type: K;
  /** イベントハンドラー */
  handler: EventHandler<K>;
}

interface UseEventHandlerOptions {
  /** イベントリスナーを有効化するかどうか */
  enabled?: boolean;
}

/**
 * windowへのイベントリスナー登録を管理するフック
 * コンポーネントのマウント時に登録し、アンマウント時に解除する
 */
export function useEventHandler<K extends EventMapKey>(
  configs: EventHandlerConfig<K>[],
  deps: React.DependencyList,
  options: UseEventHandlerOptions = {}
): void {
  const { enabled = true } = options;

  useEffect(() => {
    if (!enabled) {
      return;
    }

    // イベントリスナーを登録
    for (const config of configs) {
      window.addEventListener(config.type, config.handler as EventListener);
    }

    // クリーンアップ：イベントリスナーを解除
    return () => {
      for (const config of configs) {
        window.removeEventListener(
          config.type,
          config.handler as EventListener
        );
      }
    };
  }, [enabled, ...deps, configs]);
}
