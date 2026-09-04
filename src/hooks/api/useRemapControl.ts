// リマップ有効/無効の制御フック

import { useCallback, useEffect, useSyncExternalStore } from "react";
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

// モジュールレベルで共有される状態とリスナー
let globalIsActive = true;
const listeners = new Set<() => void>();

function emitChange() {
  for (const listener of listeners) {
    listener();
  }
}

function setGlobalIsActive(next: boolean) {
  if (globalIsActive !== next) {
    globalIsActive = next;
    emitChange();
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot() {
  return globalIsActive;
}

/**
 * リマップ機能の有効/無効を制御するカスタムフック
 */
export function useRemapControl(): UseRemapControlReturn {
  const { send, invoke } = useIpc();
  const isActive = useSyncExternalStore(subscribe, getSnapshot);

  // 初回マウント時にバックエンドから状態を同期
  useEffect(() => {
    let isMounted = true;
    invoke<boolean>("get-remap-enabled")
      .then((res) => {
        if (isMounted && typeof res === "boolean") {
          setGlobalIsActive(res);
        }
      })
      .catch(() => {
        // エラー時はフォールバックとして現在の状態を維持
      });

    return () => {
      isMounted = false;
    };
  }, [invoke]);

  const setRemapEnabled = useCallback<UseRemapControlReturn["setRemapEnabled"]>(
    (enabled) => {
      send("set-remap-enabled", { enabled });
      setGlobalIsActive(enabled);
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
    setRemapEnabled(!globalIsActive);
  }, [setRemapEnabled]);

  const setIsActive = useCallback<UseRemapControlReturn["setIsActive"]>(
    (active) => {
      setRemapEnabled(active);
    },
    [setRemapEnabled]
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
