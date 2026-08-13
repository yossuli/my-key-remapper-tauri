import type { InputHTMLAttributes, LabelHTMLAttributes } from "react";
import { Show } from "@/components/control/Show";
import { HStack, VStack } from "@/components/template/Flex";
import { Input as ShadcnInput } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { AddPrefix } from "@/types";
import { cn } from "@/utils/cn";

interface InputProps
  extends AddPrefix<InputHTMLAttributes<HTMLInputElement>, "input-">,
    AddPrefix<LabelHTMLAttributes<HTMLLabelElement>, "label-"> {
  label?: string;
  error?: string;
  id: string;
  className?: string;
  setFocused?: (focused: boolean) => void;
  horizontal?: boolean; // labelとinputを横並びにするかどうか
}

export function Input({
  label,
  error,
  "input-className": inputClassName,
  "label-className": labelClassName,
  className,
  id,
  setFocused,
  horizontal = false,
  ...props
}: InputProps) {
  const labelProps = Object.fromEntries(
    Object.entries(props)
      .filter(([key]) => key.startsWith("label-"))
      .map(([key, value]) => [key.replace("label-", ""), value])
  );
  const inputProps = Object.fromEntries(
    Object.entries(props)
      .filter(([key]) => key.startsWith("input-"))
      .map(([key, value]) => [key.replace("input-", ""), value])
  );

  const Container = horizontal ? HStack : VStack;
  const containerProps = horizontal
    ? ({ gap: 2, className: cn("items-center", className) } as const)
    : ({ gap: 2, className } as const);

  return (
    <VStack className={className} gap={2}>
      <Container {...containerProps}>
        <Show condition={Boolean(label)}>
          <Label
            className={cn(
              "font-medium text-muted-foreground text-xs",
              !!horizontal && "whitespace-nowrap",
              labelClassName
            )}
            htmlFor={id}
            {...labelProps}
          >
            {label}
          </Label>
        </Show>
        <ShadcnInput
          className={cn(
            Boolean(error) &&
              "border-destructive focus-visible:ring-destructive",
            inputClassName
          )}
          id={id}
          onBlur={() => setFocused?.(false)}
          onFocus={() => setFocused?.(true)}
          {...inputProps}
        />
      </Container>
      <Show condition={Boolean(error)}>
        <p className="text-destructive text-xs">{error}</p>
      </Show>
    </VStack>
  );
}
