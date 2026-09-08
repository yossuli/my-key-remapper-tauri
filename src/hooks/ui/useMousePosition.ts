import { useCallback } from "react";
import { useIpc } from "@/hooks/api/useIpc";

/**
 * マウスカーソル位置を取得するフック
 */
export function useMousePosition() {
  const { invoke } = useIpc();

  const getCursorPosition = useCallback(async (): Promise<{
    x: number;
    y: number;
  }> => {
    try {
      const position = await invoke<{ x: number; y: number }>(
        "get-cursor-position"
      );
      return position ?? { x: 0, y: 0 };
    } catch (error) {
      console.error("Failed to get cursor position:", error);
      return { x: 0, y: 0 };
    }
  }, [invoke]);

  return { getCursorPosition };
}
