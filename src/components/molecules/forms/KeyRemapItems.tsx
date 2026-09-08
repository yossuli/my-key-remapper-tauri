import { WithRemoveBadge } from "@/components/atoms/RemoveBadge";
import { HandleEmpty } from "@/components/control/HandleEmpty";
import { KeyDisplay } from "@/components/molecules/display/KeyDisplay";
import type { LayoutType } from "@/types";
import { findShiftCombinedLabel, isShiftVk } from "@/utils/getKeyLabel";

interface KeyRemapItemsProps {
  keys: number[];
  layout: LayoutType;
  showVkInput: boolean;
  onRemoveKey: (vks: number | number[]) => void;
  isRemoveDisabled?: (vk: number) => boolean;
}

interface DisplayItem {
  id: string;
  vks: number[];
  isCombined: boolean;
}

/**
 * Shift合体キーのペアを抽出する
 */
function tryExtractShiftPair(
  keys: number[],
  layout: LayoutType
): { shiftVk: number; targetVk: number } | null {
  const shiftKeys = keys.filter(isShiftVk);
  const nonShiftKeys = keys.filter((k) => !isShiftVk(k));

  if (shiftKeys.length === 0 || nonShiftKeys.length === 0) {
    return null;
  }

  const shiftVk = shiftKeys[0];
  for (const nonShift of nonShiftKeys) {
    const combined = findShiftCombinedLabel([shiftVk, nonShift], layout);
    if (combined) {
      return { shiftVk, targetVk: nonShift };
    }
  }

  return null;
}

/**
 * キー配列をShift合体キーなどを認識して表示用グループにまとめる
 */
function groupKeys(keys: number[], layout: LayoutType): DisplayItem[] {
  const pair = tryExtractShiftPair(keys, layout);
  if (!pair) {
    return keys.map((k) => ({
      id: `key-${k}`,
      vks: [k],
      isCombined: false,
    }));
  }

  const result: DisplayItem[] = [
    {
      id: `combined-${pair.shiftVk}-${pair.targetVk}`,
      vks: [pair.shiftVk, pair.targetVk],
      isCombined: true,
    },
  ];

  const processed = new Set<number>([pair.shiftVk, pair.targetVk]);
  for (const k of keys) {
    if (!processed.has(k)) {
      result.push({
        id: `key-${k}`,
        vks: [k],
        isCombined: false,
      });
      processed.add(k);
    }
  }

  return result;
}

export function KeyRemapItems({
  keys = [],
  layout,
  showVkInput,
  onRemoveKey,
  isRemoveDisabled,
}: KeyRemapItemsProps) {
  const safeKeys = keys ?? [];
  const displayItems = groupKeys(safeKeys, layout);

  return (
    <HandleEmpty
      array={displayItems}
      empty={
        <span className="rounded-md border border-muted-foreground border-dashed px-4 py-2 text-muted-foreground text-sm">
          {showVkInput ? "数値を入力して追加" : "キーを長押して選択"}
        </span>
      }
    >
      {(item) => (
        <WithRemoveBadge
          disabled={
            (!item.isCombined && isRemoveDisabled?.(item.vks[0])) ||
            safeKeys.length === item.vks.length
          }
          onRemove={() => onRemoveKey(item.vks)}
        >
          <KeyDisplay layout={layout} variant="primary" vkCode={item.vks} />
        </WithRemoveBadge>
      )}
    </HandleEmpty>
  );
}
