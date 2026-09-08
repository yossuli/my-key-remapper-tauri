import { KEYBOARD_LAYOUT_BASE, KEYBOARD_LAYOUT_SHIFT } from "@/constants";
import { CODE_TO_VK, VK } from "@/constants/vk";
import type { KeyboardLayout, LayoutType } from "@/types";

/** テンキーのVKコード判定 */
export const isNumpadVk = (vk: number): boolean =>
  (vk >= VK.NUMPAD0 && vk <= VK.DIVIDE) || vk === VK.NUMLOCK;

/** テンキーの表示用短縮ラベル */
export const NUMPAD_LABELS: Record<number, string> = {
  [VK.NUMPAD0]: "0",
  [VK.NUMPAD1]: "1",
  [VK.NUMPAD2]: "2",
  [VK.NUMPAD3]: "3",
  [VK.NUMPAD4]: "4",
  [VK.NUMPAD5]: "5",
  [VK.NUMPAD6]: "6",
  [VK.NUMPAD7]: "7",
  [VK.NUMPAD8]: "8",
  [VK.NUMPAD9]: "9",
  [VK.MULTIPLY]: "*",
  [VK.ADD]: "+",
  [VK.SEPARATOR]: "Sep",
  [VK.SUBTRACT]: "-",
  [VK.DECIMAL]: ".",
  [VK.DIVIDE]: "/",
  [VK.NUMLOCK]: "NumLk",
};

/** Shift系VKコードセット */
export const SHIFT_VKS = new Set<number>([VK.SHIFT, VK.LSHIFT, VK.RSHIFT]);

export const isShiftVk = (vk: number): boolean => SHIFT_VKS.has(vk);

/** Shift系VKコードを正規化 (すべて VK.SHIFT に揃える) */
const normalizeShiftVk = (vk: number): number =>
  isShiftVk(vk) ? VK.SHIFT : vk;

/**
 * 単一キーのラベルを取得
 */
const getSingleKeyLabel = (vk: number, layoutType: LayoutType): string => {
  if (isNumpadVk(vk)) {
    return NUMPAD_LABELS[vk] ?? CODE_TO_VK[vk] ?? `VK ${vk}`;
  }

  const keyboardLayout: KeyboardLayout = KEYBOARD_LAYOUT_BASE[layoutType];
  for (const { row } of keyboardLayout) {
    const found = row.find((k) => k.vk === vk);
    if (found) {
      return found.label;
    }
  }
  return CODE_TO_VK[vk] ?? `VK ${vk}`;
};

/**
 * Shiftと合体したキーの実際の入力キーラベルを検索
 */
export const findShiftCombinedLabel = (
  vks: number[],
  layoutType: LayoutType
): string | null => {
  const keyboardLayout: KeyboardLayout = KEYBOARD_LAYOUT_SHIFT[layoutType];
  const normalizedTargetSet = new Set(vks.map(normalizeShiftVk));

  for (const { row } of keyboardLayout) {
    const found = row.find((k) => {
      const rowVkList = [k.vk].flat();
      const normalizedRowSet = new Set(rowVkList.map(normalizeShiftVk));

      if (normalizedRowSet.size !== normalizedTargetSet.size) {
        return false;
      }
      for (const val of normalizedRowSet) {
        if (!normalizedTargetSet.has(val)) {
          return false;
        }
      }
      return true;
    });

    if (found?.label) {
      return found.label;
    }
  }

  // 英字キー (A-Z) の場合は大文字を返す
  const nonShift = vks.filter((k) => !isShiftVk(k));
  if (
    nonShift.length === 1 &&
    nonShift[0] >= VK.KEY_A &&
    nonShift[0] <= VK.KEY_Z
  ) {
    return String.fromCharCode(nonShift[0]);
  }

  return null;
};

const MODIFIER_VKS = new Set<number>([
  VK.CTRL,
  VK.LCTRL,
  VK.RCTRL,
  VK.ALT,
  VK.LALT,
  VK.RALT,
  VK.LWIN,
  VK.RWIN,
]);

/**
 * 修飾キー付きの合体キーラベルを解決
 */
const resolveModifierCombinedLabel = (
  nonShiftKeys: number[],
  layoutType: LayoutType
): string | null => {
  const mainKeys = nonShiftKeys.filter((k) => !MODIFIER_VKS.has(k));
  const modifiers = nonShiftKeys.filter((k) => MODIFIER_VKS.has(k));

  if (mainKeys.length !== 1) {
    return null;
  }

  const combinedLabel = findShiftCombinedLabel(
    [VK.SHIFT, mainKeys[0]],
    layoutType
  );
  if (!combinedLabel) {
    return null;
  }

  const modLabels = modifiers.map((k) => getSingleKeyLabel(k, layoutType));
  return [...modLabels, combinedLabel].join(" + ");
};

/**
 * Shiftキーを含むキー配列のラベルを解決
 */
const resolveShiftLabel = (
  vk: number[],
  layoutType: LayoutType
): string | null => {
  const nonShiftKeys = vk.filter((k) => !isShiftVk(k));

  if (nonShiftKeys.length === 1) {
    return findShiftCombinedLabel(vk, layoutType);
  }

  if (nonShiftKeys.length > 1) {
    return resolveModifierCombinedLabel(nonShiftKeys, layoutType);
  }

  return null;
};

/**
 * キーコード配列に基づいて表示用ラベルを取得する
 */
export const getKeyLabel = (vk: number[], layoutType: LayoutType): string => {
  if (vk.length === 0) {
    return "";
  }

  if (vk.length === 1) {
    return getSingleKeyLabel(vk[0], layoutType);
  }

  if (vk.some(isShiftVk)) {
    const shiftLabel = resolveShiftLabel(vk, layoutType);
    if (shiftLabel) {
      return shiftLabel;
    }
  }

  return vk.map((k) => getSingleKeyLabel(k, layoutType)).join(" + ");
};
