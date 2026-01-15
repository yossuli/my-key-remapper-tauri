import type { Action, MacroDef } from "@shared/types/remapConfig";
import { ArrowLeft, Plus, Save } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/atoms/Button";
import { Icon } from "@/components/atoms/Icon";
import { Input } from "@/components/atoms/Input";
import { Show } from "@/components/control/Show";
import { SequenceEditor } from "@/components/organisms/editor/SequenceEditor";
import { UnifiedActionEditor } from "@/components/organisms/editor/UnifiedActionEditor";
import { HStack, VStack } from "@/components/template/Flex";
import { ModalLayout } from "@/components/template/ModalLayout";
import { useLayerState } from "@/hooks/useLayerState";
import { useRemapControl } from "@/hooks/useRemapControl";
import type { ActionSummaryHandlers, IdentifiedAction } from "./types";
import { toAction, toIdentifiedAction } from "./utils";

interface MacroEditFormProps {
  initialMacro?: MacroDef;
  onSave: (macro: MacroDef) => void;
  onCancel: () => void;
  actionSummaryHandlers: ActionSummaryHandlers;
}

export function MacroEditForm({
  initialMacro,
  onSave,
  onCancel,
  actionSummaryHandlers,
}: MacroEditFormProps) {
  const [name, setName] = useState(initialMacro?.name ?? "新規マクロ");
  // UI内部では _uiId 付きの IdentifiedAction として管理する
  const [actions, setActions] = useState<IdentifiedAction[]>(
    initialMacro?.actions.map(toIdentifiedAction) ?? []
  );
  const [macroId] = useState(initialMacro?.id ?? crypto.randomUUID());
  const { layers } = useLayerState();
  const { disableRemap, enableRemap } = useRemapControl();

  // アクション編集用のステート
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [isAdding, setIsAdding] = useState(false);

  const handleAddStart = () => {
    disableRemap();
    setIsAdding(true);
  };

  const handleEditStart = (index: number) => {
    disableRemap();
    setEditingIndex(index);
  };

  const handleSaveStep = (action: Action) => {
    if (isAdding) {
      // 新規追加時は _uiId を付与して追加
      setActions([...actions, toIdentifiedAction(action)]);
    } else if (editingIndex !== null) {
      setActions(
        actions.map((a, i) =>
          i === editingIndex
            ? { ...toIdentifiedAction(action), _uiId: a._uiId }
            : a
        )
      );
    }
    handleCloseModal();
  };

  const handleCloseModal = () => {
    enableRemap();
    setIsAdding(false);
    setEditingIndex(null);
  };

  const handleDeleteAction = (index: number) => {
    setActions(actions.filter((_, i) => i !== index));
  };

  const handleSave = () => {
    onSave({ id: macroId, name, actions: actions.map(toAction) });
  };

  const initialAction =
    editingIndex !== null ? toAction(actions[editingIndex]) : undefined;

  return (
    <VStack className="h-full w-full" gap={6}>
      <HStack className="items-center justify-between border-border border-b pb-4">
        <HStack className="items-center" gap={2}>
          <Button onClick={onCancel} size="icon" variant="ghost">
            <Icon icon={ArrowLeft} />
          </Button>
          <h2 className="font-bold text-xl">マクロ編集</h2>
        </HStack>
        <Button disabled={!name} onClick={handleSave} variant="default">
          <Icon className="mr-2" icon={Save} />
          保存
        </Button>
      </HStack>

      <VStack gap={2}>
        <label
          className="flex flex-col gap-2 font-medium text-muted-foreground text-sm"
          htmlFor="macro-name-input"
        >
          マクロ名
          <Input
            id="macro-name-input"
            input-onChange={(e) => setName(e.target.value)}
            input-placeholder="マクロ名を入力"
            input-value={name}
          />
        </label>
      </VStack>

      <div className="flex-1 overflow-auto rounded-md border border-border bg-background/50 p-4">
        <SequenceEditor
          actionSummaryHandlers={actionSummaryHandlers}
          actions={actions}
          onChange={setActions}
          onDeleteAction={handleDeleteAction}
          onEditAction={handleEditStart}
        />

        <Show condition={actions.length === 0}>
          <div className="py-8 text-center text-muted-foreground">
            アクションがありません。下部ボタンから追加してください。
          </div>
        </Show>
      </div>

      <div className="border-border border-t pt-4">
        <Button
          className="w-full gap-2 border-dashed"
          onClick={handleAddStart}
          variant="outline"
        >
          <Icon icon={Plus} />
          アクションを追加
        </Button>
      </div>

      <ModalLayout
        onClose={handleCloseModal}
        value={isAdding || editingIndex !== null}
      >
        {() => (
          <UnifiedActionEditor
            currentMacroId={macroId}
            handleEditorClose={handleCloseModal}
            initialAction={initialAction}
            layers={layers} // TODO: レイアウトをページから引き継ぐ
            layout="JIS"
            onSave={(action) => handleSaveStep(action)}
          />
        )}
      </ModalLayout>
    </VStack>
  );
}
