import type { ReactNode } from "react";
import {
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Dialog as ShadcnDialog,
} from "@/components/ui/dialog";

interface ModalLayoutProps {
  title?: string;
  children: ReactNode;
  open: boolean;
  onClose: () => void;
}

export function Dialog({ title, children, open, onClose }: ModalLayoutProps) {
  return (
    <ShadcnDialog onOpenChange={(isOpen) => !isOpen && onClose()} open={open}>
      <DialogContent className={title ? "" : "gap-0"}>
        <DialogHeader>
          <DialogTitle className={title ? "" : "sr-only h-0"}>
            {title || "ダイアログ"}
          </DialogTitle>
          <DialogDescription className="sr-only">
            設定ダイアログ
          </DialogDescription>
        </DialogHeader>
        {children}
      </DialogContent>
    </ShadcnDialog>
  );
}
