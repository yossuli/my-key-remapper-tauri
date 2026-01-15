import { useEffect, useState } from "react";

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
        // Electron環境でのみ画面サイズを取得
        if (window.electron?.ipcRenderer) {
          const size =
            await window.electron.ipcRenderer.invoke("get-screen-size");
          setScreenSize(size);
        } else {
          // ブラウザ環境ではデフォルト値を使用(AIがブラウザでUIを確認するときに使用)
          console.warn(
            "Running in browser environment, using default screen size"
          );
          setScreenSize({ width: 1920, height: 1080 });
        }
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
