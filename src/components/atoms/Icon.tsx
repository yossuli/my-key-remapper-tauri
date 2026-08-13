import type { LucideIcon } from "lucide-react";
import { cn } from "@/utils/cn";

interface IconProps {
  icon: LucideIcon;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function Icon({
  icon: IconComponent,
  size = "sm",
  className,
}: IconProps) {
  const sizeStyles = {
    sm: "h-4 w-4",
    md: "h-5 w-5",
    lg: "h-6 w-6",
  };

  return <IconComponent className={cn(sizeStyles[size], className)} />;
}
