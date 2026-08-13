import type { ReactNode } from "react";
import {
  Button as ShadcnButton,
  type ButtonProps as ShadcnButtonProps,
} from "@/components/ui/button";

interface ButtonProps extends ShadcnButtonProps {
  children?: ReactNode;
  label?: string;
}

export function Button({ children, label, ...props }: ButtonProps): ReactNode {
  return <ShadcnButton {...props}>{children ?? label}</ShadcnButton>;
}
