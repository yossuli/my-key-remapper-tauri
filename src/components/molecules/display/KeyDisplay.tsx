import { Badge } from "@/components/atoms/Badge";
import type { LayoutType } from "@/types";
import { getKeyLabel } from "@/utils/getKeyLabel";

interface KeyDisplayProps {
  vkCode: number;
  layout: LayoutType;
  variant?: "default" | "primary" | "accent";
  size?: "sm" | "md" | "lg";
}

export function KeyDisplay({
  vkCode,
  layout,
  variant = "default",
  size = "md",
}: KeyDisplayProps) {
  const sizeStyles = {
    sm: "px-2 py-1 text-xs",
    md: "px-4 py-2 text-base",
    lg: "px-6 py-3 text-xl",
  };

  return (
    <Badge className={sizeStyles[size]} variant={variant}>
      {getKeyLabel([vkCode], layout)}
    </Badge>
  );
}
