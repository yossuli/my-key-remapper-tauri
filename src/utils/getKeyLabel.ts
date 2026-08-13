import { KEYBOARD_LAYOUT_BASE, KEYBOARD_LAYOUT_SHIFT } from "@/constants";
import { CODE_TO_VK } from "@/constants/vk";
import type { KeyboardLayout, LayoutType } from "@/types";

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: 諦め
export const getKeyLabel = (vk: number[], layoutType: LayoutType): string => {
  if (vk.length === 1) {
    const keyboardLayout: KeyboardLayout = KEYBOARD_LAYOUT_BASE[layoutType];
    for (const { row } of keyboardLayout) {
      const found = row.find((k) => k.vk === vk[0]);
      if (found) {
        return found.label;
      }
    }
    return CODE_TO_VK[vk[0]] ?? `VK ${vk}`;
    // biome-ignore lint/style/noUselessElse: 1対1対応なのでelseで良い
  } else {
    const keyboardLayout: KeyboardLayout = KEYBOARD_LAYOUT_SHIFT[layoutType];
    for (const { row } of keyboardLayout) {
      const found = row.find((k) => {
        const a = new Set([k.vk].flat());
        const b = new Set([vk].flat());
        if ([...a].every(x => b.has(x)) && [...b].every(x => a.has(x))) {
          return true;
        }
        return false;
      });
      if (found) {
        return found.label;
      }
    }
    return vk.map((k) => getKeyLabel([k], layoutType)).join(" + ");
  }
};
