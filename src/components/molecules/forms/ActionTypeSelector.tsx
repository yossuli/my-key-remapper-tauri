import { useMemo } from "react";
import { Select } from "@/components/atoms/Select";
import type { ActionType, TriggerType } from "@/types/remapConfig";

const ACTION_TYPE_OPTIONS = [
  { id: "remap", value: "remap", label: "キーリマップ" },
  { id: "layerToggle", value: "layerToggle", label: "レイヤー切替" },
  {
    id: "layerMomentary",
    value: "layerMomentary",
    label: "レイヤー（押下中）",
  },
  {
    id: "scrollMode",
    value: "scrollMode",
    label: "トラックパッドスクロール（押下中）",
  },
  { id: "mouseMove", value: "mouseMove", label: "マウス移動" },
  { id: "mouseClick", value: "mouseClick", label: "マウスクリック" },
  { id: "cursorSave", value: "cursorSave", label: "カーソル位置記憶" },
  { id: "cursorRestore", value: "cursorRestore", label: "カーソル位置復元" },
  { id: "delay", value: "delay", label: "待機 (Wait)" },
  { id: "macro", value: "macro", label: "マクロ" },
  { id: "none", value: "none", label: "無効化" },
] as const satisfies { id: ActionType; value: ActionType; label: string }[];

interface ActionTypeSelectorProps {
  actionType: ActionType;
  triggerType: TriggerType;
  onActionTypeChange: (actionType: ActionType) => void;
  className?: string;
}

export function ActionTypeSelector({
  actionType,
  triggerType,
  onActionTypeChange,
  className,
}: ActionTypeSelectorProps) {
  // holdトリガーの時のみlayerMomentaryを表示（hold以外では非表示）
  const filteredOptions = useMemo(() => {
    if (triggerType !== "hold") {
      return ACTION_TYPE_OPTIONS.filter((opt) => opt.id !== "layerMomentary");
    }
    return ACTION_TYPE_OPTIONS;
  }, [triggerType]);

  return (
    <Select
      className={className}
      id="actionType"
      label="アクション"
      onValueChange={(e: ActionType) => onActionTypeChange(e)}
      options={filteredOptions}
      select-value={actionType}
    />
  );
}
