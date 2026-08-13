import type { ReactNode } from "react";
import { Badge as ShadcnBadge } from "@/components/ui/badge";
import { cn } from "@/utils/cn";

interface BadgeProps {
  children: ReactNode;
  variant?: "default" | "primary" | "accent" | "muted";
  className?: string;
}

export function Badge({
  children,
  variant = "default",
  className,
}: BadgeProps) {
  // マッピングと追加スタイル
  // 既存のdefaultは枠線のみ(outlineに近い)
  // primary/accent/mutedは背景色付き
  const variantConfig = {
    default: {
      variant: "outline" as const,
      className: "",
    },
    primary: {
      variant: "secondary" as const,
      className: "bg-primary/10 text-primary hover:bg-primary/20",
    },
    accent: {
      variant: "secondary" as const,
      className: "bg-accent/50 text-accent-foreground hover:bg-accent/60",
    },
    muted: {
      variant: "secondary" as const,
      className: "bg-muted text-muted-foreground hover:bg-muted/80",
    },
  };

  const { variant: shadcnVariant, className: styleClassName } =
    variantConfig[variant];

  return (
    <ShadcnBadge
      className={cn(
        "rounded px-2 py-0.5 font-medium text-xs",
        styleClassName,
        className
      )}
      variant={shadcnVariant}
    >
      {children}
    </ShadcnBadge>
  );
}
