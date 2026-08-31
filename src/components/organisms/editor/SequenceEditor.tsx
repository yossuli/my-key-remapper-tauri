import { Reorder } from "framer-motion";
import { ActionItem } from "@/components/molecules/ActionItem";
import type { ActionSummaryHandlers, IdentifiedAction } from "../macro/types";

interface SequenceEditorProps {
  // 並び替えのために一意なIDが必要なので IdentifiedAction を受け取る
  actions: IdentifiedAction[];
  onChange: (newActions: IdentifiedAction[]) => void;
  onEditAction: (index: number) => void;
  onDeleteAction: (index: number) => void;
  actionSummaryHandlers: ActionSummaryHandlers;
}

export function SequenceEditor({
  actions,
  onChange,
  onEditAction,
  onDeleteAction,
  actionSummaryHandlers,
}: SequenceEditorProps) {
  return (
    <Reorder.Group
      axis="y"
      className="flex w-full flex-col gap-2"
      onReorder={onChange}
      values={actions}
    >
      {actions.length === 0 ? (
        <div className="py-8 text-center text-muted-foreground">
          アクションがありません。下部ボタンから追加してください。
        </div>
      ) : (
        actions.map((action, index) => (
          <Reorder.Item
            className="flex select-none items-center gap-3 rounded-md border border-border bg-secondary/30 p-2 transition-colors has-[[data-action=edit]:hover]:bg-secondary"
            key={action._uiId}
            value={action}
          >
            <ActionItem
              action={action}
              actionSummaryHandlers={actionSummaryHandlers}
              index={index}
              onDelete={() => onDeleteAction(index)}
              onEdit={() => onEditAction(index)}
            />
          </Reorder.Item>
        ))
      )}
    </Reorder.Group>
  );
}
