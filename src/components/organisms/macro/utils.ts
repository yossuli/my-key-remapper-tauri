import type { Action } from "@/types/remapConfig";
import type { IdentifiedAction } from "./types";

/**
 * Action に UI 用の一時 ID (_uiId) を付与して IdentifiedAction に変換する
 */
export const toIdentifiedAction = (action: Action): IdentifiedAction => ({
  ...action,
  _uiId: crypto.randomUUID(),
});

/**
 * IdentifiedAction から UI 用の一時 ID (_uiId) を除去して Action に戻す
 */
export const toAction = (identifiedAction: IdentifiedAction): Action => {
  // 分割代入で _uiId を除外
  const { _uiId, ...action } = identifiedAction;
  return action;
};
