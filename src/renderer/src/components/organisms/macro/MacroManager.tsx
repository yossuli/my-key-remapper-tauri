import { Else, Ternary, Then } from "@/components/control/Ternary";
import { ConfirmDialog } from "@/components/molecules/ConfirmDialog";
import { Box, HStack, VStack } from "@/components/template/Flex";
import { useMacros } from "@/hooks/api/useMacros";
import { MacroEditForm } from "./MacroEditForm";
import { MacroList } from "./MacroList";

export function MacroManager() {
  const {
    macros,
    editingId,
    isAddingNew,
    deleteTargetId,
    selectedMacro,
    setDeleteTargetId,
    handlers,
  } = useMacros();

  const { executeDelete, ...otherHandlers } = handlers;

  return (
    <HStack className="h-[calc(100vh-180px)] items-stretch" gap={6}>
      <Box className="w-80 overflow-y-auto border-border border-r pr-6">
        <MacroList macros={macros} {...otherHandlers} />
      </Box>

      <Box className="flex-1 overflow-y-auto pl-2">
        <Ternary condition={editingId !== null || isAddingNew}>
          <Then>
            <MacroEditForm
              actionSummaryHandlers={{ onNavigate: otherHandlers.onEdit }}
              initialMacro={selectedMacro}
              key={editingId || "new"}
              {...otherHandlers}
            />
          </Then>
          <Else>
            <VStack className="h-full items-center justify-center text-muted-foreground">
              <p>左側のリストからマクロを選択するか、新規作成してください</p>
            </VStack>
          </Else>
        </Ternary>
      </Box>

      <ConfirmDialog
        description={`この操作は取り消せません。マクロ「${macros.find((m) => m.id === deleteTargetId)?.name}」を削除してもよろしいですか？`}
        onConfirm={executeDelete}
        onOpenChange={(open) => !open && setDeleteTargetId(null)}
        open={!!deleteTargetId}
        title="マクロを削除しますか？"
      />
    </HStack>
  );
}
