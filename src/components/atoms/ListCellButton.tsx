import { Button } from "@/components/atoms/Button";
import type { ButtonProps } from "@/components/ui/button";
import { cn } from "@/utils";

export function ListCellButton({ className, ...props }: ButtonProps) {
  return (
    <Button
      className={cn(
        "h-auto w-full justify-start px-4 py-3 font-medium hover:bg-transparent",
        className
      )}
      variant="ghost"
      {...props}
    />
  );
}
