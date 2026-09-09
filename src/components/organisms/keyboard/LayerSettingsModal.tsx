import { useEffect, useMemo, useState } from "react";
import { Select } from "@/components/atoms/Select";
import { KeyRemapList } from "@/components/molecules/forms/KeyRemapList";
import { VStack } from "@/components/template/Flex";
import { ModalLayout } from "@/components/template/ModalLayout";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import type { LayoutType } from "@/types";
import type { Layer } from "@/types/remapConfig";

interface LayerSettingsModalProps {
  layerId: string | null;
  layers: Layer[];
  layout: LayoutType;
  onUpdate: (layerId: string, updates: Partial<Layer>) => void;
  onClose: () => void;
}

export function LayerSettingsModal({
  layerId,
  layers,
  layout,
  onUpdate,
  onClose,
}: LayerSettingsModalProps) {
  const layer = layers.find((l) => l.id === layerId);
  const [isActiveKeysOpen, setIsActiveKeysOpen] = useState(false);

  const [modifiers, setModifiers] = useState({
    shift: false,
    ctrl: false,
    alt: false,
    win: false,
  });

  const [inheritModifiers, setInheritModifiers] = useState(true);
  const [passthroughTriggerKey, setPassthroughTriggerKey] = useState(false);
  const [parentLayerId, setParentLayerId] = useState<string>("");

  const parentCandidates = useMemo(() => {
    if (!layerId) return [];
    return layers.filter((l) => {
      if (l.id === layerId) return false;
      let curr = l;
      const visited = new Set<string>([l.id]);
      while (curr.parentLayerId) {
        if (curr.parentLayerId === layerId) return false;
        if (visited.has(curr.parentLayerId)) break;
        visited.add(curr.parentLayerId);
        const next = layers.find((x) => x.id === curr.parentLayerId);
        if (!next) break;
        curr = next;
      }
      return true;
    });
  }, [layers, layerId]);

  // 初期化
  useEffect(() => {
    if (layer) {
      setModifiers({
        shift: !!layer.defaultModifiers?.shift,
        ctrl: !!layer.defaultModifiers?.ctrl,
        alt: !!layer.defaultModifiers?.alt,
        win: !!layer.defaultModifiers?.win,
      });
      setInheritModifiers(layer.inheritModifiers ?? true);
      setPassthroughTriggerKey(layer.passthroughTriggerKey ?? false);
      setParentLayerId(layer.parentLayerId ?? "");
    }
  }, [layer]);

  if (!(layer && layerId)) {
    return null;
  }

  const toggleModifier = (key: keyof typeof modifiers) => {
    const newVal = !modifiers[key];
    const newModifiers = { ...modifiers, [key]: newVal };
    setModifiers(newModifiers);
    onUpdate(layerId, {
      defaultModifiers: {
        ...layer.defaultModifiers,
        [key]: newVal,
      },
    });
  };

  const toggleInheritModifiers = () => {
    const newVal = !inheritModifiers;
    setInheritModifiers(newVal);
    onUpdate(layerId, { inheritModifiers: newVal });
  };

  const togglePassthroughTriggerKey = () => {
    const newVal = !passthroughTriggerKey;
    setPassthroughTriggerKey(newVal);
    onUpdate(layerId, { passthroughTriggerKey: newVal });
  };

  const handleParentLayerChange = (value: string) => {
    const newVal = value === "__none__" ? "" : value;
    setParentLayerId(newVal);
    onUpdate(layerId, { parentLayerId: newVal || undefined });
  };

  const handleUpdateActiveKeys = (newKeys: number[]) => {
    if (layerId) {
      onUpdate(layerId, { activeKeys: newKeys });
    }
  };

  return (
    <ModalLayout
      onClose={onClose}
      title={`Layer Settings: ${layerId}`}
      value={layerId}
    >
      {() => (
        <VStack className="w-[400px] p-4" gap={6}>
          {/* Default Modifiers Section */}
          <VStack gap={3}>
            <VStack gap={2}>
              <h3 className="font-semibold text-sm">Default Modifiers</h3>
              <div className="flex gap-4">
                {Object.keys(modifiers).map((mod) => (
                  <div className="flex items-center gap-2" key={mod}>
                    <Checkbox
                      checked={modifiers[mod as keyof typeof modifiers]}
                      id={`mod-${mod}`}
                      onCheckedChange={() =>
                        toggleModifier(mod as keyof typeof modifiers)
                      }
                    />
                    <Label
                      className="cursor-pointer capitalize"
                      htmlFor={`mod-${mod}`}
                    >
                      {mod}
                    </Label>
                  </div>
                ))}
              </div>
            </VStack>

            {/* Trigger Key Passthrough Option */}
            <VStack gap={1}>
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={passthroughTriggerKey}
                  id="passthrough-trigger-key"
                  onCheckedChange={togglePassthroughTriggerKey}
                />
                <Label
                  className="cursor-pointer text-sm"
                  htmlFor="passthrough-trigger-key"
                >
                  もともとのキーの長押しを無効化しない
                </Label>
              </div>
              <p className="text-muted-foreground text-xs leading-relaxed">
                ONにすると、Shiftキー等の長押しをOSにそのまま通し、Shift+クリックやアプリ固有の操作を可能にします。リマップ実行時は一時的に無効化されます。
              </p>
            </VStack>
          </VStack>

          {/* Layer Inheritance Section */}
          <VStack gap={3}>
            <h3 className="font-semibold text-sm">Layer Inheritance</h3>

            {/* Parent Layer Select */}
            <VStack gap={2}>
              <Label
                className="text-xs font-medium text-muted-foreground"
                htmlFor="parent-layer-select"
              >
                親レイヤー (継承元)
              </Label>
              <Select
                id="parent-layer-select"
                label=""
                onValueChange={handleParentLayerChange}
                options={[
                  { id: "__none__", value: "__none__", label: "なし (None)" },
                  ...parentCandidates.map((l) => ({
                    id: l.id,
                    value: l.id,
                    label: l.id.charAt(0).toUpperCase() + l.id.slice(1),
                  })),
                ]}
                select-value={parentLayerId || "__none__"}
              />
              <p className="text-muted-foreground text-xs leading-relaxed">
                このレイヤーで未定義のキーは、親レイヤーのリマップ設定を自動的に引き継ぎます。
              </p>
            </VStack>

            <div className="flex items-center gap-2">
              <Checkbox
                checked={inheritModifiers}
                id="inherit-modifiers"
                onCheckedChange={toggleInheritModifiers}
              />
              <Label className="cursor-pointer" htmlFor="inherit-modifiers">
                下のレイヤーの設定を引き継ぐ (Inherit from lower layers)
              </Label>
            </div>
            <p className="text-muted-foreground text-xs">
              OFF
              にすると、このレイヤーより下位のレイヤーの修飾キーと追加キーが無視されます
            </p>
          </VStack>

          {/* Active Keys Section */}
          <Accordion
            collapsible
            onValueChange={(val) => setIsActiveKeysOpen(val === "active-keys")}
            type="single"
          >
            <AccordionItem className="border-none" value="active-keys">
              <AccordionTrigger className="py-2 font-semibold text-sm hover:no-underline">
                Active Keys (Held)
              </AccordionTrigger>
              <AccordionContent>
                <KeyRemapList
                  initialKeys={layer.activeKeys ?? []}
                  isCaptureEnabled={isActiveKeysOpen}
                  layout={layout}
                  onClear={() => handleUpdateActiveKeys([])}
                  onKeysChange={handleUpdateActiveKeys}
                  requireExplicitAdd
                />
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </VStack>
      )}
    </ModalLayout>
  );
}
