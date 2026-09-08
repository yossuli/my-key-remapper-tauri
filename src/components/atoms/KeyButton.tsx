import { motion } from "framer-motion";
import { WithRemoveBadge } from "@/components/atoms/RemoveBadge";
import { KEY_SIZE_REM } from "@/constants/index";
import type { KeyDefinition, LayoutType } from "@/types";
import type { KeyBinding, TriggerType } from "@/types/remapConfig";
import {
  type ActionStyleVariant,
  getActionDisplayInfo,
} from "@/utils/actionDisplay";
import { cn } from "@/utils/cn";

interface KeyButtonProps {
  keyDef: KeyDefinition;
  bindings?: KeyBinding[];
  layout: LayoutType;
  layerId: string;
  selectedTrigger: TriggerType;
  macroNameMap?: Record<string, string>;
  isQuickEditing?: boolean;
  onClick: (vk: number) => void;
  onRemove: () => void;
}

const VARIANT_CLASSES: Record<ActionStyleVariant, string> = {
  default: "border-border bg-background text-foreground hover:bg-muted",
  remap:
    "border-primary bg-primary text-primary-foreground hover:bg-primary/90",
  numpad:
    "border-teal-500 bg-teal-600 text-white hover:bg-teal-500 shadow-teal-900/20",
  macro:
    "border-purple-500 bg-purple-600 text-white hover:bg-purple-500 shadow-purple-900/20",
  mouse:
    "border-amber-500 bg-amber-600 text-white hover:bg-amber-500 shadow-amber-900/20",
  layer:
    "border-indigo-500 bg-indigo-600 text-white hover:bg-indigo-500 shadow-indigo-900/20",
  delay:
    "border-slate-500 bg-slate-600 text-white hover:bg-slate-500 shadow-slate-900/20",
  disabled:
    "border-rose-800 bg-rose-950/80 text-rose-300 hover:bg-rose-900/80 line-through opacity-80",
};

const MAX_LENGTH_FOR_LARGE = 3;
const MAX_LENGTH_FOR_MEDIUM = 5;

const getLabelFontSize = (labelLength: number): string => {
  if (labelLength > MAX_LENGTH_FOR_MEDIUM) {
    return "text-[11px]";
  }
  if (labelLength > MAX_LENGTH_FOR_LARGE) {
    return "text-xs";
  }
  return "text-sm";
};

interface ActiveKeyContentProps {
  label: string;
  badge?: string;
  defaultKeyLabel: string;
}

function ActiveKeyContent({
  label,
  badge,
  defaultKeyLabel,
}: ActiveKeyContentProps) {
  const fontSizeClass = getLabelFontSize(label.length);

  return (
    <div className="relative flex h-full w-full flex-col items-center justify-center p-0.5 pointer-events-none">
      <div className="absolute top-0.5 right-1 left-1 flex items-center justify-between">
        <span className="max-w-[48%] truncate font-mono text-[8.5px] leading-none opacity-70">
          {defaultKeyLabel}
        </span>
        {badge ? (
          <span className="rounded bg-black/35 px-1 py-0.2 font-bold text-[7.5px] text-white/95 uppercase leading-none tracking-tight">
            {badge}
          </span>
        ) : null}
      </div>
      <div className="mt-2 flex w-full items-center justify-center px-0.5">
        <span
          className={cn(
            "truncate text-center font-bold leading-tight",
            fontSizeClass
          )}
        >
          {label}
        </span>
      </div>
    </div>
  );
}

export function KeyButton({
  keyDef,
  bindings,
  layout,
  layerId,
  selectedTrigger,
  macroNameMap,
  isQuickEditing = false,
  onClick,
  onRemove,
}: KeyButtonProps) {
  const baseVk = Array.isArray(keyDef.vk) ? keyDef.vk[0] : keyDef.vk;

  const triggerAction = bindings?.find(
    (b) => b.trigger === selectedTrigger
  )?.action;
  const hasBindingForTrigger = triggerAction !== undefined;

  const displayInfo = getActionDisplayInfo(
    triggerAction,
    keyDef.label,
    layout,
    macroNameMap
  );

  const isInactive = !(
    (["base", "shift"] as string[]).includes(layerId) || hasBindingForTrigger
  );

  const activeStyleClass = hasBindingForTrigger
    ? VARIANT_CLASSES[displayInfo.styleVariant]
    : VARIANT_CLASSES.default;

  return (
    <WithRemoveBadge
      disabled={!(hasBindingForTrigger || !isInactive)}
      onRemove={onRemove}
    >
      <motion.button
        // biome-ignore lint/style/noMagicNumbers: アニメーション値
        animate={isQuickEditing ? { scale: [1, 1.05, 1] } : {}}
        className={cn(
          "relative flex select-none flex-col items-center justify-center overflow-hidden rounded-md border font-medium shadow-sm transition-colors",
          activeStyleClass,
          isInactive ? "opacity-30" : "",
          isQuickEditing
            ? "ring-2 ring-yellow-400 ring-offset-2 ring-offset-background"
            : ""
        )}
        onClick={() => onClick(baseVk)}
        onKeyDown={(e) => {
          if (e.repeat) {
            e.preventDefault();
          }
        }}
        style={{
          width: `${(keyDef.width || 1) * KEY_SIZE_REM}rem`,
          height: "3rem",
        }}
        title={displayInfo.tooltip}
        transition={
          isQuickEditing
            ? { duration: 0.8, repeat: Number.POSITIVE_INFINITY }
            : {}
        }
        type="button"
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
      >
        {hasBindingForTrigger ? (
          <ActiveKeyContent
            badge={displayInfo.badge}
            defaultKeyLabel={keyDef.label}
            label={displayInfo.label}
          />
        ) : (
          <span className="font-medium text-sm">{keyDef.label}</span>
        )}
      </motion.button>
    </WithRemoveBadge>
  );
}
