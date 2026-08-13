import { KEYBOARD_LAYOUT, SWITCH_LAYOUT_RULE } from "@/constants";
import type { TriggerType } from "@/types/remapConfig";
import { useMemo, useState } from "react";
import { RemapDisabler } from "@/components/control/RemapDisabler";
import { Show } from "@/components/control/Show";
import { AppHeader } from "@/components/organisms/AppHeader";
import { UnifiedActionEditor } from "@/components/organisms/editor/UnifiedActionEditor";
import { GlobalSettingsForm } from "@/components/organisms/GlobalSettingsForm";
import { KeyRemapSection } from "@/components/organisms/KeyRemapSection";
import { LayerStatusPanel } from "@/components/organisms/LayerStatusPanel";
import { LogList } from "@/components/organisms/LogList";
import { PressedKeysPanel } from "@/components/organisms/PressedKeysPanel";
import { VStack } from "@/components/template/Flex";
import {
  Header,
  Main,
  MainLayout,
  Side,
} from "@/components/template/MainLayout";
import { ModalLayout } from "@/components/template/ModalLayout";
import {
  type UseLayerStateReturn,
  useLayerState,
} from "@/hooks/api/useLayerState";
import { useRemapControl } from "@/hooks/api/useRemapControl";
import type { LayoutType } from "@/types";

// --- 型定義 ---

export type LayerState = Pick<UseLayerStateReturn, "layers" | "layerId">;

export interface MappingActions {
  saveMapping: UseLayerStateReturn["saveMapping"];
  removeMapping: (from: number) => void;
}

interface KeyRemapperPageProps {
  onNavigateMacros: () => void;
}

export function KeyRemapperPage({ onNavigateMacros }: KeyRemapperPageProps) {
  // カスタムフックでロジックを分離
  const {
    layers,
    layerId,
    currentBindings,
    saveMapping,
    removeMapping,
    ...layerActions
  } = useLayerState();
  const { isActive, toggleActive } = useRemapControl();

  // UI状態
  const [editingKey, setEditingKey] = useState<number | null>(null);
  const [layout, setLayout] = useState<LayoutType>("JIS");
  const [selectedTrigger, setSelectedTrigger] = useState<TriggerType>("tap");
  const [simpleMode, setSimpleMode] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // キーボードレイアウト
  const keyboardLayout = useMemo(() => KEYBOARD_LAYOUT.base[layout], [layout]);

  // 利用可能なレイヤーID一覧
  const availableLayers = useMemo(() => layers.map((l) => l.id), [layers]);

  const toggleLayout = () => {
    setLayout((prev) => SWITCH_LAYOUT_RULE[prev]);
  };

  const handleEditorClose = () => {
    setEditingKey(null);
  };

  const layerState: LayerState = { layers, layerId };
  const mappingActions: MappingActions = {
    saveMapping,
    removeMapping: (from: number) => removeMapping(from, selectedTrigger),
  };
  return (
    <>
      <MainLayout>
        <Header>
          <AppHeader
            isActive={isActive} // 🆕 → 🔥 (E. App Header Control)
            onOpenMacros={onNavigateMacros}
            onOpenSettings={() => setIsSettingsOpen(true)} // 🆕 → 🔥 (E. App Header Control)
            onToggleActive={toggleActive} // 🆕 → 🔥 (E. App Header Control)
            onToggleSimpleMode={() => setSimpleMode((prev) => !prev)} // 🆕 → 🔥 (E. App Header Control)
            simpleMode={simpleMode} // 🆕 → 🔥 (E. App Header Control)
          />
        </Header>
        <Main>
          <Show condition={!simpleMode}>
            <KeyRemapSection
              bindings={currentBindings} // 🆕 → 🚌 (C. UI Configuration)
              keyboardLayout={keyboardLayout} // 🆕 → 🚌 (C. UI Configuration)
              layerActions={layerActions} // 📦 → 🎁 (A. Layer Management Flow)
              layerState={layerState} // 📦 → 🎁 (A. Layer Management Flow)
              layout={layout} // 🆕 → 🚌 (C. UI Configuration)
              mappingActions={mappingActions} // 📦 → 🎁 (B. Mapping & Remap Actions)
              selectedTrigger={selectedTrigger} // 🆕 → 🚌 (D. Event Handlers)
              setEditingKey={setEditingKey} // 📦 → 🎁 (B. Mapping & Remap Actions)
              setSelectedTrigger={setSelectedTrigger} // 🆕 → 🚌🔥 (C. UI Configuration)
              toggleLayout={toggleLayout} // 🆕 → 🚌 (D. Event Handlers)
            />
          </Show>
        </Main>
        <Side>
          <VStack gap={4}>
            <LayerStatusPanel
              availableLayers={availableLayers} // 🆕 → 🧩🔥 (A. Layer Management Flow - Derived)
            />
            <PressedKeysPanel layout={layout} />
            {/* 🆕 → 🔥 (F. Pressed Keys Panel) */}
            <Show condition={!simpleMode}>
              <LogList />
            </Show>
          </VStack>
        </Side>
      </MainLayout>

      <ModalLayout onClose={handleEditorClose} value={editingKey}>
        {(e) => (
          <>
            <RemapDisabler />
            <UnifiedActionEditor
              handleEditorClose={handleEditorClose} // 🆕 → 🧩🔥 (C. UI Configuration)
              initialTrigger={selectedTrigger} // ∈ → 🧩🔥 (A. Layer Management Flow)
              layerId={layerId} // ∈ → 🧩🔥 (A. Layer Management Flow)
              layers={layers} // 🆕 → 🧩🔥 (C. UI Configuration)
              layout={layout} // 🆕 → 🔥 (I. Key Editor Modal)
              onOpenMacros={onNavigateMacros}
              onRemove={() => removeMapping(e, selectedTrigger)} // 🆕 → 🔥 (I. Key Editor Modal)
              onSave={saveMapping(e, selectedTrigger)}
              targetVk={e} // 🆕 → 🔥 (I. Key Editor Modal)
            />
          </>
        )}
      </ModalLayout>

      <ModalLayout
        onClose={() => setIsSettingsOpen(false)}
        value={isSettingsOpen ? true : null}
      >
        {() => <GlobalSettingsForm />}
      </ModalLayout>
    </>
  );
}
