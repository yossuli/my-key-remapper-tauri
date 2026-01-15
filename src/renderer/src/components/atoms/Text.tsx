import type React from "react";
import type { BaseProps } from "@/components/control";
import { cn } from "@/utils/cn";

type TextProps<T extends React.ElementType = "span"> = BaseProps<
  T,
  {
    children: React.ReactNode;
    variant?: "default" | "muted" | "error" | "success" | "warning";
    size?: "xs" | "sm" | "base" | "lg" | "xl";
    weight?: "normal" | "medium" | "semibold" | "bold";
  }
>;

const variantStyles = {
  default: "text-foreground",
  muted: "text-muted-foreground",
  error: "text-destructive",
  success: "text-green-500",
  warning: "text-yellow-500",
};

const sizeStyles = {
  xs: "text-xs",
  sm: "text-sm",
  base: "text-base",
  lg: "text-lg",
  xl: "text-xl",
};

const weightStyles = {
  normal: "font-normal",
  medium: "font-medium",
  semibold: "font-semibold",
  bold: "font-bold",
};

/**
 * タイポグラフィを一貫させるためのテキストコンポーネント
 */
export const Text = <T extends React.ElementType>({
  children,
  className,
  variant = "default",
  size = "base",
  weight = "normal",
  as,
  ...props
}: TextProps<T>) => {
  const Tag = as || "span";
  return (
    <Tag
      className={cn(
        variantStyles[variant],
        sizeStyles[size],
        weightStyles[weight],
        className
      )}
      {...props}
    >
      {children}
    </Tag>
  );
};
