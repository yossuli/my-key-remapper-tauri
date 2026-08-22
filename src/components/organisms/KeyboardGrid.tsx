import { KEYBOARD_LAYOUT_BASE, KEYBOARD_LAYOUT_SHIFT } from "@/constants";
import type { KeyBinding, TriggerType } from "@/types/remapConfig";
import { KeyButton } from "@/components/atoms/KeyButton";
import { Mapped } from "@/components/control/Mapped";
import type {
  LayerState,
  MappingActions,
} from "@/components/pages/KeyRemapperPage";
import type { KeyboardLayout, LayoutType } from "@/types";

interface KeyboardGridProps {
  bindings: Record<number, KeyBinding[]>;
  keyboardLayout: KeyboardLayout;
  layout: LayoutType;
  layerState: LayerState; // { layers, layerId }
  mappingActions: Pick<MappingActions, "removeMapping">;
  selectedTrigger: TriggerType;
  quickEditingKey?: number | null;
  onKeyClick: (vk: number) => void;
}

import React from "react";

export const KeyboardGrid = React.memo(function KeyboardGrid({
  bindings, // 🚌 → 🚌🔥 (C. UI Configuration)
  keyboardLayout, // 🚌 → 🚌🔥 (C. UI Configuration)
  layout, // 🚌 → 🚌🔥 (C. UI Configuration)
  layerState, // 🎁 → 🔥 (A. Layer Management Flow)
  mappingActions, // 🎁 → 🔥 (B. Mapping & Remap Actions)
  selectedTrigger, // 🚌🔥 → 🚌🔥 (C. UI Configuration)
  quickEditingKey,
  onKeyClick,
}: KeyboardGridProps) {
  // layerId === "shift" の場合はShiftレイアウトを使用
  const effectiveLayout: KeyboardLayout =
    layerState.layerId === "shift"
      ? KEYBOARD_LAYOUT_SHIFT[layout]
      : (keyboardLayout ?? KEYBOARD_LAYOUT_BASE[layout]);
  return (
    <Mapped
      as="div"
      className="flex select-none flex-col gap-2 rounded-xl border bg-card p-4 shadow-sm"
      value={effectiveLayout}
    >
      {({ row }) => (
        <Mapped as="div" className="flex justify-center gap-1.5" value={row}>
          {(keyDef) => {
            const baseVk = Array.isArray(keyDef.vk) ? keyDef.vk[0] : keyDef.vk;
            return (
              <KeyButton
                bindings={bindings[baseVk]} // 🚌🔥 → 🔥 (C. UI Configuration)
                isQuickEditing={quickEditingKey === baseVk}
                keyDef={keyDef}
                layerId={layerState.layerId} // ∈ → 🔥 (A. Layer Management Flow)
                layout={layout} // 🚌🔥 → 🔥 (C. UI Configuration)
                onClick={onKeyClick}
                onRemove={() => mappingActions.removeMapping(baseVk)} // ∈ → 🔥 (B. Mapping & Remap Actions)
                selectedTrigger={selectedTrigger} // 🚌🔥 → 🔥 (C. UI Configuration)
              />
            );
          }}
        </Mapped>
      )}
    </Mapped>
  );
});
