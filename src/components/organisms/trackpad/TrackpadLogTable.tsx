import { Check, Copy, ListFilter, Trash2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/atoms/Button";
import { CODE_TO_VK } from "@/constants/vk";
import type { TracePoint } from "@/types/trackpad";

interface TrackpadLogTableProps {
  logs: TracePoint[];
  onClear: () => void;
}

export function TrackpadLogTable({ logs, onClear }: TrackpadLogTableProps) {
  const [copied, setCopied] = useState(false);
  const [filterScrollOnly, setFilterScrollOnly] = useState(false);

  const getVkLabel = (vk: number) => CODE_TO_VK[vk] || `VK_${vk}`;

  const filteredLogs = filterScrollOnly
    ? logs.filter((l) => l.isScrollActive)
    : logs;

  const handleCopy = () => {
    const header =
      "Timestamp,EventType,dx,dy,Speed(px/s),dt(ms),Keys,IsScrollActive\n";
    const rows = filteredLogs
      .map(
        (l) =>
          `${l.timestamp},${l.eventType},${l.dx},${l.dy},${l.speed},${l.dt},"${l.pressedKeys.map(getVkLabel).join(" ")}",${l.isScrollActive}`
      )
      .join("\n");

    navigator.clipboard.writeText(header + rows).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-slate-800 bg-slate-900/50 p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ListFilter className="h-4 w-4 text-slate-400" />
          <h3 className="font-semibold text-slate-200 text-sm">
            イベント生ログ ({filteredLogs.length}件)
          </h3>
        </div>

        <div className="flex items-center gap-2">
          <Button
            className={`h-7 border-slate-700 text-xs ${
              filterScrollOnly
                ? "border-pink-500/50 bg-pink-500/20 text-pink-300"
                : "text-slate-400"
            }`}
            onClick={() => setFilterScrollOnly((prev) => !prev)}
            size="sm"
            variant="outline"
          >
            スクロール発動時のみ
          </Button>

          <Button
            className="h-7 text-slate-400 text-xs hover:text-slate-200"
            disabled={filteredLogs.length === 0}
            onClick={handleCopy}
            size="sm"
            variant="ghost"
          >
            {copied ? (
              <>
                <Check className="mr-1 h-3.5 w-3.5 text-emerald-400" />{" "}
                コピー完了
              </>
            ) : (
              <>
                <Copy className="mr-1 h-3.5 w-3.5" /> CSVコピー
              </>
            )}
          </Button>

          <Button
            className="h-7 text-rose-400 text-xs hover:bg-rose-950/30 hover:text-rose-300"
            onClick={onClear}
            size="sm"
            variant="ghost"
          >
            <Trash2 className="mr-1 h-3.5 w-3.5" /> クリア
          </Button>
        </div>
      </div>

      <div className="h-48 w-full overflow-y-auto rounded-lg border border-slate-800/80 bg-slate-950/80 font-mono text-xs">
        <table className="w-full border-collapse text-left">
          <thead className="sticky top-0 border-slate-800 border-b bg-slate-900 text-[11px] text-slate-400">
            <tr>
              <th className="p-2 font-medium">時刻(ms)</th>
              <th className="p-2 font-medium">種別</th>
              <th className="p-2 text-right font-medium">dx</th>
              <th className="p-2 text-right font-medium">dy</th>
              <th className="p-2 text-right font-medium">速度</th>
              <th className="p-2 text-right font-medium">dt</th>
              <th className="p-2 font-medium">押下キー</th>
              <th className="p-2 text-center font-medium">スクロール</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/50 text-slate-300">
            {filteredLogs.length === 0 ? (
              <tr>
                <td
                  className="p-6 text-center font-sans text-slate-500"
                  colSpan={8}
                >
                  イベントログはありません
                </td>
              </tr>
            ) : (
              filteredLogs.map((l) => (
                <tr
                  className={`transition-colors hover:bg-slate-800/40 ${
                    l.isScrollActive ? "bg-pink-950/20" : ""
                  }`}
                  key={l.id}
                >
                  <td className="p-2 text-slate-500">{l.timestamp}</td>
                  <td className="p-2">
                    <span
                      className={`rounded px-1.5 py-0.5 text-[10px] ${
                        l.eventType === "move"
                          ? "border border-cyan-800/50 bg-cyan-950 text-cyan-400"
                          : l.eventType === "wheel"
                            ? "border border-amber-800/50 bg-amber-950 text-amber-400"
                            : "bg-slate-800 text-slate-400"
                      }`}
                    >
                      {l.eventType}
                    </span>
                  </td>
                  <td className="p-2 text-right font-mono">
                    <span
                      className={
                        l.dx > 0
                          ? "text-emerald-400"
                          : l.dx < 0
                            ? "text-rose-400"
                            : "text-slate-500"
                      }
                    >
                      {l.dx > 0 ? `+${l.dx}` : l.dx}
                    </span>
                  </td>
                  <td className="p-2 text-right font-mono">
                    <span
                      className={
                        l.dy > 0
                          ? "text-emerald-400"
                          : l.dy < 0
                            ? "text-rose-400"
                            : "text-slate-500"
                      }
                    >
                      {l.dy > 0 ? `+${l.dy}` : l.dy}
                    </span>
                  </td>
                  <td className="p-2 text-right text-slate-300">
                    {l.speed} px/s
                  </td>
                  <td className="p-2 text-right text-slate-400">{l.dt} ms</td>
                  <td className="p-2">
                    {l.pressedKeys.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {l.pressedKeys.map((vk) => (
                          <span
                            className="rounded bg-slate-800 px-1 py-0.2 text-[10px] text-slate-300"
                            key={vk}
                          >
                            {getVkLabel(vk)}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-slate-600">-</span>
                    )}
                  </td>
                  <td className="p-2 text-center">
                    {l.isScrollActive ? (
                      <span className="font-bold text-[10px] text-pink-400">
                        ON
                      </span>
                    ) : (
                      <span className="text-[10px] text-slate-600">-</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
