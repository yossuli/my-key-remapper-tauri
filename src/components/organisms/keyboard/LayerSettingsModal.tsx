import type { Layer } from "@/types/remapConfig";
import { useEffect, useState } from "react";
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

          {/* Layer Inheritance Section */}
          <VStack gap={2}>
            <h3 className="font-semibold text-sm">Layer Inheritance</h3>
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
