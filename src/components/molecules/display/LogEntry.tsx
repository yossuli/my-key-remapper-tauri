import { Badge } from "@/components/atoms/Badge";

interface LogEntryProps {
  vkCode: number;
  time: string;
}

export function LogEntry({ vkCode, time }: LogEntryProps) {
  return (
    <div className="fade-in slide-in-from-left-2 flex animate-in items-center justify-between duration-200">
      <Badge variant="accent">VK: {vkCode}</Badge>
      <span className="text-muted-foreground text-xs">{time}</span>
    </div>
  );
}
