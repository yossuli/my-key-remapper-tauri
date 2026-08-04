import { AlertCircle } from "lucide-react";
import { useState } from "react";
import { Icon } from "@/components/atoms/Icon";
import { HandleEmpty } from "@/components/control/HandleEmpty";
import { LogEntry } from "@/components/molecules/display/LogEntry";
import { VStack } from "@/components/template/Flex";
import { useKeyEventLog } from "@/hooks/ui/useKeyEventLog";
import { useIpc } from "@/hooks/api/useIpc";

export function LogList() {
  const { logs, isPaused, setIsPaused } = useKeyEventLog();
  const [debugEnabled, setDebugEnabled] = useState(false);
    const { send } = useIpc();
    const toggleDebug = () => {
      const newState = !debugEnabled;
      setDebugEnabled(newState);
      send("set-debug-log-enabled", {
        enabled: newState,
      });
    };

  return (
    <section className="flex h-fit flex-col overflow-hidden rounded-xl border bg-card shadow-sm">
      <div className="flex items-center gap-2 border-b bg-muted/30 p-4">
        <Icon className="text-accent-foreground" icon={AlertCircle} />
        <h2 className="font-semibold text-sm">Live Event Log</h2>
        <div className="ml-auto flex items-center gap-4">
          {/* TODO - 後でShadcn UIのToggleを導入する */}
          <div className="flex items-center gap-2">
            <label
              className="cursor-pointer select-none text-muted-foreground text-xs hover:text-foreground"
              htmlFor="pause-toggle"
            >
              {isPaused ? "Resume" : "Pause"}
            </label>
            <input
              checked={isPaused}
              className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
              id="pause-toggle"
              onChange={(e) => setIsPaused(e.target.checked)}
              type="checkbox"
            />
          </div>
          <div className="flex items-center gap-2 border-l pl-4">
            <label
              className="cursor-pointer select-none text-muted-foreground text-xs hover:text-foreground"
              htmlFor="debug-toggle"
            >
              Debug Log
            </label>
            <input
              checked={debugEnabled}
              className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
              id="debug-toggle"
              onChange={toggleDebug}
              type="checkbox"
            />
          </div>
        </div>
      </div>
      <VStack
        className="max-h-[400px] flex-1 overflow-y-auto p-4 font-mono text-sm"
        gap={2}
      >
        <HandleEmpty
          array={logs}
          empty={
            <p className="text-muted-foreground text-xs italic">
              Waiting for input...
            </p>
          }
        >
          {(log) => (
            <LogEntry key={log.id} time={log.time} vkCode={log.vkCode} />
          )}
        </HandleEmpty>
      </VStack>
    </section>
  );
}
