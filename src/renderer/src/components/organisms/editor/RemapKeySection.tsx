import { VK } from "@shared/constants/vk";
import type { TriggerType } from "@shared/types/remapConfig";
import { ArrowRight } from "lucide-react";
import { Icon } from "@/components/atoms/Icon";
import { Show } from "@/components/control/Show";
import { KeyDisplay } from "@/components/molecules/display/KeyDisplay";
import { KeyRemapList } from "@/components/molecules/forms/KeyRemapList";
import { TimingInput } from "@/components/molecules/forms/TimingInput";
import { HStack, VStack } from "@/components/template/Flex";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import type {
  KeyEditorUIHandlers,
  RepeatSettings,
} from "@/hooks/useBindingConfig";
import type { UseKeyEditorActionsReturn } from "@/hooks/useKeyEditorAction";
import type { LayoutType } from "@/types";

interface RemapKeySectionProps {
  targetVk: number;
  layout: LayoutType;

  keyEditorActions: UseKeyEditorActionsReturn;
  keyEditorUIHandlers: KeyEditorUIHandlers;

  // リピート設定
  selectedTrigger: TriggerType;
  repeatSettings: RepeatSettings;

  // 追加されたハンドラー
  isInputFocused: boolean;
  handleSave: () => void;
  addTargetKey: (keyCode: number) => void;
}

export function RemapKeySection({
  targetVk,
  layout,
  keyEditorActions,
  keyEditorUIHandlers:{ setIsInputFocused,setIsRecording },
  selectedTrigger,
  repeatSettings,
}: RemapKeySectionProps) {
  const { keys, setKeys, reset } = keyEditorActions;
  const { repeat, repeatDelayMs, repeatIntervalMs, onRepeatChange } =
    repeatSettings;

  return (
    <VStack gap={4}>
      <HStack className="justify-center font-bold text-xl" gap={4}>
        <KeyDisplay layout={layout} vkCode={targetVk} />
        <Icon icon={ArrowRight} size="md" />
        <KeyRemapList
          ignoredKeys={[VK.ENTER, VK.ESCAPE, VK.TAB]}
          initialKeys={keys}
          isCaptureEnabled={true}
          isRemoveDisabled={() => keys.length === 1}
          layout={layout}
          onCaptureActiveChange={setIsRecording}
          onClear={reset}
          onInputFocusChange={setIsInputFocused}
          onKeysChange={setKeys}
        />
      </HStack>

      <Show condition={selectedTrigger === "hold"}>
        <VStack className="border-t pt-4" gap={4}>
          <div className="flex items-center space-x-2">
            <Checkbox
              checked={repeat ?? false}
              id="repeat-mode"
              onCheckedChange={(checked) => {
                onRepeatChange(
                  checked === true,
                  repeatDelayMs,
                  repeatIntervalMs
                );
              }}
            />
            <Label htmlFor="repeat-mode">長押し中リピート</Label>
          </div>

          <Show condition={!!repeat}>
            <HStack className="items-end" gap={4}>
              <TimingInput
                defaultValue={500}
                id="repeatDelay"
                label="開始遅延 (ms)"
                onValueChange={(val) =>
                  onRepeatChange(repeat ?? false, val, repeatIntervalMs)
                }
                setFocused={setIsInputFocused}
                value={repeatDelayMs}
              />
              <TimingInput
                defaultValue={100}
                id="repeatInterval"
                label="間隔 (ms)"
                onValueChange={(val) =>
                  onRepeatChange(repeat ?? false, repeatDelayMs, val)
                }
                setFocused={setIsInputFocused}
                value={repeatIntervalMs}
              />
            </HStack>
          </Show>
        </VStack>
      </Show>
    </VStack>
  );
}
