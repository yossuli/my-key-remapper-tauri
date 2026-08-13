import type { Action } from "@/types/remapConfig";

/**
 * UI上での識別用に一意なIDを付与したAction型
 * framer-motionのReorderなどがkeyとして使用する
 */
export type IdentifiedAction = Action & {
  _uiId: string;
};

export interface ActionSummaryHandlers {
  onNavigate: (macroId: string) => void;
}
