// DOMのKeyboardEvent経由でキーイベントを受け取るフック（設定UIでの生キー取得用）
import { useEffect, useRef } from "react";
import { getVkCode } from "@/utils/keyboard";

interface UseKeyEventInputOptions {
  onKeyDown?: (vkCode: number) => void;
  onKeyUp?: (vkCode: number) => void;
  enabled?: boolean;
}

export function useKeyEventInput({
  onKeyDown,
  onKeyUp,
  enabled = true,
}: UseKeyEventInputOptions) {
  const onKeyDownRef = useRef(onKeyDown);
  const onKeyUpRef = useRef(onKeyUp);
  const enabledRef = useRef(enabled);

  useEffect(() => {
    onKeyDownRef.current = onKeyDown;
    onKeyUpRef.current = onKeyUp;
    enabledRef.current = enabled;
  }, [onKeyDown, onKeyUp, enabled]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!enabledRef.current) {
        return;
      }
      e.preventDefault();
      const vkCode = getVkCode(e);
      onKeyDownRef.current?.(vkCode);
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (!enabledRef.current) {
        return;
      }
      e.preventDefault();
      const vkCode = getVkCode(e);
      onKeyUpRef.current?.(vkCode);
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, []);
}
