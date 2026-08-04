// キーイベントログ管理のカスタムフック

import { useCallback, useState } from "react";
import { useIpcEvent } from "@/hooks/api/useIpc";

interface LogEntry {
  id: string;
  vkCode: number;
  time: string;
}

const MAX_LOG_ENTRIES = 19;

export interface UseKeyEventLogReturn {
  logs: LogEntry[];
  clearLogs: () => void;
  isPaused: boolean;
  setIsPaused: (paused: boolean) => void;
}

/**
 * キーイベントログを管理するカスタムフック
 */
export function useKeyEventLog(): UseKeyEventLogReturn {
  const [logs, setLogs] = useState<UseKeyEventLogReturn["logs"]>([]);
  const [isPaused, setIsPaused] = useState(false);

  const handleKeyEvent = useCallback(
    (...args: unknown[]) => {
      if (isPaused) {
        return; // 一時停止中はスキップ
      }

      const data = args[0] as { vkCode: number };
      setLogs((prev) => [
        {
          id: crypto.randomUUID(),
          vkCode: data.vkCode,
          time: new Date().toLocaleTimeString(),
        },
        ...prev.slice(0, MAX_LOG_ENTRIES),
      ]);
    },
    [isPaused]
  );

  useIpcEvent("key-event", handleKeyEvent);

  const clearLogs = useCallback<UseKeyEventLogReturn["clearLogs"]>(() => {
    setLogs([]);
  }, []);

  return { logs, clearLogs, isPaused, setIsPaused };
}

export type { LogEntry };
