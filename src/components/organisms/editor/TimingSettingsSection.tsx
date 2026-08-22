import type { TriggerType } from "@/types/remapConfig";
import { TimingInput } from "@/components/molecules/forms/TimingInput";
import { TabsContent } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface TimingSettingsSectionProps {
  selectedTrigger: TriggerType;
  holdThresholdMs: number | undefined;
  tapIntervalMs: number | undefined;
  interruptBehavior?: "forceTap" | "forceHold" | "ignore";
  defaultHoldThresholdMs: number | undefined;
  defaultTapIntervalMs: number | undefined;
  setHoldThresholdMs: (ms: number | undefined) => void;
  setTapIntervalMs: (ms: number | undefined) => void;
  setInterruptBehavior: (behavior: "forceTap" | "forceHold" | "ignore" | undefined) => void;
  setIsInputFocused: (focused: boolean) => void;
}

export function TimingSettingsSection({
  selectedTrigger: _selectedTrigger,
  holdThresholdMs,
  tapIntervalMs,
  interruptBehavior,
  defaultHoldThresholdMs,
  defaultTapIntervalMs,
  setHoldThresholdMs,
  setTapIntervalMs,
  setInterruptBehavior,
  setIsInputFocused,
}: TimingSettingsSectionProps) {
  return (
    <>
      <TabsContent value="hold" className="space-y-4">
        <TimingInput
          defaultValue={defaultHoldThresholdMs}
          id="holdThreshold"
          label="判定時間 (ms)"
          onValueChange={setHoldThresholdMs}
          setFocused={setIsInputFocused}
          value={holdThresholdMs}
        />
        <div className="grid gap-2">
          <Label>Hold待機中の他キー入力割り込み</Label>
          <Select
            value={interruptBehavior || "forceTap"}
            onValueChange={(val) => setInterruptBehavior(val as "forceTap" | "forceHold" | "ignore")}
            onOpenChange={setIsInputFocused}
          >
            <SelectTrigger>
              <SelectValue placeholder="挙動を選択" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="forceTap">Tapとして発火 (文字キー向け)</SelectItem>
              <SelectItem value="forceHold">即座にHold確定 (修飾キー向け)</SelectItem>
              <SelectItem value="ignore">判定保留</SelectItem>
            </SelectContent>
          </Select>
        </div>
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
