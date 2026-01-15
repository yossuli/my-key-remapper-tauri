// IPC invokeの型安全ラッパー

import type { Layer } from "@shared/types/remapConfig";
import { useCallback } from "react";
import { useIpc } from "@/hooks/api/useIpc";

/**
 * IPC invokeの型安全ラッパー
 * 特定のチャンネルに対する呼び出しを提供
 */
export function useInvoke<TResult, TArgs extends unknown[] = []>(
  channel: string
): (...args: TArgs) => Promise<TResult | undefined> {
  const { invoke } = useIpc();

  return useCallback(
    async (...args: TArgs): Promise<TResult | undefined> =>
      invoke<TResult>(channel, ...args),
    [invoke, channel]
  );
}

/**
 * get-mappings専用のinvokeフック
 */
export function useGetMappings(): () => Promise<
  { layers: Layer[]; layerOrder: string[] } | undefined
> {
  return useInvoke<{ layers: Layer[]; layerOrder: string[] }>("get-mappings");
}

/**
 * release-all-keys専用のinvokeフック
 * 押下中のキーを一括でリリースする
 */
export function useReleaseAllKeys(): () => Promise<number | undefined> {
  return useInvoke<number>("release-all-keys");
}

/**
 * get-pressed-keys専用のinvokeフック
 * 押下中のキーコードを取得する
 */
export function useGetPressedKeys(): () => Promise<number[] | undefined> {
  return useInvoke<number[]>("get-pressed-keys");
}
