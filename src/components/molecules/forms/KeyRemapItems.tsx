import { WithRemoveBadge } from "@/components/atoms/RemoveBadge";
import { HandleEmpty } from "@/components/control/HandleEmpty";
import { KeyDisplay } from "@/components/molecules/display/KeyDisplay";
import type { LayoutType } from "@/types";

interface KeyRemapItemsProps {
  keys: number[];
  layout: LayoutType;
  showVkInput: boolean;
  onRemoveKey: (vk: number) => void;
  isRemoveDisabled?: (vk: number) => boolean;
}

export function KeyRemapItems({
  keys,
  layout,
  showVkInput,
  onRemoveKey,
  isRemoveDisabled,
}: KeyRemapItemsProps) {
  return (
    <HandleEmpty
      array={keys.map((vk) => ({ id: vk }))}
      empty={
        <span className="rounded-md border border-muted-foreground border-dashed px-4 py-2 text-muted-foreground text-sm">
          {showVkInput ? "数値を入力して追加" : "キーを長押して選択"}
        </span>
      }
    >
      {({ id: vk }) => (
        <WithRemoveBadge
          disabled={isRemoveDisabled?.(vk) || keys.length === 1}
          onRemove={() => onRemoveKey(vk)}
        >
          <KeyDisplay layout={layout} variant="primary" vkCode={vk} />
        </WithRemoveBadge>
      )}
    </HandleEmpty>
  );
}
