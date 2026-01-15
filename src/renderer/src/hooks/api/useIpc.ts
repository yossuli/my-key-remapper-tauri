// IPC通信をカプセル化するカスタムフック
// window.electron?.ipcRendererへの直接アクセスを隠蔽

import { useCallback, useEffect, useRef } from "react";

type IpcCallback = (...args: unknown[]) => void;

interface UseIpcReturn {
  // biome-ignore lint/suspicious/noExplicitAny: IPC引数は動的
  send: (channel: string, ...args: any[]) => void;
  invoke: <T = unknown>(
    channel: string,
    // biome-ignore lint/suspicious/noExplicitAny: IPC引数は動的
    ...args: any[]
  ) => Promise<T | undefined>;
  on: (channel: string, callback: IpcCallback) => void;
  off: (channel: string, callback: IpcCallback) => void;
  isAvailable: boolean;
}

/**
 * IPC通信用のカスタムフック
 * Electronの有無に関わらず安全に使用可能
 */
export function useIpc(): UseIpcReturn {
  const ipc = window.electron?.ipcRenderer;

  const send = useCallback(
    // biome-ignore lint/suspicious/noExplicitAny: IPC引数は動的
    (channel: string, ...args: any[]) => {
      ipc?.send(channel, ...args);
    },
    [ipc]
  );

  const invoke = useCallback(
    async <T = unknown>(
      channel: string,
      // biome-ignore lint/suspicious/noExplicitAny: IPC引数は動的
      ...args: any[]
    ): Promise<T | undefined> => ipc?.invoke(channel, ...args),
    [ipc]
  );

  const on = useCallback(
    (channel: string, callback: IpcCallback) => {
      ipc?.on(channel, callback);
    },
    [ipc]
  );

  const off = useCallback(
    (channel: string, callback: IpcCallback) => {
      ipc?.off(channel, callback);
    },
    [ipc]
  );

  return { send, invoke, on, off, isAvailable: !!ipc };
}

/**
 * IPCイベントのサブスクリプション用フック
 * マウント時に自動でon/offを管理
 */
export function useIpcEvent(channel: string, callback: IpcCallback): void {
  const { on, off } = useIpc();
  const callbackRef = useRef(callback);

  // コールバックの参照を最新に保つ
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    const handler: IpcCallback = (...args) => {
      callbackRef.current(...args);
    };

    on(channel, handler);
    return () => {
      off(channel, handler);
    };
  }, [channel, on, off]);
}
