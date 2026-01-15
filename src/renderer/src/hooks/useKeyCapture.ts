import { MAX_VK_CODE, MIN_VK_CODE } from "@shared/constants/vk";
import { useCallback, useState } from "react";

export interface UseKeyCaptureReturn {
  // keys は Props から渡されるため、戻り値には含めない（あるいは透過させる）
  holds: number[];
  inputKey: (vk: number) => void; // addKey 相当だが、直接追加ではなく入力イベントとして扱う
  removeKey: (vk: number) => void;
  onKeyDown: (vkCode: number) => void;
  onKeyUp: (vkCode: number) => void;
  reset: () => void;
}

export interface UseKeyCaptureProps {
  currentKeys?: number[];
  onKeysChange?: (keys: number[]) => void;
}

/**
 * キーキャプチャのロジック（同時押し・連続押し管理）を抽出したフック
 * ステートレス（Controlled）になり、keys の管理は親に委譲する
 */
export function useKeyCapture({
  currentKeys = [],
  onKeysChange,
}: UseKeyCaptureProps = {}): UseKeyCaptureReturn {
  // console.log("[DEBUG] useKeyCapture - render", { currentKeys });
  const [holds, setHolds] = useState<number[]>([]);

  // 変更通知ヘルパー
  const notifyChange = useCallback(
    (newKeys: number[]) => {
      // console.log("[DEBUG] useKeyCapture - notify change", { newKeys });
      onKeysChange?.(newKeys);
    },
    [onKeysChange]
  );

  const inputKey = useCallback(
    (vk: number) => {
      if (vk >= MIN_VK_CODE && vk <= MAX_VK_CODE) {
        if (currentKeys.includes(vk)) {
          return;
        }
        const next = [...currentKeys, vk];
        notifyChange(next);
      }
    },
    [currentKeys, notifyChange]
  );

  const removeKey = useCallback(
    (vk: number) => {
      const next = currentKeys.filter((k) => k !== vk);
      if (next.length !== currentKeys.length) {
        notifyChange(next);
      }
      setHolds((prev) => prev.filter((k) => k !== vk));
    },
    [currentKeys, notifyChange]
  );

  const onKeyDown = useCallback(
    (vkCode: number) => {
      setHolds((prev) => [...prev.filter((k) => k !== vkCode), vkCode]);

      // 何も押されていない状態からの最初のキーなら置き換え、そうでなければ追加
      let next: number[];
      if (holds.length === 0) {
        next = [vkCode];
      } else {
        next = currentKeys.includes(vkCode)
          ? currentKeys
          : [...currentKeys, vkCode];
      }

      if (JSON.stringify(next) !== JSON.stringify(currentKeys)) {
        notifyChange(next);
      }
    },
    [holds.length, currentKeys, notifyChange]
  );

  const onKeyUp = useCallback((vkCode: number) => {
    setHolds((prev) => prev.filter((k) => k !== vkCode));
  }, []);

  const reset = useCallback(() => {
    setHolds([]);
    notifyChange([]);
  }, [notifyChange]);

  return {
    holds,
    inputKey,
    removeKey,
    onKeyDown,
    onKeyUp,
    reset,
  };
}
