// キーボードレイアウトから次のキーを取得するユーティリティ

import type { KeyboardLayout, KeyDefinition } from "@/types";

/**
 * KeyDefinition から基本の vk を取得する
 */
function getBaseVk(keyDef: KeyDefinition): number {
  return Array.isArray(keyDef.vk) ? keyDef.vk[0] : keyDef.vk;
}

/**
 * 現在のキーの右隣のキーの vk を取得する
 * 行末の場合は null を返す
 */
export function getNextKeyVk(
  layout: KeyboardLayout,
  currentVk: number
): number | null {
  for (const { row } of layout) {
    const index = row.findIndex((keyDef) => getBaseVk(keyDef) === currentVk);
    if (index !== -1) {
      const nextKey = row[index + 1];
      return nextKey ? getBaseVk(nextKey) : null;
    }
  }
  return null;
}
