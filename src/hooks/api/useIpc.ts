import { invoke as tauriInvoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { useCallback, useEffect, useRef } from "react";

// biome-ignore lint/suspicious/noExplicitAny: IPCコールバック引数は動的
type IpcCallback = (payload: any) => void;

interface UseIpcReturn {
  // biome-ignore lint/suspicious/noExplicitAny: IPC引数は動的
  send: (channel: string, payload?: any) => Promise<void>;
  invoke: <T = unknown>(
    channel: string,
    // biome-ignore lint/suspicious/noExplicitAny: IPC引数は動的
    args?: Record<string, any>
  ) => Promise<T | undefined>;
  on: (channel: string, callback: IpcCallback) => Promise<UnlistenFn>;
  isAvailable: boolean;
}

/**
 * IPC通信用のカスタムフック
 * Tauri環境で使用
 */
export function useIpc(): UseIpcReturn {
  const isAvailable = true; // Tauri is generally available

  const send = useCallback(
    // biome-ignore lint/suspicious/noExplicitAny: IPC引数は動的
    async (channel: string, payload?: any) => {
      // In Tauri, we can emit events to the backend, or just invoke a command.
      // If we are calling a rust command that does not return, we can use invoke.
      // Let's map send to invoke if we assume it's a backend command,
      // or emit if it's an event. For compatibility we'll use invoke.
      if (payload) {
        await tauriInvoke(channel, payload);
      } else {
        await tauriInvoke(channel);
      }
    },
    []
  );

  const invoke = useCallback(
    async <T = unknown>(
      channel: string,
      // biome-ignore lint/suspicious/noExplicitAny: IPC引数は動的
      args?: Record<string, any>
    ): Promise<T | undefined> => await tauriInvoke<T>(channel, args),
    []
  );

  const on = useCallback(
    async (channel: string, callback: IpcCallback) =>
      await listen(channel, (event) => {
        callback(event.payload);
      }),
    []
  );

  return { send, invoke, on, isAvailable };
}

export function useIpcEvent(channel: string, callback: IpcCallback): void {
  const { on } = useIpc();
  const callbackRef = useRef(callback);

  // コールバックの参照を最新に保つ
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    let unlisten: UnlistenFn | undefined;
    let isMounted = true;

    const setup = async () => {
      const fn = await on(channel, (payload) => {
        callbackRef.current(payload);
      });
      if (isMounted) {
        unlisten = fn;
      } else {
        fn();
      }
    };

    setup();

    return () => {
      isMounted = false;
      if (unlisten) {
        unlisten();
      }
    };
  }, [channel, on]);
}
