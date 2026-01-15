import { VK } from "@shared/constants/vk";
import type { TriggerType } from "@shared/types/remapConfig";
import { ArrowRight } from "lucide-react";
import { useState } from "react";
import { Icon } from "@/components/atoms/Icon";
import { Show } from "@/components/control/Show";
import { KeyDisplay } from "@/components/molecules/display/KeyDisplay";
import { KeyRemapList } from "@/components/molecules/forms/KeyRemapList";
import { TimingInput } from "@/components/molecules/forms/TimingInput";
import { HStack, VStack } from "@/components/template/Flex";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import type { ActionSetters, RepeatConfig } from "@/hooks/ui/useBindingConfig";
import type { RemapBindingState } from "@/models/BindingState";
import type { LayoutType } from "@/types";

interface RemapKeySectionProps {
  targetVk: number;
  layout: LayoutType;
  actionSetters: ActionSetters;
  state: RemapBindingState;
  isInputFocused: boolean;
  setIsInputFocused: (focused: boolean) => void;
  selectedTrigger: TriggerType;
}

export function RemapKeySection({
  targetVk,
  layout,
  actionSetters,
  state: {
    targetKeys,
    repeat = false,
    repeatDelayMs = 500,
    repeatIntervalMs = 100,
  },
  setIsInputFocused,
  selectedTrigger,
}: RemapKeySectionProps) {
  const [localRepeat, setLocalRepeat] = useState(repeat);
  const [localRepeatDelayMs, setLocalRepeatDelayMs] = useState(repeatDelayMs);
  const [localRepeatIntervalMs, setLocalRepeatIntervalMs] =
    useState(repeatIntervalMs);

  const handleKeysChange = (keys: number[]) => {
    const repeatConfig: RepeatConfig = {
      enabled: localRepeat,
      delayMs: localRepeatDelayMs,
      intervalMs: localRepeatIntervalMs,
    };
    actionSetters.setRemapAction(keys, repeatConfig);
  };

  const handleRepeatChange = (enabled: boolean) => {
    setLocalRepeat(enabled);
    const repeatConfig: RepeatConfig = {
      enabled,
      delayMs: localRepeatDelayMs,
      intervalMs: localRepeatIntervalMs,
    };
    actionSetters.setRemapAction(targetKeys, repeatConfig);
  };

  const handleRepeatDelayChange = (delayMs?: number) => {
    if (delayMs !== undefined) {
      setLocalRepeatDelayMs(delayMs);
      const repeatConfig: RepeatConfig = {
        enabled: localRepeat,
        delayMs,
        intervalMs: localRepeatIntervalMs,
      };
      actionSetters.setRemapAction(targetKeys, repeatConfig);
    }
  };

  const handleRepeatIntervalChange = (intervalMs?: number) => {
    if (intervalMs !== undefined) {
      setLocalRepeatIntervalMs(intervalMs);
      const repeatConfig: RepeatConfig = {
        enabled: localRepeat,
        delayMs: localRepeatDelayMs,
        intervalMs,
      };
      actionSetters.setRemapAction(targetKeys, repeatConfig);
    }
  };

  return (
    <VStack gap={4}>
      <HStack className="justify-center font-bold text-xl" gap={4}>
        <KeyDisplay layout={layout} vkCode={targetVk} />
        <Icon icon={ArrowRight} size="md" />
        <KeyRemapList
          ignoredKeys={[VK.ENTER, VK.ESCAPE, VK.TAB]}
          initialKeys={targetKeys}
          isCaptureEnabled={true}
          isRemoveDisabled={() => targetKeys.length === 1}
          layout={layout}
          onClear={() => handleKeysChange([])}
          onInputFocusChange={setIsInputFocused}
          onKeysChange={handleKeysChange}
        />
      </HStack>

      <Show condition={selectedTrigger === "hold"}>
        <VStack className="border-t pt-4" gap={4}>
          <div className="flex items-center space-x-2">
            <Checkbox
              checked={localRepeat}
              id="repeat-mode"
              onCheckedChange={(checked) => {
                handleRepeatChange(checked === true);
              }}
            />
            <Label htmlFor="repeat-mode">長押し中リピート</Label>
          </div>

          <Show condition={localRepeat}>
            <HStack className="items-end" gap={4}>
              <TimingInput
                defaultValue={500}
                id="repeatDelay"
                label="開始遅延 (ms)"
                onValueChange={handleRepeatDelayChange}
                setFocused={setIsInputFocused}
                value={localRepeatDelayMs}
              />
              <TimingInput
                defaultValue={100}
                id="repeatInterval"
                label="間隔 (ms)"
                onValueChange={handleRepeatIntervalChange}
                setFocused={setIsInputFocused}
                value={localRepeatIntervalMs}
              />
            </HStack>
          </Show>
        </VStack>
      </Show>
    </VStack>
  );
}
