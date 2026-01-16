import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Show } from "@/components/control/Show";
import { Else, Ternary, Then } from "@/components/control/Ternary";
import { IconLabel } from "@/components/molecules/IconLabel";
import { VStack } from "@/components/template/Flex";

interface EditorSectionProps {
  title?: string;
  icon?: LucideIcon;
  description?: string;
  children: ReactNode;
  extra?: ReactNode;
}

/**
 * 設定項目のレイアウトを統一する枠組みコンポーネント
 */
export function EditorSection({
  title,
  icon,
  description,
  children,
  extra,
}: EditorSectionProps) {
  return (
    <VStack gap={4}>
      <Show condition={Boolean(title || description || extra)}>
        <VStack gap={1}>
          <div className="flex items-center justify-between">
            <Show condition={Boolean(title)}>
              <Ternary condition={Boolean(icon)}>
                <Then>
                  <IconLabel
                    icon={icon as LucideIcon}
                    label={title as string}
                  />
                </Then>
                <Else>
                  <h3 className="font-bold text-sm tracking-tight">{title}</h3>
                </Else>
              </Ternary>
            </Show>
            <Show condition={Boolean(extra)}>
              <div>{extra}</div>
            </Show>
          </div>
          <Show condition={Boolean(description)}>
            <p className="text-muted-foreground text-sm leading-relaxed">
              {description}
            </p>
          </Show>
        </VStack>
      </Show>
      <div className="w-full">{children}</div>
    </VStack>
  );
}
