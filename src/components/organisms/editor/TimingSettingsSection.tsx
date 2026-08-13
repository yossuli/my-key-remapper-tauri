import type { TriggerType } from "@/types/remapConfig";
import { TimingInput } from "@/components/molecules/forms/TimingInput";
import { TabsContent } from "@/components/ui/tabs";

interface TimingSettingsSectionProps {
  selectedTrigger: TriggerType;
  holdThresholdMs: number | undefined;
  tapIntervalMs: number | undefined;
  defaultHoldThresholdMs: number | undefined;
  defaultTapIntervalMs: number | undefined;
  setHoldThresholdMs: (ms: number | undefined) => void;
  setTapIntervalMs: (ms: number | undefined) => void;
  setIsInputFocused: (focused: boolean) => void;
}

// SelectTriggerは構造上必要だが関数内では未使用
export function TimingSettingsSection({
  selectedTrigger: _selectedTrigger, // KeyEditorForm から受け取り（構造上必要だが未使用）
  holdThresholdMs, // KeyEditorForm から受け取り
  tapIntervalMs, // KeyEditorForm から受け取り
  defaultHoldThresholdMs, // KeyEditorForm から受け取り
  defaultTapIntervalMs, // KeyEditorForm から受け取り
  setHoldThresholdMs, // KeyEditorForm から受け取り
  setTapIntervalMs, // KeyEditorForm から受け取り
  setIsInputFocused, // KeyEditorForm から受け取り
}: TimingSettingsSectionProps) {
  return (
    <>
      <TabsContent value="hold">
        <TimingInput
          defaultValue={defaultHoldThresholdMs}
          id="holdThreshold"
          label="判定時間 (ms)"
          onValueChange={setHoldThresholdMs}
          setFocused={setIsInputFocused}
          value={holdThresholdMs}
        />
      </TabsContent>

      <TabsContent value="doubleTap">
        <TimingInput
          defaultValue={defaultTapIntervalMs}
          id="tapInterval"
          label="タップ間隔 (ms)"
          onValueChange={setTapIntervalMs}
          setFocused={setIsInputFocused}
          value={tapIntervalMs}
        />
      </TabsContent>
    </>
  );
}
