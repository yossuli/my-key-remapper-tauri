import { Check, Plus } from "lucide-react";
import { useCallback, useState } from "react";
import { Button } from "@/components/atoms/Button";
import { Icon } from "@/components/atoms/Icon";
import { Show } from "@/components/control/Show";
import { Else, Ternary, Then } from "@/components/control/Ternary";
import { HStack, VStack } from "@/components/template/Flex";
import { useKeyCapture } from "@/hooks/ui/useKeyCapture";
import { useKeyEventInput } from "@/hooks/ui/useKeyEventInput";
import type { LayoutType } from "@/types";
import { cn } from "@/utils/cn";
import { KeyRemapItems } from "./KeyRemapItems";
import { VkDirectInput } from "./VkDirectInput";

export interface KeyRemapListProps {
  initialKeys: number[];
  layout: LayoutType;
  onKeysChange: (keys: number[]) => void;
  isCaptureEnabled?: boolean;
  onClear?: () => void;
  onInputFocusChange?: (isFocused: boolean) => void;
  isRemoveDisabled?: (vkCode: number) => boolean;
  className?: string;
  requireExplicitAdd?: boolean;
  ignoredKeys?: number[];
  onCaptureActiveChange?: (active: boolean) => void;
}

export function KeyRemapList({
  initialKeys = [],
  layout,
  onKeysChange,
  isCaptureEnabled = false,
  onClear,
  onInputFocusChange,
  isRemoveDisabled,
  className,
  requireExplicitAdd = false,
  ignoredKeys = [],
  onCaptureActiveChange,
}: KeyRemapListProps) {
  const safeKeys = initialKeys ?? [];
  const [showVkInput, setShowVkInput] = useState(false);
  const [isInputFocused, setIsInputFocused] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);

  const isCaptureActive =
    isCaptureEnabled && (!requireExplicitAdd || isCapturing);

  const handleCaptureChange = useCallback(
    (capturing: boolean) => {
      setIsCapturing(capturing);
      const active = isCaptureEnabled && (!requireExplicitAdd || capturing);
      onCaptureActiveChange?.(active);
    },
    [isCaptureEnabled, requireExplicitAdd, onCaptureActiveChange]
  );

  const { inputKey, onKeyDown, onKeyUp, reset } = useKeyCapture({
    currentKeys: safeKeys,
    onKeysChange,
  });

  const handleRemoveKeys = useCallback(
    (vks: number | number[]) => {
      const vksToRemove = Array.isArray(vks) ? vks : [vks];
      const removeSet = new Set(vksToRemove);
      const next = safeKeys.filter((k) => !removeSet.has(k));
      if (next.length !== safeKeys.length) {
        onKeysChange(next);
      }
    },
    [safeKeys, onKeysChange]
  );

  useKeyEventInput({
    enabled: isCaptureActive && !isInputFocused,
    onKeyDown: (vkCode) => {
      if (ignoredKeys.includes(vkCode)) {
        return;
      }
      onKeyDown(vkCode);
    },
    onKeyUp,
  });

  const handleInputFocus = (focused: boolean) => {
    setIsInputFocused(focused);
    onInputFocusChange?.(focused);
  };

  return (
    <VStack className={className} gap={2}>
      <HStack className="flex-wrap justify-center font-bold text-xl" gap={4}>
        <KeyRemapItems
          isRemoveDisabled={isRemoveDisabled}
          keys={safeKeys}
          layout={layout}
          onRemoveKey={handleRemoveKeys}
          showVkInput={showVkInput}
        />

        <Show
          as={Button}
          className={cn("gap-2", { "animate-pulse": isCapturing })}
          condition={!!requireExplicitAdd}
          onClick={() => handleCaptureChange(!isCapturing)}
          variant={isCapturing ? "default" : "outline"}
        >
          <Ternary condition={!isCapturing}>
            <Then as={Icon} icon={Plus} />
            <Else as={Icon} icon={Check} />
          </Ternary>
          {isCapturing ? "完了" : "追加"}
        </Show>

        <Show
          as={Button}
          condition={safeKeys.length > 0}
          onClick={() => {
            reset();
            onClear?.();
          }}
          variant="ghost"
        >
          クリア
        </Show>
      </HStack>
      <VkDirectInput
        onAddKey={inputKey}
        onFocusChange={handleInputFocus}
        onOpenChange={setShowVkInput}
      />
    </VStack>
  );
}
