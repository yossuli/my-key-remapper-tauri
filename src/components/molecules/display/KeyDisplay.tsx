import { Badge } from "@/components/atoms/Badge";
import type { LayoutType } from "@/types";
import { cn } from "@/utils/cn";
import { getKeyLabel, isNumpadVk } from "@/utils/getKeyLabel";

interface KeyDisplayProps {
  vkCode: number | number[];
  layout: LayoutType;
  variant?: "default" | "primary" | "accent";
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function KeyDisplay({
  vkCode,
  layout,
  variant = "default",
  size = "md",
  className,
}: KeyDisplayProps) {
  const vks = Array.isArray(vkCode) ? vkCode : [vkCode];
  const isSingleNumpad = vks.length === 1 && isNumpadVk(vks[0]);

  const sizeStyles = {
    sm: "px-2 py-0.5 text-xs",
    md: "px-3 py-1.5 text-sm",
    lg: "px-5 py-2.5 text-lg",
  };

  const label = getKeyLabel(vks, layout);

  // テンキーキーの場合は専用カラーを適用
  const numpadClassName = isSingleNumpad
    ? "border-teal-500/60 bg-teal-500/15 text-teal-300 hover:bg-teal-500/25 font-semibold"
    : "";

  const displayText = isSingleNumpad ? `Num ${label}` : label;

  return (
    <Badge
      className={cn(sizeStyles[size], numpadClassName, className)}
      variant={variant}
    >
      {displayText}
    </Badge>
  );
}
