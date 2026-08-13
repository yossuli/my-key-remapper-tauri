import type React from "react";
import type { BaseProps } from "@/components/control";
import { cn } from "@/utils/cn";

interface CardProps extends BaseProps<"div"> {
  children: React.ReactNode;
}

/**
 * 枠線、背景、影を持つコンテナ
 */
export const Card = ({ children, className, ...props }: CardProps) => (
  <div
    className={cn(
      "rounded-xl border border-border bg-card text-card-foreground shadow-sm",
      className
    )}
    {...props}
  >
    {children}
  </div>
);

export const CardHeader = ({ children, className, ...props }: CardProps) => (
  <div className={cn("flex flex-col space-y-1.5 p-6", className)} {...props}>
    {children}
  </div>
);

export const CardTitle = ({ children, className, ...props }: CardProps) => (
  <h3
    className={cn(
      "font-semibold text-2xl leading-none tracking-tight",
      className
    )}
    {...props}
  >
    {children}
  </h3>
);

export const CardContent = ({ children, className, ...props }: CardProps) => (
  <div className={cn("p-6 pt-0", className)} {...props}>
    {children}
  </div>
);
