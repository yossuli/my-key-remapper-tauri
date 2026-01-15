// IPC経由でキーイベントを受け取るフック

import { useCallback, useEffect, useRef } from "react";
import { useIpcEvent } from "@/hooks/api/useIpc";

interface UseKeyEventInputOptions {
  /** フックが有効かどうか */
  enabled: boolean;
  /** キーダウン時のコールバック */
  onKeyDown?: (vkCode: number) => void;
  /** キーアップ時のコールバック */
  onKeyUp?: (vkCode: number) => void;
}

interface KeyEventData {
  vkCode: number;
  isUp: boolean;
}

/**
 * IPC経由でキーイベントを受け取るフック
 * mainプロセスから送られる正確なvkCodeを使用する
 */
export function useKeyEventInput({
  enabled,
  onKeyDown,
  onKeyUp,
}: UseKeyEventInputOptions): void {
  // コールバックの参照を保持（再レンダリング時のリスナー再登録を防ぐ）
  const onKeyDownRef = useRef(onKeyDown);
  const onKeyUpRef = useRef(onKeyUp);
  const enabledRef = useRef(enabled);

  useEffect(() => {
    onKeyDownRef.current = onKeyDown;
    onKeyUpRef.current = onKeyUp;
    enabledRef.current = enabled;
    return () => {
      onKeyDownRef.current = undefined;
      onKeyUpRef.current = undefined;
      enabledRef.current = false;
    };
  }, [onKeyDown, onKeyUp, enabled]);

  const handleKeyEvent = useCallback((...args: unknown[]) => {
    if (!enabledRef.current) {
      return;
    }

    const data = args[1] as KeyEventData;
    if (data.isUp) {
      onKeyUpRef.current?.(data.vkCode);
    } else {
      onKeyDownRef.current?.(data.vkCode);
    }
  }, []);

  useIpcEvent("key-event", handleKeyEvent);
}
