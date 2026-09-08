import { useEffect, useState } from "react";
import { useIpc } from "@/hooks/api/useIpc";

interface ScreenSize {
  width: number;
  height: number;
}

const DEFAULT_SCREEN_WIDTH = 1920;
const DEFAULT_SCREEN_HEIGHT = 1080;

/**
 * 画面解像度を取得するフック
 */
export function useScreenSize(): ScreenSize | null {
  const { invoke } = useIpc();
  const [screenSize, setScreenSize] = useState<ScreenSize | null>(null);

  useEffect(() => {
    const getScreenSize = async (): Promise<void> => {
      try {
        const size = await invoke<ScreenSize>("get-screen-size");
        setScreenSize(
          size ?? { width: DEFAULT_SCREEN_WIDTH, height: DEFAULT_SCREEN_HEIGHT }
        );
      } catch (error) {
        console.error("Failed to get screen size:", error);
        // エラー時もデフォルト値を設定
        setScreenSize({
          width: DEFAULT_SCREEN_WIDTH,
          height: DEFAULT_SCREEN_HEIGHT,
        });
      }
    };

    getScreenSize();
  }, [invoke]);

  return screenSize;
}
