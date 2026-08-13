import type { ActionType, TriggerType } from "@/types/remapConfig";
import type { JSX, ReactNode } from "react";
import { createContext, useContext } from "react";
import { ActionTypeSelector } from "@/components/molecules/forms/ActionTypeSelector";
import { VStack } from "@/components/template/Flex";

interface ActionSelectorContextValue {
  actionType: ActionType;
}

const ActionSelectorContext = createContext<
  ActionSelectorContextValue | undefined
>(undefined);

function useActionSelectorContext(): ActionSelectorContextValue {
  const context = useContext(ActionSelectorContext);
  if (!context) {
    throw new Error(
      "useActionSelectorContext must be used within ActionSelector"
    );
  }
  return context;
}

interface ActionSelectorProps {
  /** アクションタイプ（remap, layerToggle, layerMomentary） */
  actionType: ActionType;
  /** アクションタイプ変更ハンドラ */
  onActionTypeChange: (actionType: ActionType) => void;
  /** 現在選択中のトリガータイプ */
  triggerType: TriggerType;
  /** 子要素（ActionContent など） */
  children?: ReactNode;
  /** gap のサイズ */
  gap: 1 | 2 | 3 | 4 | 6 | 8 | undefined;
}

export function ActionSelector({
  actionType,
  onActionTypeChange,
  triggerType,
  children,
  gap,
}: ActionSelectorProps): JSX.Element {
  return (
    <ActionSelectorContext.Provider value={{ actionType }}>
      <VStack gap={gap}>
        <ActionTypeSelector
          actionType={actionType}
          onActionTypeChange={onActionTypeChange}
          triggerType={triggerType}
        />
        {children}
      </VStack>
    </ActionSelectorContext.Provider>
  );
}

interface ActionSelectorContentProps {
  /** 表示条件となる ActionType（配列の場合はいずれかに一致すれば表示） */
  value: ActionType | ActionType[];
  /** 表示する内容 */
  children: ReactNode;
}

export function ActionSelectorContent({
  value,
  children,
}: ActionSelectorContentProps): JSX.Element | null {
  const { actionType } = useActionSelectorContext();

  const shouldRender = Array.isArray(value)
    ? value.includes(actionType)
    : actionType === value;

  if (!shouldRender) {
    return null;
  }

  return <>{children}</>;
}
