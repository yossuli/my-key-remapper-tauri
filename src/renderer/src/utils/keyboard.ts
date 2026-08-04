const CODE_TO_VK: Record<string, number> = {
  ShiftLeft: 160,
  ShiftRight: 161,
  ControlLeft: 162,
  ControlRight: 163,
  AltLeft: 164,
  AltRight: 165,
  MetaLeft: 91,
  MetaRight: 92,
};

/**
 * 独自のKeyboardEventからWindowsのVK(仮想キーコード)を取得する
 * 基本的には e.keyCode で取れるが、左右のShiftやCtrlなど区別が必要なものを上書きする
 */
export function getVkCode(e: KeyboardEvent): number {
  return CODE_TO_VK[e.code] ?? e.keyCode;
}
