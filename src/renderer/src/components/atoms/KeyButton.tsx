import { KEY_SIZE_REM } from "@shared/constants/index";
import type {
  Action,
  KeyBinding,
  TriggerType,
} from "@shared/types/remapConfig";
import { motion } from "framer-motion";
import { WithRemoveBadge } from "@/components/atoms/RemoveBadge";
import type { KeyDefinition, LayoutType } from "@/types";
import { cn } from "@/utils/cn";
import { getKeyLabel } from "@/utils/getKeyLabel";

interface KeyButtonProps {
  keyDef: KeyDefinition;
  bindings?: KeyBinding[];
  layout: LayoutType;
  layerId: string;
  selectedTrigger: TriggerType;
  isQuickEditing?: boolean; // クイック設定モードで入力待ち状態のキー
  onClick: (vk: number) => void;
  onRemove: () => void;
}

/**
 * アクションに基づいて表示ラベルを取得する
 */
function getDisplayLabel(
  action: Action | undefined,
  defaultLabel: string,
  layout: LayoutType
): string {
  if (!action) {
    return defaultLabel;
  }
  if ("keys" in action) {
    return getKeyLabel(action.keys, layout);
  }
  if (action.type === "layerToggle") {
    return `[${action.layerId}]`;
  }
  if (action.type === "layerMomentary") {
    return `(${action.layerId})`;
  }
  if (action.type === "none") {
    return "×";
  }
  return defaultLabel;
}

export function KeyButton({
  keyDef,
  bindings,
  layout,
  layerId,
  selectedTrigger,
  isQuickEditing = false,
  onClick,
  onRemove,
}: KeyButtonProps) {
  const baseVk = Array.isArray(keyDef.vk) ? keyDef.vk[0] : keyDef.vk;

  // 選択されたトリガーに対応するアクションを取得
  const triggerAction = bindings?.find(
    (b) => b.trigger === selectedTrigger
  )?.action;
  const hasBindingForTrigger = triggerAction !== undefined;

  // 表示ラベルを決定
  const displayLabel = getDisplayLabel(triggerAction, keyDef.label, layout);

  // カスタムレイヤーでバインディングがないキーは薄く表示
  const isInactive = !(
    (["base", "shift"] as string[]).includes(layerId) || hasBindingForTrigger
  );
  const isActive =
    (["base", "shift"] as string[]).includes(layerId) && hasBindingForTrigger;

  return (
    <WithRemoveBadge disabled={!(isActive || !isInactive)} onRemove={onRemove}>
      <motion.button
        // biome-ignore lint/style/noMagicNumbers: アニメーションの値なぞマジックでよい
        animate={isQuickEditing ? { scale: [1, 1.05, 1] } : {}}
        className={cn(
          "flex items-center justify-center rounded-md border font-medium text-sm shadow-sm transition-colors",
          isActive
            ? "border-primary bg-primary text-primary-foreground"
            : "border-border bg-background text-foreground hover:bg-muted",
          isInactive ? "opacity-30" : "",
          isQuickEditing
            ? "ring-2 ring-yellow-400 ring-offset-2 ring-offset-background"
            : ""
        )}
        onClick={() => onClick(baseVk)}
        onKeyDown={(e) => {
          // キーボード操作での長押し連打による誤発火を防止
          if (e.repeat) {
            e.preventDefault();
          }
        }}
        style={{
          width: `${(keyDef.width || 1) * KEY_SIZE_REM}rem`,
          height: "3rem",
        }}
        transition={
          isQuickEditing
            ? { duration: 0.8, repeat: Number.POSITIVE_INFINITY }
            : {}
        }
        type="button"
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
      >
        {displayLabel}
      </motion.button>
    </WithRemoveBadge>
  );
}
