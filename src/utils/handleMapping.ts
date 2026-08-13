import type { Action, Layer, TriggerType } from "@/types/remapConfig";
import { applyIf } from "@/utils/appryIf";

export const upsert =
  (layerId: string, from: number, trigger: TriggerType, action: Action) =>
  (prev: Layer[]) =>
    prev.map(
      applyIf(
        (l) => l.id === layerId,
        (l) => {
          // 既存のバインディングから同じトリガーのものを除去
          const existingBindings = l.bindings[from] ?? [];
          const filteredBindings = existingBindings.filter(
            (b) => b.trigger !== trigger
          );
          // 新しいバインディングを追加
          const newBinding = { trigger, action };
          return {
            ...l,
            bindings: {
              ...l.bindings,
              [from]: [...filteredBindings, newBinding],
            },
          };
        }
      )
    );

export const remove =
  (layerId: string, from: number, trigger: TriggerType) => (prev: Layer[]) =>
    prev.map(
      applyIf(
        (l) => l.id === layerId,
        (l) => {
          const filtered =
            l.bindings[from]?.filter((b) => b.trigger !== trigger) ?? [];
          if (filtered.length === 0) {
            const { [from]: _, ...newBindings } = l.bindings;
            return { ...l, bindings: newBindings };
          }
          return { ...l, bindings: { ...l.bindings, [from]: filtered } };
        }
      )
    );
