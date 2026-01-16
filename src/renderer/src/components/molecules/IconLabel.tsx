import type { LucideIcon } from "lucide-react";
import { Icon } from "@/components/atoms/Icon";
import { HStack } from "@/components/template/Flex";

interface IconLabelProps {
  icon: LucideIcon;
  label: string;
  className?: string;
  iconClassName?: string;
  size?: "sm" | "md" | "lg";
}

/**
 * アイコンとラベルを横並びにする共通パーツ
 */
export function IconLabel({
  icon,
  label,
  className,
  iconClassName,
  size = "sm",
}: IconLabelProps) {
  return (
    <HStack className={className} gap={2}>
      <Icon className={iconClassName} icon={icon} size={size} />
      <span>{label}</span>
    </HStack>
  );
}
