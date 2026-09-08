import { invoke as tauriInvoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { useCallback, useEffect, useRef } from "react";
import { isMockMode } from "@/mock/isMock";
import { mockInvoke, mockListen, mockSend } from "@/mock/mockIpc";

// biome-ignore lint/suspicious/noExplicitAny: IPCコールバック引数は動的
type IpcCallback = (payload: any) => void;

export interface UseIpcReturn {
  // biome-ignore lint/suspicious/noExplicitAny: IPC引数は動的
  send: (channel: string, payload?: any) => Promise<void>;
  invoke: <T = unknown>(
    channel: string,
    // biome-ignore lint/suspicious/noExplicitAny: IPC引数は動的
    args?: Record<string, any>
  ) => Promise<T | undefined>;
  on: (channel: string, callback: IpcCallback) => Promise<UnlistenFn>;
  isAvailable: boolean;
  isMock: boolean;
}

/**
 * IPC通信用のカスタムフック
 * Tauri実環境またはブラウザモック環境を自動判別して通信をハンドリング
 */
export function useIpc(): UseIpcReturn {
  const isMock = isMockMode();
  const isAvailable = true;

  const send = useCallback(
    // biome-ignore lint/suspicious/noExplicitAny: IPC引数は動的
    async (channel: string, payload?: any) => {
      if (isMock) {
        await mockSend(channel, payload);
        return;
      }

      if (payload) {
        await tauriInvoke(channel, payload);
      } else {
        await tauriInvoke(channel);
      }
    },
    [isMock]
  );

  const invoke = useCallback(
    async <T = unknown>(
      channel: string,
      // biome-ignore lint/suspicious/noExplicitAny: IPC引数は動的
      args?: Record<string, any>
    ): Promise<T | undefined> => {
      if (isMock) {
        return await mockInvoke<T>(channel, args);
      }
      return await tauriInvoke<T>(channel, args);
    },
    [isMock]
  );

  const on = useCallback(
    async (channel: string, callback: IpcCallback): Promise<UnlistenFn> => {
      if (isMock) {
        const unlisten = mockListen(channel, (event) => {
          callback(event.payload);
        });
        return () => {
          unlisten();
        };
      }
      return await listen(channel, (event) => {
        callback(event.payload);
      });
    },
    [isMock]
  );

  return { send, invoke, on, isAvailable, isMock };
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
