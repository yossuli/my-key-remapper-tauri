import { useState } from "react";
import { KeyButton } from "@/components/atoms/KeyButton";
import { Mapped } from "@/components/control/Mapped";
import type {
  LayerState,
  MappingActions,
} from "@/components/pages/KeyRemapperPage";
import { KEYBOARD_LAYOUT_BASE, KEYBOARD_LAYOUT_SHIFT } from "@/constants";
import type { KeyboardLayout, LayoutType } from "@/types";
import type { KeyBinding, TriggerType } from "@/types/remapConfig";

interface KeyboardGridProps {
  bindings: Record<number, KeyBinding[]>;
  keyboardLayout: KeyboardLayout;
  layout: LayoutType;
  layerState: LayerState; // { layers, layerId }
  mappingActions: Pick<MappingActions, "removeMapping">;
  selectedTrigger: TriggerType;
  quickEditingKey?: number | null;
  macroNameMap?: Record<string, string>;
  onKeyClick: (vk: number) => void;
  onMoveMapping?: (
    fromVk: number,
    fromLabel: string,
    toVk: number,
    toLabel: string
  ) => void;
}

interface DraggedKeyInfo {
  vk: number;
  label?: string;
}

function extractDropSourceKey(
  e: React.DragEvent,
  fallback?: DraggedKeyInfo | null
): DraggedKeyInfo | null {
  try {
    const raw = e.dataTransfer.getData("application/json");
    if (raw) {
      return JSON.parse(raw);
    }
    const text = e.dataTransfer.getData("text/plain");
    if (text) {
      return { vk: Number(text) };
    }
  } catch {
    // ignore
  }
  if (fallback) {
    return fallback;
  }
  return null;
}

export function KeyboardGrid({
  bindings, // 🚌 → 🚌🔥 (C. UI Configuration)
  keyboardLayout, // 🚌 → 🚌🔥 (C. UI Configuration)
  layout, // 🚌 → 🚌🔥 (C. UI Configuration)
  layerState, // 🎁 → 🔥 (A. Layer Management Flow)
  mappingActions, // 🎁 → 🔥 (B. Mapping & Remap Actions)
  selectedTrigger, // 🚌🔥 → 🚌🔥 (C. UI Configuration)
  quickEditingKey,
  macroNameMap,
  onKeyClick,
  onMoveMapping,
}: KeyboardGridProps) {
  const [draggedKey, setDraggedKey] = useState<DraggedKeyInfo | null>(null);
  const [dragOverVk, setDragOverVk] = useState<number | null>(null);

  // layerId === "shift" の場合はShiftレイアウトを使用
  const effectiveLayout: KeyboardLayout =
    layerState.layerId === "shift"
      ? KEYBOARD_LAYOUT_SHIFT[layout]
      : (keyboardLayout ?? KEYBOARD_LAYOUT_BASE[layout]);

  const handleDragStart =
    (vk: number, label: string) => (e: React.DragEvent) => {
      console.log(
        `%c[D&D:dragstart] ドラッグ開始: "${label}" (VK: ${vk})`,
        "color: #22c55e; font-weight: bold; font-size: 12px;",
        { vk, label, dataTransfer: e.dataTransfer }
      );
      e.dataTransfer.setData("application/json", JSON.stringify({ vk, label }));
      e.dataTransfer.setData("text/plain", String(vk));
      e.dataTransfer.effectAllowed = "move";

      // 重要: dragstart イベント内で即座に state を更新して DOM を再描画すると、
      // Chrome が「ドラッグ対象の要素が無効化された」と判定して直後に dragend を発火させる現象を防ぐため、
      // 次のイベントループ（setTimeout 0）で state を更新します。
      setTimeout(() => {
        setDraggedKey({ vk, label });
      }, 0);
    };

  const handleDragOver =
    (_vk: number, _label: string) => (e: React.DragEvent) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
    };

  const handleDragEnter =
    (vk: number, label: string) => (e: React.DragEvent) => {
      e.preventDefault();
      if (draggedKey?.vk !== vk) {
        console.log(
          `[D&D:dragenter] キー上へ侵入: "${label}" (VK: ${vk}), ドラッグ中: "${draggedKey?.label}" (VK: ${draggedKey?.vk})`
        );
        setDragOverVk(vk);
      }
    };

  const handleDragLeave =
    (vk: number, label: string) => (e: React.DragEvent) => {
      if (e.currentTarget.contains(e.relatedTarget as Node)) {
        return;
      }
      if (dragOverVk === vk) {
        console.log(`[D&D:dragleave] キーから離脱: "${label}" (VK: ${vk})`);
        setDragOverVk(null);
      }
    };

  const handleDrop =
    (toVk: number, toLabel: string) => (e: React.DragEvent) => {
      e.preventDefault();
      console.log(
        `%c[D&D:drop] ドロップ実行: 移動先="${toLabel}" (VK: ${toVk})`,
        "color: #3b82f6; font-weight: bold; font-size: 12px;",
        { toVk, toLabel, draggedKey }
      );
      setDragOverVk(null);

      const source = extractDropSourceKey(e, draggedKey);
      setDraggedKey(null);

      if (source && source.vk !== toVk) {
        console.log(
          `%c[D&D:drop] リマップ移動モーダル要求: "${source.label}"(VK: ${source.vk}) ➔ "${toLabel}"(VK: ${toVk})`,
          "color: #a855f7; font-weight: bold;"
        );
        onMoveMapping?.(
          source.vk,
          source.label ?? `Key(${source.vk})`,
          toVk,
          toLabel
        );
      } else {
        console.warn(
          "[D&D:drop] ドロップ元の情報が取得できなかったか、同一キーへのドロップです",
          { source, toVk }
        );
      }
    };

  const handleDragEnd = (e: React.DragEvent) => {
    console.log(
      `%c[D&D:dragend] ドラッグ終了: dropEffect="${e.dataTransfer.dropEffect}"`,
      "color: #f59e0b; font-weight: bold;",
      draggedKey
    );
    setDraggedKey(null);
    setDragOverVk(null);
  };

  return (
    <Mapped
      as="div"
      className="flex select-none flex-col gap-2 rounded-xl border bg-card p-4 shadow-sm"
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
      }}
      value={effectiveLayout}
    >
      {({ row }) => (
        <Mapped
          as="div"
          className="flex justify-center gap-1.5"
          onDragOver={(e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = "move";
          }}
          value={row}
        >
          {(keyDef) => {
            const baseVk = Array.isArray(keyDef.vk) ? keyDef.vk[0] : keyDef.vk;
            const hasCurrentBindings = (bindings[baseVk]?.length ?? 0) > 0;
            const hasAnyLayerBindings = layerState.layers.some(
              (l) => (l.bindings[baseVk]?.length ?? 0) > 0
            );
            const hasBindings = hasCurrentBindings || hasAnyLayerBindings;
            const isDraggable = !quickEditingKey && hasBindings;
            const isDragging = draggedKey?.vk === baseVk;
            const isDragOver =
              dragOverVk === baseVk && draggedKey?.vk !== baseVk;

            return (
              <KeyButton
                bindings={bindings[baseVk]} // 🚌🔥 → 🔥 (C. UI Configuration)
                isDraggable={isDraggable}
                isDragging={isDragging}
                isDragOver={isDragOver}
                isQuickEditing={quickEditingKey === baseVk}
                keyDef={keyDef}
                layerId={layerState.layerId} // ∈ → 🔥 (A. Layer Management Flow)
                layout={layout} // 🚌🔥 → 🔥 (C. UI Configuration)
                macroNameMap={macroNameMap}
                onClick={onKeyClick}
                onDragEnd={handleDragEnd}
                onDragEnter={handleDragEnter(baseVk, keyDef.label)}
                onDragLeave={handleDragLeave(baseVk, keyDef.label)}
                onDragOver={handleDragOver(baseVk, keyDef.label)}
                onDragStart={handleDragStart(baseVk, keyDef.label)}
                onDrop={handleDrop(baseVk, keyDef.label)}
                onRemove={() => mappingActions.removeMapping(baseVk)} // ∈ → 🔥 (B. Mapping & Remap Actions)
                selectedTrigger={selectedTrigger} // 🚌🔥 → 🔥 (C. UI Configuration)
              />
            );
          }}
        </Mapped>
      )}
    </Mapped>
  );
}
