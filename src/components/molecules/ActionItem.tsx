import { useDragControls } from "framer-motion";
import { GripVertical, Trash2 } from "lucide-react";
import { Button } from "@/components/atoms/Button";
import { Icon } from "@/components/atoms/Icon";
import { ListCellButton } from "@/components/atoms/ListCellButton";
import { RichText } from "@/components/atoms/RichText";
import { Else, Ternary, Then } from "@/components/control/Ternary";
import { HStack } from "@/components/template/Flex";
import { useMacros } from "@/hooks/api/useMacros";
import { DEFAULT_SCROLL_SENSITIVITY } from "@/models/bindingStateModel";
import type { Action } from "@/types/remapConfig";
import { getKeyLabel } from "@/utils/getKeyLabel";
import { objectiveDiscriminantSwitch } from "@/utils/objectiveSwitch";
import type { ActionSummaryHandlers } from "../organisms/macro/types";

interface ActionItemProps {
  action: Action;
  index: number;
  onEdit: () => void;
  onDelete: () => void;
  actionSummaryHandlers: ActionSummaryHandlers;
}

export function ActionItem({
  action,
  index,
  onEdit,
  onDelete,
  actionSummaryHandlers,
}: ActionItemProps) {
  const controls = useDragControls();
  const { macros } = useMacros();
  const { onNavigate } = actionSummaryHandlers;

  const summaryContent = objectiveDiscriminantSwitch<
    Action,
    "type",
    React.ReactNode
  >(
    {
      remap: (a) =>
        `キー入力: **${getKeyLabel(a.keys, "JIS")}**${a.repeat ? " ((リピート))" : ""}`,
      delay: (a) => `待機: **${a.delayMs}ms**`,
      mouseMove: (a) =>
        `マウス移動: **X:${a.x ?? "維持"}, Y:${a.y ?? "維持"}**`,
      mouseClick: (a) =>
        `クリック: **${a.button}**${
          (a.clickCount ?? 1) > 1 ? ` ((x${a.clickCount}))` : ""
        }${
          a.x !== undefined || a.y !== undefined
            ? ` ((X:${a.x ?? "維持"}, Y:${a.y ?? "維持"}))`
            : " ((現在地))"
        }`,
      layerToggle: (a) => `レイヤー切替: **[[${a.layerId}]]**`,
      layerMomentary: (a) => `レイヤー一時切替: **[[${a.layerId}]]**`,
      macro: (a) => {
        const macroName = macros.find((m) => m.id === a.macroId)?.name;
        const displayText = `${macroName ?? a.macroId}`;

        return (
          <span className="flex w-full items-center">
            <ListCellButton
              className="w-auto px-2 py-2"
              data-action="edit"
              onClick={onEdit}
            >
              マクロ実行:
            </ListCellButton>
            <Button
              className="ml-1 px-1 font-mono text-blue-400 hover:bg-blue-400/10 hover:underline"
              onClick={(e) => {
                e.stopPropagation();
                onNavigate(a.macroId);
              }}
              type="button"
              variant="ghost"
            >
              {displayText}
            </Button>
            <ListCellButton
              className="px-2 py-2"
              data-action="edit"
              onClick={onEdit}
            />
          </span>
        );
      },
      cursorSave: () => "カーソル位置記憶",
      cursorRestore: () => "カーソル位置復元",
      scrollMode: (a) =>
        `トラックパッドスクロール (感度: **${(a.sensitivity ?? DEFAULT_SCROLL_SENSITIVITY).toFixed(1)}x**${
          a.invert ? ", 反転" : ""
        })`,
      none: () => "((なし))",
    },
    action,
    "type"
  );

  return (
    <HStack className="w-full items-center justify-between">
      <div
        className="cursor-grab touch-none rounded p-1 hover:bg-muted"
        onPointerDown={(e) => controls.start(e)}
      >
        <Icon className="text-muted-foreground" icon={GripVertical} size="sm" />
      </div>

      <HStack as="div" className="flex-1 font-mono text-sm">
        <span className="px-2 text-muted-foreground">{index + 1}.</span>
        <Ternary condition={typeof summaryContent === "string"}>
          <Then>
            <ListCellButton
              className="px-2 py-2"
              data-action="edit"
              onClick={onEdit}
            >
              <RichText text={summaryContent as string} />
            </ListCellButton>
          </Then>
          <Else>{summaryContent}</Else>
        </Ternary>
      </HStack>

      <HStack gap={1}>
        <Button
          className="text-destructive hover:bg-destructive/10"
          onClick={onDelete}
          size="icon"
          variant="ghost"
        >
          <Icon icon={Trash2} size="sm" />
        </Button>
      </HStack>
    </HStack>
  );
}
