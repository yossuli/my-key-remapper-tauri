import { Plus } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/atoms/Button";
import { Icon } from "@/components/atoms/Icon";
import { Input } from "@/components/atoms/Input";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { MAX_VK_CODE, MIN_VK_CODE } from "@/constants/vk";

interface VkDirectInputProps {
  onAddKey: (vk: number) => void;
  onFocusChange: (focused: boolean) => void;
  onOpenChange: (isOpen: boolean) => void;
}

export function VkDirectInput({
  onAddKey,
  onFocusChange,
  onOpenChange,
}: VkDirectInputProps) {
  const [vkInputValue, setVkInputValue] = useState("");

  const handleVkInputConfirm = () => {
    const vk = Number.parseInt(vkInputValue, 10);
    if (!Number.isNaN(vk) && vk >= MIN_VK_CODE && vk <= MAX_VK_CODE) {
      onAddKey(vk);
      setVkInputValue("");
    }
  };

  return (
    <Accordion
      collapsible
      onValueChange={(val) => onOpenChange(val === "vk-input")}
      type="single"
    >
      <AccordionItem className="border-none" value="vk-input">
        <AccordionTrigger className="justify-center text-muted-foreground text-xs hover:no-underline">
          VKコードで直接指定
        </AccordionTrigger>
        <AccordionContent>
          <div className="flex items-center justify-center gap-1">
            <Input
              id="vk-direct-input"
              input-className="w-16 font-mono text-center text-sm"
              input-onChange={(e) => setVkInputValue(e.target.value)}
              input-onKeyDown={(e) =>
                e.key === "Enter" && handleVkInputConfirm()
              }
              input-placeholder="VK"
              input-type="number"
              input-value={vkInputValue}
              setFocused={onFocusChange}
            />
            <Button onClick={handleVkInputConfirm} variant="ghost">
              <Icon icon={Plus} />
            </Button>
          </div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
