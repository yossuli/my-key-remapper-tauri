import { useCallback } from "react";

/**
 * マウスカーソル位置を取得するフック
 */
export function useMousePosition() {
  const getCursorPosition = useCallback(async (): Promise<{
    x: number;
    y: number;
  }> => {
    try {
      const position = await window.electron?.ipcRenderer.invoke(
        "get-cursor-position"
      );
      return position as { x: number; y: number };
    } catch (error) {
      console.error("Failed to get cursor position:", error);
      return { x: 0, y: 0 };
    }
  }, []);

  return { getCursorPosition };
}
