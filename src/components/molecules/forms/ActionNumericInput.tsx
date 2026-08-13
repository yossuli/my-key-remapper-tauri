import { Input } from "@/components/atoms/Input";
import { VStack } from "@/components/template/Flex";
import { handleNumericInput } from "@/utils/handleNumericInput";

interface ActionNumericInputProps {
  id: string;
  label: string;
  value: number | undefined;
  placeholder?: string;
  onValueChange: (value: number | undefined) => void;
  setIsInputFocused?: (focused: boolean) => void;
}

/**
 * 宣言的な数値入力コンポーネント
 * undefined (空入力) を明示的に許容し、セッターを直接呼び出します
 */
export function ActionNumericInput({
  id,
  label,
  value,
  placeholder = "現在値を維持",
  onValueChange,
  setIsInputFocused,
}: ActionNumericInputProps) {
  return (
    <VStack gap={1}>
      <Input
        id={id}
        input-min="0"
        input-onChange={handleNumericInput(onValueChange, { min: 0 })}
        input-placeholder={placeholder}
        input-type="number"
        input-value={value ?? ""}
        label={label}
        setFocused={setIsInputFocused}
      />
    </VStack>
  );
}
