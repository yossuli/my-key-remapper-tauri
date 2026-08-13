import { MAX_VK_CODE, MIN_VK_CODE } from "@/constants/vk";
import { useCallback, useState } from "react";

export interface UseKeyCaptureReturn {
  holds: number[];
  inputKey: (vk: number) => void;
  removeKey: (vk: number) => void;
  onKeyDown: (vkCode: number) => void;
  onKeyUp: (vkCode: number) => void;
  reset: () => void;
}

export interface UseKeyCaptureProps {
  currentKeys?: number[];
  onKeysChange?: (keys: number[]) => void;
}

export function useKeyCapture({
  currentKeys = [],
  onKeysChange,
}: UseKeyCaptureProps = {}): UseKeyCaptureReturn {
  const [holds, setHolds] = useState<number[]>([]);

  const notifyChange = useCallback(
    (newKeys: number[]) => {
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
