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
  // D&D props
  isDraggable?: boolean;
  isDragging?: boolean;
  isDragOver?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
  onDragEnd?: (e: React.DragEvent) => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDragEnter?: (e: React.DragEvent) => void;
  onDragLeave?: (e: React.DragEvent) => void;
  onDrop?: (e: React.DragEvent) => void;
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
    <div className="pointer-events-none relative flex h-full w-full flex-col items-center justify-center p-0.5">
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

const ALWAYS_ACTIVE_LAYERS = ["base", "shift"] as const;

function isKeyInactive(
  layerId: string,
  hasBindingForTrigger: boolean
): boolean {
  if (
    ALWAYS_ACTIVE_LAYERS.includes(
      layerId as (typeof ALWAYS_ACTIVE_LAYERS)[number]
    )
  ) {
    return false;
  }
  return !hasBindingForTrigger;
}

interface KeyButtonClassParams {
  styleVariant: ActionStyleVariant;
  hasBindingForTrigger: boolean;
  isInactive: boolean;
  isQuickEditing: boolean;
}

function getKeyButtonClassName({
  styleVariant,
  hasBindingForTrigger,
  isInactive,
  isQuickEditing,
}: KeyButtonClassParams): string {
  const activeStyleClass = hasBindingForTrigger
    ? VARIANT_CLASSES[styleVariant]
    : VARIANT_CLASSES.default;

  return cn(
    "relative flex h-full w-full select-none flex-col items-center justify-center overflow-hidden rounded-md border font-medium shadow-sm transition-colors",
    activeStyleClass,
    isInactive ? "opacity-30" : "",
    isQuickEditing
      ? "ring-2 ring-yellow-400 ring-offset-2 ring-offset-background"
      : ""
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
  isDraggable = false,
  isDragging = false,
  isDragOver = false,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDragEnter,
  onDragLeave,
  onDrop,
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

  const isInactive = isKeyInactive(layerId, hasBindingForTrigger);

  const buttonClassName = getKeyButtonClassName({
    styleVariant: displayInfo.styleVariant,
    hasBindingForTrigger,
    isInactive,
    isQuickEditing,
  });

  return (
    <WithRemoveBadge
      disabled={!(hasBindingForTrigger || !isInactive)}
      onRemove={onRemove}
    >
      {/* biome-ignore lint/a11y/useSemanticElements: D&D時のポインターキャプチャ競合を回避するためdiv role="button"を使用 */}
      <div
        aria-label={keyDef.label}
        className={cn(
          buttonClassName,
          "cursor-pointer select-none",
          isDraggable ? "cursor-grab active:cursor-grabbing" : "",
          isDragging ? "scale-95 opacity-40 ring-2 ring-muted-foreground" : "",
          isDragOver
            ? "z-20 scale-105 rounded-md bg-primary/20 ring-2 ring-primary ring-offset-2 ring-offset-background"
            : "",
          !isDraggable &&
            "transition-transform duration-100 hover:scale-[1.03] active:scale-[0.97]"
        )}
        draggable={isDraggable}
        onClick={() => onClick(baseVk)}
        onDragEnd={onDragEnd}
        onDragEnter={onDragEnter}
        onDragLeave={onDragLeave}
        onDragOver={(e) => {
          e.preventDefault();
          onDragOver?.(e);
        }}
        onDragStart={(e) => {
          console.log(
            `[D&D:dragstart] Key: "${keyDef.label}" (VK: ${baseVk}), isDraggable: ${isDraggable}`
          );
          onDragStart?.(e);
        }}
        onDrop={onDrop}
        onKeyDown={(e) => {
          if (e.repeat) {
            e.preventDefault();
            return;
          }
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onClick(baseVk);
          }
        }}
        role="button"
        style={{
          width: `${(keyDef.width || 1) * KEY_SIZE_REM}rem`,
          height: "3rem",
        }}
        tabIndex={0}
        title={displayInfo.tooltip}
      >
        {hasBindingForTrigger ? (
          <ActiveKeyContent
            badge={displayInfo.badge}
            defaultKeyLabel={keyDef.label}
            label={displayInfo.label}
          />
        ) : (
          <span className="pointer-events-none font-medium text-sm">
            {keyDef.label}
          </span>
        )}
      </div>
    </WithRemoveBadge>
  );
}
