// リマップ有効/無効の制御フック

import { useCallback, useState } from "react";
import { useIpc } from "@/hooks/api/useIpc";

export interface UseRemapControlReturn {
  isActive: boolean;
  setIsActive: (active: boolean) => void;
  toggleActive: () => void;
  setRemapEnabled: (enabled: boolean) => void;
  enableRemap: () => void;
  disableRemap: () => void;
}

// リマップ制御の基本状態
export type RemapState = Pick<UseRemapControlReturn, "isActive">;

// リマップ制御のアクション
export type RemapActions = Pick<
  UseRemapControlReturn,
  "toggleActive" | "enableRemap" | "disableRemap"
>;

// リマップ制御の全体
export type RemapControl = RemapState & RemapActions;

/**
 * リマップ機能の有効/無効を制御するカスタムフック
 */
export function useRemapControl(): UseRemapControlReturn {
  const { send } = useIpc();
  const [isActive, setIsActiveState] =
    useState<UseRemapControlReturn["isActive"]>(true);

  const setRemapEnabled = useCallback<UseRemapControlReturn["setRemapEnabled"]>(
    (enabled) => {
      send("set-remap-enabled", { enabled });
    },
    [send]
  );

  const disableRemap = useCallback<
    UseRemapControlReturn["disableRemap"]
  >(() => {
    setRemapEnabled(false);
  }, [setRemapEnabled]);

  const enableRemap = useCallback<UseRemapControlReturn["enableRemap"]>(() => {
    setRemapEnabled(true);
  }, [setRemapEnabled]);

  const toggleActive = useCallback<
    UseRemapControlReturn["toggleActive"]
  >(() => {
    setIsActiveState((prev) => !prev);
  }, []);

  const setIsActive = useCallback<UseRemapControlReturn["setIsActive"]>(
    (active) => {
      setIsActiveState(active);
    },
    []
  );

  return {
    isActive,
    setIsActive,
    toggleActive,
    setRemapEnabled,
    enableRemap,
    disableRemap,
  };
}
