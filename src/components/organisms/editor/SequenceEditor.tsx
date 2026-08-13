import { Reorder } from "framer-motion";
import { HandleEmpty } from "@/components/control/HandleEmpty";
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
      <HandleEmpty
        array={actions.map((a, i) => ({ ...a, id: a._uiId, _index: i }))}
        empty={
          <div className="py-8 text-center text-muted-foreground">
            アクションがありません。下部ボタンから追加してください。
          </div>
        }
      >
        {(action) => (
          <Reorder.Item
            className="flex select-none items-center gap-3 rounded-md border border-border bg-secondary/30 p-2 transition-colors has-[[data-action=edit]:hover]:bg-secondary"
            key={action._uiId}
            value={action}
          >
            <ActionItem
              action={action}
              actionSummaryHandlers={actionSummaryHandlers}
              index={action._index}
              onDelete={() => onDeleteAction(action._index)}
              onEdit={() => onEditAction(action._index)}
            />
          </Reorder.Item>
        )}
      </HandleEmpty>
    </Reorder.Group>
  );
}
