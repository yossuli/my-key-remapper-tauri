import { useEffect, useState } from "react";
import { Button } from "@/components/atoms/Button";
import { Input } from "@/components/atoms/Input";
import { Text } from "@/components/atoms/Text";
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

  return (
    <VStack gap={4}>
      <VStack gap={1}>
        <Text weight="semibold">タイミング設定</Text>
        <Text size="sm" variant="muted">
          すべてのキーのデフォルトの判定時間を設定します。個別のキーで設定されている場合はそちらが優先されます。
        </Text>
      </VStack>

      <VStack gap={3}>
        <VStack gap={1}>
          <Input
            id="global-hold-threshold"
            input-min="1"
            input-onChange={(e) => {
              const val = e.target.value;
              const num = Number.parseInt(val, 10);
              if (!Number.isNaN(num) && num > 0) {
                setHoldThresholdMs(num);
              }
            }}
            input-type="number"
            input-value={holdThresholdMs}
            label="長押し判定時間 (ms)"
          />
          <Text size="xs" variant="muted">
            キーを長押しと判定するまでの時間
          </Text>
        </VStack>

        <VStack gap={1}>
          <Input
            id="global-tap-interval"
            input-min="1"
            input-onChange={(e) => {
              const val = e.target.value;
              const num = Number.parseInt(val, 10);
              if (!Number.isNaN(num) && num > 0) {
                setTapIntervalMs(num);
              }
            }}
            input-type="number"
            input-value={tapIntervalMs}
            label="ダブルタップ判定間隔 (ms)"
          />
          <Text size="xs" variant="muted">
            2回のタップをダブルタップと判定する間隔
          </Text>
        </VStack>
      </VStack>

      <HStack className="justify-end" gap={2}>
        <Button
          disabled={!hasChanges}
          label="保存"
          onClick={handleSave}
          size="default"
          variant="default"
        />
      </HStack>
    </VStack>
  );
}
