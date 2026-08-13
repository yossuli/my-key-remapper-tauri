import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

interface ScreenSize {
  width: number;
  height: number;
}

/**
 * 画面解像度を取得するフック
 */
export function useScreenSize(): ScreenSize | null {
  const [screenSize, setScreenSize] = useState<ScreenSize | null>(null);

  useEffect(() => {
    const getScreenSize = async (): Promise<void> => {
      try {
        const size = await invoke<ScreenSize>("get-screen-size");
        setScreenSize(size);
      } catch (error) {
        console.error("Failed to get screen size:", error);
        // エラー時もデフォルト値を設定
        setScreenSize({ width: 1920, height: 1080 });
      }
    };

    getScreenSize();
  }, []);

  return screenSize;
}
