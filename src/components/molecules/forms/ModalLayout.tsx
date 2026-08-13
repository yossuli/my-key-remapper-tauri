import type { ReactNode } from "react";
import { Dialog } from "@/components/atoms/Dialog";

interface ModalLayoutProps<T> {
  value: T | null;
  title?: string;
  children: (value: T) => ReactNode;
  onClose: () => void;
}

export function ModalLayout<T>({
  value,
  title,
  children,
  onClose,
}: ModalLayoutProps<T>) {
  const isOpen = !!value;

  return (
    <Dialog onClose={onClose} open={isOpen} title={title}>
      {value !== null && children(value)}
    </Dialog>
  );
}
