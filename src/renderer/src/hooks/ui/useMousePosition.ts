import { useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";

/**
 * マウスカーソル位置を取得するフック
 */
export function useMousePosition() {
  const getCursorPosition = useCallback(async (): Promise<{
    x: number;
    y: number;
  }> => {
    try {
      const position = await invoke<{x: number; y: number}>("get-cursor-position");
      return position;
    } catch (error) {
      console.error("Failed to get cursor position:", error);
      return { x: 0, y: 0 };
    }
  }, []);

  return { getCursorPosition };
}
