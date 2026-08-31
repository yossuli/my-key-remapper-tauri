import { useEffect, useRef } from "react";
import type { CaptureSource, TracePoint } from "@/types/trackpad";

interface TrackpadTraceCanvasProps {
  points: TracePoint[];
  captureSource: CaptureSource;
  isKeyActive: boolean;
  onPointerDown: (e: React.PointerEvent<HTMLCanvasElement>) => void;
  onPointerMove: (e: React.PointerEvent<HTMLCanvasElement>) => void;
  onPointerUp: (e: React.PointerEvent<HTMLCanvasElement>) => void;
  onWheel: (e: React.WheelEvent<HTMLCanvasElement>) => void;
}

export function TrackpadTraceCanvas({
  points,
  captureSource,
  isKeyActive,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onWheel,
}: TrackpadTraceCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Canvas のサイズ調整と描画
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

    // 背景クリア
    ctx.clearRect(0, 0, width, height);

    // グリッド線描画
    ctx.strokeStyle = "rgba(100, 116, 139, 0.15)";
    ctx.lineWidth = 1;
    const gridSize = 40;

    for (let x = 0; x < width; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = 0; y < height; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // 中心線
    ctx.strokeStyle = "rgba(100, 116, 139, 0.3)";
    ctx.beginPath();
    ctx.moveTo(width / 2, 0);
    ctx.lineTo(width / 2, height);
    ctx.moveTo(0, height / 2);
    ctx.lineTo(width, height / 2);
    ctx.stroke();

    if (points.length === 0) {
      // 空表示時のガイダンス
      ctx.fillStyle = "rgba(148, 163, 184, 0.7)";
      ctx.font = "14px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      if (captureSource === "canvas-pointer") {
        ctx.fillText(
          "このエリア上でトラックパッド/マウスを操作してください",
          width / 2,
          height / 2
        );
      } else {
        ctx.fillText(
          "Native Hook モード: OS上でマウス/トラックパッドを動かしてください",
          width / 2,
          height / 2
        );
      }
      ctx.restore();
      return;
    }

    // Native Hook モードの座標変換（相対化または正規化）
    const mappedPoints = points.map((p, index) => {
      if (captureSource === "native-hook") {
        // Native Hook の場合、最新点を中心とする相対座標系で描画
        const latest = points[points.length - 1];
        const cx = width / 2;
        const cy = height / 2;
        const scale = 0.8;
        return {
          ...p,
          renderX: cx + (p.x - latest.x) * scale,
          renderY: cy + (p.y - latest.y) * scale,
        };
      }
      return {
        ...p,
        renderX: p.x,
        renderY: p.y,
      };
    });

    // 軌跡ライン描画 (速度グラデーション)
    for (let i = 1; i < mappedPoints.length; i++) {
      const prev = mappedPoints[i - 1];
      const curr = mappedPoints[i];
      const alpha = Math.max(0.1, i / mappedPoints.length);

      ctx.beginPath();
      ctx.moveTo(prev.renderX, prev.renderY);
      ctx.lineTo(curr.renderX, curr.renderY);

      // 速度に応じた色
      let color = `rgba(6, 182, 212, ${alpha})`; // cyan (< 200)
      if (curr.speed > 2000) {
        color = `rgba(244, 63, 94, ${alpha})`; // rose
      } else if (curr.speed > 800) {
        color = `rgba(245, 158, 11, ${alpha})`; // amber
      } else if (curr.speed > 200) {
        color = `rgba(16, 185, 129, ${alpha})`; // emerald
      }

      ctx.strokeStyle = color;
      ctx.lineWidth = curr.isScrollActive ? 4 : 2;
      if (curr.isScrollActive) {
        ctx.setLineDash([4, 2]); // スクロール発動中は破線ハイライト
      } else {
        ctx.setLineDash([]);
      }
      ctx.stroke();
    }
    ctx.setLineDash([]);

    // サンプル点プロット
    mappedPoints.forEach((p, i) => {
      const alpha = Math.max(0.2, i / mappedPoints.length);
      ctx.beginPath();
      ctx.arc(
        p.renderX,
        p.renderY,
        p.isScrollActive ? 3.5 : 2.5,
        0,
        Math.PI * 2
      );
      ctx.fillStyle = p.isScrollActive
        ? `rgba(236, 72, 153, ${alpha})`
        : `rgba(59, 130, 246, ${alpha})`;
      ctx.fill();
    });

    // 最新位置のハイライト & ベクトル矢印
    const latest = mappedPoints[mappedPoints.length - 1];
    if (latest) {
      // 外側パルス円
      ctx.beginPath();
      ctx.arc(latest.renderX, latest.renderY, 12, 0, Math.PI * 2);
      ctx.strokeStyle = isKeyActive
        ? "rgba(236, 72, 153, 0.8)"
        : "rgba(59, 130, 246, 0.8)";
      ctx.lineWidth = 2;
      ctx.stroke();

      // 内側中心点
      ctx.beginPath();
      ctx.arc(latest.renderX, latest.renderY, 5, 0, Math.PI * 2);
      ctx.fillStyle = isKeyActive ? "#ec4899" : "#3b82f6";
      ctx.fill();

      // 移動ベクトル矢印 (dx, dy)
      if (latest.dx !== 0 || latest.dy !== 0) {
        const vecLen = Math.hypot(latest.dx, latest.dy);
        const arrowScale = Math.min(60, Math.max(15, vecLen * 3));
        const angle = Math.atan2(latest.dy, latest.dx);

        const targetX = latest.renderX + Math.cos(angle) * arrowScale;
        const targetY = latest.renderY + Math.sin(angle) * arrowScale;

        ctx.beginPath();
        ctx.moveTo(latest.renderX, latest.renderY);
        ctx.lineTo(targetX, targetY);
        ctx.strokeStyle = "#f43f5e";
        ctx.lineWidth = 2.5;
        ctx.stroke();

        // 矢印の先端
        const headlen = 8;
        ctx.beginPath();
        ctx.moveTo(targetX, targetY);
        ctx.lineTo(
          targetX - headlen * Math.cos(angle - Math.PI / 6),
          targetY - headlen * Math.sin(angle - Math.PI / 6)
        );
        ctx.lineTo(
          targetX - headlen * Math.cos(angle + Math.PI / 6),
          targetY - headlen * Math.sin(angle + Math.PI / 6)
        );
        ctx.closePath();
        ctx.fillStyle = "#f43f5e";
        ctx.fill();
      }

      // 座標・速度ラベル
      ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
      ctx.font = "11px monospace";
      ctx.textAlign = "left";
      ctx.fillText(
        `dx: ${latest.dx}, dy: ${latest.dy} | ${latest.speed} px/s`,
        latest.renderX + 15,
        latest.renderY - 10
      );
    }

    ctx.restore();
  }, [points, captureSource, isKeyActive]);

  return (
    <div
      className="relative h-[400px] w-full cursor-crosshair touch-none select-none overflow-hidden rounded-xl border border-slate-800 bg-slate-950/80 shadow-inner"
      ref={containerRef}
    >
      <canvas
        className="block h-full w-full"
        onPointerDown={onPointerDown}
        onPointerLeave={onPointerUp}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onWheel={onWheel}
        ref={canvasRef}
      />

      {/* オーバーレイバッジ */}
      <div className="pointer-events-none absolute top-3 left-3 flex items-center gap-2">
        <div
          className={`rounded-full border px-2.5 py-1 font-semibold text-xs backdrop-blur-md ${
            isKeyActive
              ? "animate-pulse border-pink-500/40 bg-pink-500/20 text-pink-300"
              : "border-slate-700/50 bg-slate-900/60 text-slate-300"
          }`}
        >
          {isKeyActive ? "🔥 スクロールモード発動中" : "通常トラッキング"}
        </div>
        <div className="rounded-full border border-slate-700/50 bg-slate-900/60 px-2.5 py-1 font-medium text-slate-400 text-xs backdrop-blur-md">
          {captureSource === "canvas-pointer"
            ? "Web Pointer"
            : "Native Hook (OS)"}
        </div>
      </div>

      {/* カラーレジェンド */}
      <div className="pointer-events-none absolute bottom-3 left-3 flex items-center gap-3 rounded-lg border border-slate-800/80 bg-slate-900/80 px-3 py-1.5 text-[10px] text-slate-400 backdrop-blur-sm">
        <span>速度:</span>
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-cyan-400" /> &lt;200 px/s
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-emerald-400" /> 200~800
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-amber-400" /> 800~2000
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-rose-500" /> &gt;2000
        </span>
      </div>
    </div>
  );
}
