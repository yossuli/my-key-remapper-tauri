import { useEffect, useState } from "react";
import { Button } from "@/components/atoms/Button";
import { Text } from "@/components/atoms/Text";
import { EditorSection } from "@/components/molecules/EditorSection";
import { ActionNumericInput } from "@/components/molecules/forms/ActionNumericInput";
import { HStack, VStack } from "@/components/template/Flex";
import { useGlobalSettings } from "@/hooks/api/useGlobalSettings";

/**
 * グローバル設定を編集するフォーム
 */
export function GlobalSettingsForm() {
  const { globalSettings, updateGlobalSettings } = useGlobalSettings();
  const [holdThresholdMs, setHoldThresholdMs] = useState<number>(0);
  const [tapIntervalMs, setTapIntervalMs] = useState<number>(0);

  // 初期値の同期
  useEffect(() => {
    if (globalSettings) {
      setHoldThresholdMs(globalSettings.defaultHoldThresholdMs);
      setTapIntervalMs(globalSettings.defaultTapIntervalMs);
    }
  }, [globalSettings]);

  if (!globalSettings) {
    return <Text>Loading settings...</Text>;
  }

  const onSave = updateGlobalSettings;

  const handleSave = () => {
    onSave({
      defaultHoldThresholdMs: holdThresholdMs,
      defaultTapIntervalMs: tapIntervalMs,
    });
  };
  const hasChanges =
    holdThresholdMs !== globalSettings.defaultHoldThresholdMs ||
    tapIntervalMs !== globalSettings.defaultTapIntervalMs;

  const handleSet =
    (fn: (v: number) => void) => (value: number | undefined) => {
      if (value !== undefined) {
        fn(value);
      }
    };

  return (
    <div className="p-1">
      <EditorSection
        description="すべてのキーのデフォルトの判定時間を設定します。個別のキーで設定されている場合はそちらが優先されます。"
        title="タイミング設定"
      >
        <VStack gap={4}>
          <ActionNumericInput
            id="global-hold-threshold"
            label="長押し判定時間 (ms)"
            onValueChange={handleSet(setHoldThresholdMs)}
            value={holdThresholdMs}
          />
          <Text size="xs" variant="muted">
            キーを長押しと判定するまでの時間
          </Text>

          <ActionNumericInput
            id="global-tap-interval"
            label="ダブルタップ判定間隔 (ms)"
            onValueChange={handleSet(setTapIntervalMs)}
            value={tapIntervalMs}
          />
          <Text size="xs" variant="muted">
            2回のタップをダブルタップと判定する間隔
          </Text>

          <HStack className="justify-end pt-2" gap={2}>
            <Button
              disabled={!hasChanges}
              label="設定を適用"
              onClick={handleSave}
              size="default"
              variant="default"
            />
          </HStack>
        </VStack>
      </EditorSection>
    </div>
  );
}
