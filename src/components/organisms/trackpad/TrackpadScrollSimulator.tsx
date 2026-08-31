import { RotateCcw, Sliders, Sparkles } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ScrollSimulationConfig, SmoothingMode } from "@/types/trackpad";

interface TrackpadScrollSimulatorProps {
  config: ScrollSimulationConfig;
  onChangeConfig: (
    updater: (prev: ScrollSimulationConfig) => ScrollSimulationConfig
  ) => void;
  isKeyActive: boolean;
  simulatedDelta: {
    lastDeltaX: number;
    lastDeltaY: number;
    seq?: number;
  };
  onGenericPointerMove?: (
    clientX: number,
    clientY: number,
    movementX: number,
    movementY: number
  ) => void;
  onGenericWheel?: (
    clientX: number,
    clientY: number,
    deltaX: number,
    deltaY: number
  ) => void;
}

const COMMON_KEYS: { label: string; vk: number }[] = [
  { label: "🌟 常時スクロール有効 (キー不要でテスト)", vk: -1 },
  { label: "任意のキー押下中 (Any Key)", vk: 0 },
  { label: "無変換 (VK 29)", vk: 29 },
  { label: "変換 (VK 28)", vk: 28 },
  { label: "Space (VK 32)", vk: 32 },
  { label: "左 Shift (VK 160)", vk: 160 },
  { label: "左 Ctrl (VK 162)", vk: 162 },
  { label: "左 Alt (VK 164)", vk: 164 },
  { label: "F (VK 70)", vk: 70 },
  { label: "D (VK 68)", vk: 68 },
];

export function TrackpadScrollSimulator({
  config,
  onChangeConfig,
  isKeyActive,
  simulatedDelta,
  onGenericPointerMove,
  onGenericWheel,
}: TrackpadScrollSimulatorProps) {
  const scrollPreviewRef = useRef<HTMLDivElement | null>(null);
  const [scrollPos, setScrollPos] = useState<{ top: number; left: number }>({
    top: 0,
    left: 0,
  });
  const isDraggingRef = useRef<boolean>(false);
  const lastPointerPosRef = useRef<{ x: number; y: number } | null>(null);

  // シミュレーションデルタをプレビュー領域の実際のスクロールに即座に反映
  useEffect(() => {
    const el = scrollPreviewRef.current;
    if (!el) {
      return;
    }

    if (isKeyActive && (simulatedDelta.lastDeltaY !== 0 || simulatedDelta.lastDeltaX !== 0)) {
      // scroll-smooth を使わず直接 scrollTop / scrollLeft を更新
      el.scrollTop += simulatedDelta.lastDeltaY;
      el.scrollLeft += simulatedDelta.lastDeltaX;
      setScrollPos({
        top: Math.round(el.scrollTop),
        left: Math.round(el.scrollLeft),
      });
    }
  }, [simulatedDelta, isKeyActive]);

  // プレビュー領域のスクロール位置を監視
  const handleScroll = useCallback(() => {
    const el = scrollPreviewRef.current;
    if (el) {
      setScrollPos({
        top: Math.round(el.scrollTop),
        left: Math.round(el.scrollLeft),
      });
    }
  }, []);

  // プレビュー枠上での直接ドラッグ / ポインタ移動ハンドラ
  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    isDraggingRef.current = true;
    lastPointerPosRef.current = { x: e.clientX, y: e.clientY };
    e.currentTarget.setPointerCapture(e.pointerId);
  }, []);

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      let dx = e.movementX;
      let dy = e.movementY;

      if (lastPointerPosRef.current && (dx === undefined || (dx === 0 && dy === 0))) {
        dx = e.clientX - lastPointerPosRef.current.x;
        dy = e.clientY - lastPointerPosRef.current.y;
      }
      lastPointerPosRef.current = { x: e.clientX, y: e.clientY };

      if (dx !== 0 || dy !== 0) {
        onGenericPointerMove?.(e.clientX, e.clientY, dx, dy);
      }
    },
    [onGenericPointerMove]
  );

  const handlePointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    isDraggingRef.current = false;
    lastPointerPosRef.current = null;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch (_) {}
  }, []);

  // プレビュー枠上での直接ホイールイベント
  const handleWheel = useCallback(
    (e: React.WheelEvent<HTMLDivElement>) => {
      onGenericWheel?.(e.clientX, e.clientY, e.deltaX, e.deltaY);
    },
    [onGenericWheel]
  );

  // 最上部へリセット
  const handleResetScroll = useCallback(() => {
    const el = scrollPreviewRef.current;
    if (el) {
      el.scrollTop = 0;
      el.scrollLeft = 0;
      setScrollPos({ top: 0, left: 0 });
    }
  }, []);

  return (
    <div className="grid grid-cols-1 gap-4 rounded-xl border border-slate-800 bg-slate-900/50 p-4 lg:grid-cols-12">
      {/* パラメータ設定コントロール (Col 5) */}
      <div className="flex flex-col gap-4 lg:col-span-5">
        <div className="flex items-center gap-2 border-slate-800 border-b pb-2">
          <Sliders className="h-4 w-4 text-pink-400" />
          <h3 className="font-semibold text-slate-200 text-sm">
            スクロール変換シミュレーター設定
          </h3>
        </div>

        {/* 1. トリガーキー選択 */}
        <div className="flex flex-col gap-1.5">
          <label className="font-medium text-slate-300 text-xs">
            トリガーキー (押下中にスクロール化)
          </label>
          <select
            className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-200 text-xs focus:border-pink-500 focus:outline-none"
            onChange={(e) =>
              onChangeConfig((prev) => ({
                ...prev,
                triggerVk: Number(e.target.value),
              }))
            }
            value={config.triggerVk}
          >
            {COMMON_KEYS.map((k) => (
              <option key={k.vk} value={k.vk}>
                {k.label}
              </option>
            ))}
          </select>
          <p className="text-[11px] text-slate-400">
            {config.triggerVk === -1
              ? "✅ 常時有効モード: キーを押さずにトラックパッド/マウスを動かすだけでスクロールします。"
              : config.triggerVk === 0
              ? "ℹ️ 任意のキー（Space/無変換など）を押しながら操作してください。"
              : `ℹ️ 指定キー (VK ${config.triggerVk}) を押しながら操作してください。`}
          </p>
        </div>

        {/* 2. 感度 (Sensitivity) */}
        <div className="flex flex-col gap-1">
          <div className="flex justify-between text-xs">
            <span className="font-medium text-slate-300">
              スクロール感度 (倍率)
            </span>
            <span className="font-mono font-semibold text-pink-400">
              {config.sensitivity.toFixed(1)}x
            </span>
          </div>
          <input
            className="h-1.5 w-full cursor-pointer rounded-lg bg-slate-800 accent-pink-500"
            max="3.0"
            min="0.2"
            onChange={(e) =>
              onChangeConfig((prev) => ({
                ...prev,
                sensitivity: Number.parseFloat(e.target.value),
              }))
            }
            step="0.1"
            type="range"
            value={config.sensitivity}
          />
        </div>

        {/* 3. デッドゾーン (Deadzone) */}
        <div className="flex flex-col gap-1">
          <div className="flex justify-between text-xs">
            <span className="font-medium text-slate-300">
              デッドゾーン (微小ブレ除去)
            </span>
            <span className="font-mono font-semibold text-pink-400">
              {config.deadzone} px
            </span>
          </div>
          <input
            className="h-1.5 w-full cursor-pointer rounded-lg bg-slate-800 accent-pink-500"
            max="10"
            min="0"
            onChange={(e) =>
              onChangeConfig((prev) => ({
                ...prev,
                deadzone: Number.parseInt(e.target.value, 10),
              }))
            }
            step="1"
            type="range"
            value={config.deadzone}
          />
        </div>

        {/* 4. スムージング方式 */}
        <div className="flex flex-col gap-1.5">
          <label className="font-medium text-slate-300 text-xs">
            スムージング / 変換方式
          </label>
          <div className="grid grid-cols-3 gap-1.5">
            {[
              { id: "raw", label: "Raw (直接)" },
              { id: "lowpass", label: "EMA平滑化" },
              { id: "accumulated", label: "Step蓄積" },
            ].map((m) => (
              <button
                className={`rounded-lg border px-2 py-1.5 font-medium text-xs transition-colors ${
                  config.smoothingMode === m.id
                    ? "border-pink-500/50 bg-pink-500/20 text-pink-300"
                    : "border-slate-800 bg-slate-950 text-slate-400 hover:border-slate-700"
                }`}
                key={m.id}
                onClick={() =>
                  onChangeConfig((prev) => ({
                    ...prev,
                    smoothingMode: m.id as SmoothingMode,
                  }))
                }
                type="button"
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        {/* 5. 軸 & 方向反転 */}
        <div className="grid grid-cols-2 gap-2">
          <div className="flex flex-col gap-1">
            <label className="text-slate-400 text-xs">スクロール軸</label>
            <select
              className="rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1 text-slate-200 text-xs"
              onChange={(e) =>
                onChangeConfig((prev) => ({
                  ...prev,
                  axis: e.target.value as ScrollSimulationConfig["axis"],
                }))
              }
              value={config.axis}
            >
              <option value="both">2D (縦+横)</option>
              <option value="vertical">縦スクロールのみ</option>
              <option value="horizontal">横スクロールのみ</option>
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-slate-400 text-xs">スクロール方向</label>
            <button
              className={`rounded-lg border px-2 py-1 font-medium text-xs ${
                config.invert
                  ? "border-pink-500/40 bg-pink-500/20 text-pink-300"
                  : "border-slate-800 bg-slate-950 text-slate-400"
              }`}
              onClick={() =>
                onChangeConfig((prev) => ({ ...prev, invert: !prev.invert }))
              }
              type="button"
            >
              {config.invert ? "反転 (Natural)" : "標準 (Standard)"}
            </button>
          </div>
        </div>
      </div>

      {/* スクロール動作プレビュー領域 (Col 7) */}
      <div className="flex flex-col gap-2 lg:col-span-7">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-emerald-400" />
            <h3 className="font-semibold text-slate-200 text-sm">
              スクロール動作テスト・プレビュー
            </h3>
          </div>
          <div className="flex items-center gap-2">
            <button
              className="flex items-center gap-1 rounded-lg border border-slate-800 bg-slate-950 px-2 py-1 text-[11px] text-slate-400 hover:border-slate-700 hover:text-slate-200"
              onClick={handleResetScroll}
              title="最上部へ戻す"
              type="button"
            >
              <RotateCcw className="h-3 w-3" />
              最上部へ
            </button>
            <div
              className={`rounded-full border px-2.5 py-0.5 text-xs transition-all ${
                isKeyActive
                  ? "animate-pulse border-pink-500/50 bg-pink-500/20 font-bold text-pink-300"
                  : "border-slate-700 bg-slate-800 font-medium text-slate-400"
              }`}
            >
              {isKeyActive ? "⚡ スクロール受付中" : "キー待機中"}
            </div>
          </div>
        </div>

        {/* 仮想スクロールボックス (※ scroll-smooth を除去してダイレクトスクロールを保証) */}
        <div
          className={`relative h-[280px] w-full cursor-crosshair select-none overflow-auto rounded-xl border bg-slate-950 p-4 transition-colors ${
            isKeyActive
              ? "border-pink-500/70 shadow-[0_0_15px_rgba(236,72,153,0.15)]"
              : "border-slate-800"
          }`}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onScroll={handleScroll}
          onWheel={handleWheel}
          ref={scrollPreviewRef}
        >
          <div className="flex w-[750px] flex-col gap-2.5 font-mono text-slate-400 text-xs">
            <div className="sticky top-0 z-10 rounded-lg border border-pink-500/40 bg-slate-900/95 p-3 text-slate-300 shadow-md backdrop-blur-sm">
              <div className="flex items-center justify-between">
                <p className="font-semibold text-pink-400 text-xs">
                  【スクロールテスト用エリア】
                </p>
                <div className="font-mono text-[11px] text-slate-400">
                  Top: <span className="font-bold text-pink-300">{scrollPos.top}px</span> | Left:{" "}
                  <span className="font-bold text-cyan-300">{scrollPos.left}px</span>
                </div>
              </div>
              <p className="mt-1 font-sans text-[11px] text-slate-300 leading-relaxed">
                👆 このエリア内（または上の黒いキャンバス／OS全体）でトラックパッドを動かしてください。
                {config.triggerVk === -1
                  ? "「常時有効」のため、キーを押さなくても指を動かすだけでスクロールします。"
                  : "設定したキーを押しながら指を動かすとスクロールします。"}
              </p>
            </div>

            {Array.from({ length: 40 }).map((_, i) => (
              <div
                className="flex items-center justify-between rounded-lg border border-slate-800/60 bg-slate-900/40 p-2.5 transition-colors hover:bg-slate-800/60"
                key={i}
              >
                <span className="w-10 font-bold text-slate-500">#{i + 1}</span>
                <span className="font-sans text-slate-300 text-xs">
                  トラックパッド追従性検証テスト項目 - Row item #{i + 1}
                </span>
                <span className="rounded border border-emerald-800/40 bg-emerald-950/40 px-2 py-0.5 font-sans text-[10px] text-emerald-400/90">
                  Scroll Target #{i + 1}
                </span>
              </div>
            ))}
          </div>
        </div>
        <div className="flex items-center justify-between text-[11px] text-slate-500">
          <p>
            💡 指の微小な動きで滑らかにスクロールするか、遅延やカクつきがないかテストできます。
          </p>
          <span className="font-mono text-slate-400">
            Last dX: {simulatedDelta.lastDeltaX} | dY: {simulatedDelta.lastDeltaY}
          </span>
        </div>
      </div>
    </div>
  );
}
