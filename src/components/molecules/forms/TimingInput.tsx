import { Input } from "@/components/atoms/Input";
import { VStack } from "@/components/template/Flex";
import { handlePositiveNumberInput } from "@/utils/handlePositiveNumberInput";

interface TimingInputProps {
  id: string;
  label: string;
  value: number | undefined;
  defaultValue: number | undefined;
  onValueChange: (value: number | undefined) => void;
  setFocused: (focused: boolean) => void;
}

export function TimingInput({
  id,
  label,
  value,
  defaultValue,
  onValueChange,
  setFocused,
}: TimingInputProps) {
  return (
    <VStack gap={1}>
      <Input
        id={id}
        input-min="1"
        input-onChange={handlePositiveNumberInput(onValueChange)}
        input-placeholder={String(defaultValue ?? "-")}
        input-type="number"
        input-value={value ?? ""}
        label={label}
        setFocused={setFocused}
      />
      <span className="text-muted-foreground text-xs">
        (デフォルト: {defaultValue ? `${defaultValue}ms` : "設定されていません"}
        )
      </span>
    </VStack>
  );
}
