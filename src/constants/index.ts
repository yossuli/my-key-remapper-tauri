import type { KeyboardLayout, LayerType, LayoutType } from "@/types";

import { KEYBOARD_LAYOUT_JIS, KEYBOARD_LAYOUT_JIS_SHIFT } from "./jis";
import { KEYBOARD_LAYOUT_US, KEYBOARD_LAYOUT_US_SHIFT } from "./us";

export const KEY_SIZE_REM = 3;

export const KEYBOARD_LAYOUT_BASE = {
  JIS: KEYBOARD_LAYOUT_JIS,
  US: KEYBOARD_LAYOUT_US,
} as const satisfies Record<LayoutType, KeyboardLayout>;

export const KEYBOARD_LAYOUT_SHIFT = {
  JIS: KEYBOARD_LAYOUT_JIS_SHIFT,
  US: KEYBOARD_LAYOUT_US_SHIFT,
} as const satisfies Record<LayoutType, KeyboardLayout>;

export const KEYBOARD_LAYOUT = {
  base: KEYBOARD_LAYOUT_BASE,
  shift: KEYBOARD_LAYOUT_SHIFT,
} as const satisfies Record<string, Record<LayoutType, KeyboardLayout>>;

export const SWITCH_LAYOUT_RULE = {
  JIS: "US",
  US: "JIS",
} as const satisfies Record<LayoutType, LayoutType>;

export const LAYER_TYPES = ["base", "custom"] as const satisfies LayerType[];

// biome-ignore lint/performance/noBarrelFile: ここは許容
export { VK } from "./vk";
