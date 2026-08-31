// biome-ignore lint/style/noExportedImports: 内部でも使用するため
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
export { Tabs, TabsContent, TabsList, TabsTrigger };

import type { ReactNode } from "react";
import { Mapped } from "@/components/control/Mapped";
import { Show } from "@/components/control/Show";
import { Then } from "@/components/control/Ternary";
import { VStack } from "@/components/template/Flex";
import type { TriggerType } from "@/types/remapConfig";
import { cn } from "@/utils/cn";

interface TriggerOption {
  value: TriggerType;
  label: string;
  shortLabel: string;
  id: string;
}

const TRIGGER_OPTIONS: TriggerOption[] = [
  { id: "tap", value: "tap", label: "Tap（単押し）", shortLabel: "Tap" },
  { id: "hold", value: "hold", label: "Hold（長押し）", shortLabel: "Hold" },
  {
    id: "doubleTap",
    value: "doubleTap",
    label: "Double Tap（2回押し）",
    shortLabel: "Double",
  },
];

interface TriggerSelectorProps {
  selectedTrigger: TriggerType;
  onTriggerChange: (trigger: TriggerType) => void;
  /** サイズ: compactはLayerTabsと横に並べる用、defaultは通常表示 */
  size?: "compact" | "default";
  children?: ReactNode;
  className?: string;
  gap?: 1 | 2 | 8 | 3 | 4 | 6 | undefined;
}

export function TriggerTabs({
  selectedTrigger,
  onTriggerChange,
  size = "default",
  children,
  className,
  gap,
}: TriggerSelectorProps) {
  const isCompact = size === "compact";

  return (
    <div
      className={cn(
        "flex items-center gap-2",
        isCompact ? undefined : "flex-col items-start",
        className
      )}
    >
      <Show condition={!isCompact}>
        <label
          className="self-start font-medium text-muted-foreground text-xs"
          htmlFor={selectedTrigger}
        >
          トリガー
        </label>
      </Show>
      <Show condition={isCompact}>
        <span className="text-muted-foreground text-sm">Trigger:</span>
      </Show>

      <Tabs
        className="w-full"
        onValueChange={(val) => onTriggerChange(val as TriggerType)}
        value={selectedTrigger}
      >
        <VStack gap={gap}>
          <TabsList
            className={cn(
              "h-auto bg-muted/30 p-1",
              !isCompact && "w-full justify-start"
            )}
          >
            <Mapped as={Then} value={TRIGGER_OPTIONS}>
              {({ value, label, shortLabel }) => (
                <TabsTrigger
                  className={cn(
                    "data-[state=active]:bg-background",
                    !isCompact && "flex-1"
                  )}
                  key={value}
                  value={value}
                >
                  {/* biome-ignore lint/nursery/noLeakedRender: テキストを表示するだけなので安全 */}
                  {isCompact ? shortLabel : label}
                </TabsTrigger>
              )}
            </Mapped>
          </TabsList>
          {children}
        </VStack>
      </Tabs>
    </div>
  );
}
