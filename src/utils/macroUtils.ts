import type { MacroDef } from "@/types/remapConfig";

/**
 * 指定されたターゲットマクロが、現在編集中のマクロIDを再帰的に呼び出しているか（循環参照）をチェックする
 */
export function isCircularMacro(
  currentMacroId: string | undefined,
  targetMacroId: string,
  allMacros: MacroDef[],
  visited: Set<string> = new Set()
): boolean {
  if (targetMacroId === currentMacroId) {
    return true;
  }

  if (visited.has(targetMacroId)) {
    return false;
  }
  visited.add(targetMacroId);

  const targetMacro = allMacros.find((m) => m.id === targetMacroId);
  if (!targetMacro) {
    return false;
  }

  for (const action of targetMacro.actions) {
    if (action.type !== "macro") {
      continue;
    }
    if (action.macroId === currentMacroId) {
      return true;
    }
    if (
      isCircularMacro(
        currentMacroId,
        action.macroId,
        allMacros,
        new Set(visited)
      )
    ) {
      return true;
    }
  }

  return false;
}

/**
 * 全てのマクロ定義をスキャンし、循環参照が含まれていないか検証する
 * @returns 循環参照が一つでも含まれる場合は false
 */
export function validateMacros(macros: MacroDef[]): boolean {
  for (const macro of macros) {
    for (const action of macro.actions) {
      if (
        action.type === "macro" &&
        isCircularMacro(macro.id, action.macroId, macros)
      ) {
        return false;
      }
    }
  }
  return true;
}
