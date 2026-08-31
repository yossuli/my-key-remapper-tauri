import { Activity, Clock, Move, Zap } from "lucide-react";
import { Card, CardContent } from "@/components/atoms/Card";
import { CODE_TO_VK } from "@/constants/vk";
import type { TrackpadMetrics } from "@/types/trackpad";

interface TrackpadMetricsCardsProps {
  metrics: TrackpadMetrics;
  triggerVk: number;
}

export function TrackpadMetricsCards({
  metrics,
  triggerVk,
}: TrackpadMetricsCardsProps) {
  // VKコードのラベル取得
  const getVkLabel = (vk: number) => CODE_TO_VK[vk] || `VK_${vk}`;

  const triggerLabel =
    triggerVk === -1
      ? "🌟 常時有効 (キー不要)"
      : triggerVk === 0
      ? "任意のキー (Any Key)"
      : getVkLabel(triggerVk);

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {/* 1. サンプリングレート (Hz) */}
      <Card className="border-slate-800 bg-slate-900/50">
        <CardContent className="flex h-full flex-col justify-between p-4">
          <div className="mb-1 flex items-center justify-between text-slate-400">
            <span className="flex items-center gap-1.5 font-medium text-xs">
              <Activity className="h-3.5 w-3.5 text-cyan-400" />
              サンプリング周波数
            </span>
            <span className="font-mono text-[10px] text-slate-500">
              Max: {metrics.maxHz} Hz
            </span>
          </div>
          <div className="my-1 flex items-baseline gap-1">
            <span className="font-bold font-mono text-2xl text-cyan-400">
              {metrics.currentHz}
            </span>
            <span className="text-slate-400 text-xs">Hz (events/s)</span>
          </div>
          <div className="flex justify-between text-[11px] text-slate-400">
            <span>平均: {metrics.avgHz} Hz</span>
            <span>累計: {metrics.eventCount} evt</span>
          </div>
        </CardContent>
      </Card>

      {/* 2. イベント間隔 (dt / ms) */}
      <Card className="border-slate-800 bg-slate-900/50">
        <CardContent className="flex h-full flex-col justify-between p-4">
          <div className="mb-1 flex items-center justify-between text-slate-400">
            <span className="flex items-center gap-1.5 font-medium text-xs">
              <Clock className="h-3.5 w-3.5 text-emerald-400" />
              イベント間隔 (dt)
            </span>
            <span className="font-mono text-[10px] text-slate-500">
              Jitter: ±{metrics.jitterDt}ms
            </span>
          </div>
          <div className="my-1 flex items-baseline gap-1">
            <span className="font-bold font-mono text-2xl text-emerald-400">
              {metrics.currentDt}
            </span>
            <span className="text-slate-400 text-xs">ms</span>
          </div>
          <div className="flex justify-between text-[11px] text-slate-400">
            <span>Min: {metrics.minDt === 9999 ? 0 : metrics.minDt}ms</span>
            <span>Max: {metrics.maxDt}ms</span>
            <span>Avg: {metrics.avgDt}ms</span>
          </div>
        </CardContent>
      </Card>

      {/* 3. 移動デルタ (dx, dy) & 速度 */}
      <Card className="border-slate-800 bg-slate-900/50">
        <CardContent className="flex h-full flex-col justify-between p-4">
          <div className="mb-1 flex items-center justify-between text-slate-400">
            <span className="flex items-center gap-1.5 font-medium text-xs">
              <Move className="h-3.5 w-3.5 text-amber-400" />
              移動デルタ (dx, dy)
            </span>
            <span className="font-mono text-[10px] text-slate-500">
              Total: {metrics.totalDistance}px
            </span>
          </div>
          <div className="my-1 flex items-baseline gap-2">
            <span className="font-bold font-mono text-2xl text-amber-400">
              {metrics.currentDx >= 0
                ? `+${metrics.currentDx}`
                : metrics.currentDx}
              ,{" "}
              {metrics.currentDy >= 0
                ? `+${metrics.currentDy}`
                : metrics.currentDy}
            </span>
            <span className="text-slate-400 text-xs">px</span>
          </div>
          <div className="flex justify-between text-[11px] text-slate-400">
            <span>速度: {metrics.currentSpeed} px/s</span>
            <span>Max: {metrics.maxSpeed} px/s</span>
          </div>
        </CardContent>
      </Card>

      {/* 4. キー押下・連動ステータス */}
      <Card
        className={`border ${metrics.isKeyActive ? "border-pink-500/50 bg-pink-950/20" : "border-slate-800 bg-slate-900/50"}`}
      >
        <CardContent className="flex h-full flex-col justify-between p-4">
          <div className="mb-1 flex items-center justify-between text-slate-400">
            <span className="flex items-center gap-1.5 font-medium text-xs">
              <Zap
                className={`h-3.5 w-3.5 ${metrics.isKeyActive ? "text-pink-400" : "text-slate-400"}`}
              />
              キー連動状態
            </span>
            <span
              className={`rounded px-1.5 py-0.5 font-semibold text-[10px] ${
                metrics.isKeyActive
                  ? "border border-pink-500/50 bg-pink-500/30 text-pink-300"
                  : "bg-slate-800 text-slate-400"
              }`}
            >
              {metrics.isKeyActive ? "ACTIVE" : "IDLE"}
            </span>
          </div>
          <div className="my-1">
            <div className="text-slate-400 text-xs">トリガー設定:</div>
            <div className="truncate font-semibold text-slate-200 text-sm">
              {triggerLabel}
            </div>
          </div>
          <div className="flex items-center gap-1 overflow-x-auto text-[11px] text-slate-400">
            <span>押下中:</span>
            {metrics.pressedKeys.length === 0 ? (
              <span className="text-slate-600">なし</span>
            ) : (
              metrics.pressedKeys.map((vk) => (
                <span
                  className="rounded bg-slate-800 px-1.5 py-0.5 font-mono text-[10px] text-slate-300"
                  key={vk}
                >
                  {getVkLabel(vk)}
                </span>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
