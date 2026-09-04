import { MousePointer } from "lucide-react";
import { EditorSection } from "@/components/molecules/EditorSection";
import type { ActionSetters } from "@/hooks/ui/useBindingConfig";
import {
  DEFAULT_SCROLL_SENSITIVITY,
  type ScrollModeBindingState,
} from "@/models/bindingStateModel";

interface ScrollActionSettingsProps {
  state: ScrollModeBindingState;
  actionSetters: ActionSetters;
}

export function ScrollActionSettings({
  state,
  actionSetters,
}: ScrollActionSettingsProps) {
  const sensitivity = state.sensitivity ?? DEFAULT_SCROLL_SENSITIVITY;
  const invert = state.invert ?? false;
  const axis = state.axis ?? "both";

  return (
    <EditorSection
      description="このキーを押している間、トラックパッド/マウスの動きをOSスクロールに変換します"
      icon={MousePointer}
      title="トラックパッドスクロール設定"
    >
      <div className="flex flex-col gap-4">
        {/* 1. 感度 (Sensitivity) */}
        <div className="flex flex-col gap-1.5">
          <div className="flex justify-between text-xs">
            <span className="font-medium text-slate-300">
              スクロール感度 (倍率)
            </span>
            <span className="font-mono font-semibold text-pink-400">
              {sensitivity.toFixed(1)}x
            </span>
          </div>
          <input
            className="h-1.5 w-full cursor-pointer rounded-lg bg-slate-800 accent-pink-500"
            max="3.0"
            min="0.2"
            onChange={(e) =>
              actionSetters.setScrollModeAction(
                Number.parseFloat(e.target.value),
                invert,
                axis
              )
            }
            step="0.1"
            type="range"
            value={sensitivity}
          />
        </div>

        {/* 2. 軸 & 方向反転 */}
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1">
            <label
              className="text-slate-400 text-xs"
              htmlFor="scroll-axis-select"
            >
              スクロール軸
            </label>
            <select
              className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-slate-200 text-xs focus:border-pink-500 focus:outline-none"
              id="scroll-axis-select"
              onChange={(e) =>
                actionSetters.setScrollModeAction(
                  sensitivity,
                  invert,
                  e.target.value as "both" | "vertical" | "horizontal"
                )
              }
              value={axis}
            >
              <option value="both">2D (縦+横)</option>
              <option value="vertical">縦スクロールのみ</option>
              <option value="horizontal">横スクロールのみ</option>
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <span className="text-slate-400 text-xs">スクロール方向</span>
            <button
              className={`rounded-lg border px-3 py-1.5 font-medium text-xs transition-colors ${
                invert
                  ? "border-pink-500/50 bg-pink-500/20 text-pink-300"
                  : "border-slate-700 bg-slate-950 text-slate-300 hover:border-slate-600"
              }`}
              onClick={() =>
                actionSetters.setScrollModeAction(sensitivity, !invert, axis)
              }
              type="button"
            >
              {invert ? "反転 (Natural)" : "標準 (Standard)"}
            </button>
          </div>
        </div>

        <p className="text-[11px] text-slate-400 leading-relaxed">
          💡 キー（例: 無変換、Space、Shiftなど）の
          <b>「長押し (hold)」</b>
          に設定すると、キーを押している間だけカーソル移動がブロックされ、トラックパッド操作で画面がスムーズにスクロールします。
        </p>
      </div>
    </EditorSection>
  );
}
