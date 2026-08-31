import { useEffect, useRef, useState } from "react";
import type { TracePoint } from "@/types/trackpad";

interface TrackpadWaveformChartProps {
  points: TracePoint[];
}

type WaveformMode = "delta" | "speed" | "dt";

export function TrackpadWaveformChart({ points }: TrackpadWaveformChartProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [mode, setMode] = useState<WaveformMode>("delta");

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!(canvas && container)) {
      return;
    }

    const dpr = window.devicePixelRatio || 1;
    const width = container.clientWidth;
    const height = container.clientHeight;

    if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return;
    }

    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, height);

    // 背景グリッド
    ctx.strokeStyle = "rgba(100, 116, 139, 0.12)";
    ctx.lineWidth = 1;
    for (let y = 20; y < height; y += 30) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // ゼロ基準線（delta の場合）
    const centerY = height / 2;
    if (mode === "delta") {
      ctx.strokeStyle = "rgba(148, 163, 184, 0.25)";
      ctx.beginPath();
      ctx.moveTo(0, centerY);
      ctx.lineTo(width, centerY);
      ctx.stroke();
    }

    if (points.length < 2) {
      ctx.fillStyle = "rgba(148, 163, 184, 0.5)";
      ctx.font = "12px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("リアルタイム波形データ待機中...", width / 2, centerY);
      ctx.restore();
      return;
    }

    const maxSamples = 120;
    const recentPoints = points.slice(-maxSamples);
    const stepX = width / (maxSamples - 1);

    if (mode === "delta") {
      const scale = 2.5; // 1px = 2.5 canvas px

      // dx 線 (Cyan)
      ctx.beginPath();
      recentPoints.forEach((p, i) => {
        const x = width - (recentPoints.length - 1 - i) * stepX;
        const y = centerY - p.dx * scale;
        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      });
      ctx.strokeStyle = "#06b6d4";
      ctx.lineWidth = 2;
      ctx.stroke();

      // dy 線 (Emerald)
      ctx.beginPath();
      recentPoints.forEach((p, i) => {
        const x = width - (recentPoints.length - 1 - i) * stepX;
        const y = centerY - p.dy * scale;
        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      });
      ctx.strokeStyle = "#10b981";
      ctx.lineWidth = 2;
      ctx.stroke();
    } else if (mode === "speed") {
      const maxSpeed = 3000;
      ctx.beginPath();
      recentPoints.forEach((p, i) => {
        const x = width - (recentPoints.length - 1 - i) * stepX;
        const y =
          height - Math.min(height - 10, (p.speed / maxSpeed) * (height - 20));
        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      });
      ctx.strokeStyle = "#f59e0b";
      ctx.lineWidth = 2;
      ctx.stroke();

      // 塗りつぶしグラデーション
      ctx.lineTo(width, height);
      ctx.lineTo(width - (recentPoints.length - 1) * stepX, height);
      ctx.fillStyle = "rgba(245, 158, 11, 0.1)";
      ctx.fill();
    } else if (mode === "dt") {
      const maxDt = 50; // 50ms
      ctx.beginPath();
      recentPoints.forEach((p, i) => {
        const x = width - (recentPoints.length - 1 - i) * stepX;
        const y =
          height - Math.min(height - 10, (p.dt / maxDt) * (height - 20));
        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      });
      ctx.strokeStyle = "#a855f7";
      ctx.lineWidth = 2;
      ctx.stroke();

      // 16.6ms (60Hz) & 8.3ms (120Hz) の目安線
      const y60 = height - (16.6 / maxDt) * (height - 20);
      const y120 = height - (8.3 / maxDt) * (height - 20);

      ctx.strokeStyle = "rgba(255, 255, 255, 0.2)";
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(0, y60);
      ctx.lineTo(width, y60);
      ctx.moveTo(0, y120);
      ctx.lineTo(width, y120);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
      ctx.font = "10px monospace";
      ctx.fillText("60Hz (16.6ms)", 5, y60 - 3);
      ctx.fillText("120Hz (8.3ms)", 5, y120 - 3);
    }

    ctx.restore();
  }, [points, mode]);

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-slate-800 bg-slate-900/50 p-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-slate-300 text-xs">
            リアルタイム波形オシロスコープ
          </span>
          <div className="flex items-center gap-1 rounded-lg bg-slate-800 p-0.5 text-[11px]">
            <button
              className={`rounded px-2 py-0.5 ${
                mode === "delta"
                  ? "bg-slate-700 font-medium text-white shadow"
                  : "text-slate-400 hover:text-slate-200"
              }`}
              onClick={() => setMode("delta")}
              type="button"
            >
              Delta (dx/dy)
            </button>
            <button
              className={`rounded px-2 py-0.5 ${
                mode === "speed"
                  ? "bg-slate-700 font-medium text-white shadow"
                  : "text-slate-400 hover:text-slate-200"
              }`}
              onClick={() => setMode("speed")}
              type="button"
            >
              Speed (px/s)
            </button>
            <button
              className={`rounded px-2 py-0.5 ${
                mode === "dt"
                  ? "bg-slate-700 font-medium text-white shadow"
                  : "text-slate-400 hover:text-slate-200"
              }`}
              onClick={() => setMode("dt")}
              type="button"
            >
              Interval (dt ms)
            </button>
          </div>
        </div>

        {/* 凡例 */}
        <div className="flex items-center gap-3 text-[11px] text-slate-400">
          {mode === "delta" && (
            <>
              <span className="flex items-center gap-1">
                <span className="inline-block h-0.5 w-2.5 bg-cyan-400" /> dx
                (水平)
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block h-0.5 w-2.5 bg-emerald-400" /> dy
                (垂直)
              </span>
            </>
          )}
          {mode === "speed" && (
            <span className="flex items-center gap-1">
              <span className="inline-block h-0.5 w-2.5 bg-amber-400" />{" "}
              瞬時速度 (0〜3000px/s)
            </span>
          )}
          {mode === "dt" && (
            <span className="flex items-center gap-1">
              <span className="inline-block h-0.5 w-2.5 bg-purple-400" />{" "}
              イベント間隔 (0〜50ms)
            </span>
          )}
        </div>
      </div>

      <div
        className="relative h-32 w-full overflow-hidden rounded-lg border border-slate-800/80 bg-slate-950/90"
        ref={containerRef}
      >
        <canvas className="block h-full w-full" ref={canvasRef} />
      </div>
    </div>
  );
}
