import {
  Activity,
  ArrowLeft,
  MousePointer,
  Pause,
  Play,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/atoms/Button";
import { Icon } from "@/components/atoms/Icon";
import { Text } from "@/components/atoms/Text";
import { TrackpadLogTable } from "@/components/organisms/trackpad/TrackpadLogTable";
import { TrackpadMetricsCards } from "@/components/organisms/trackpad/TrackpadMetricsCards";
import { TrackpadScrollSimulator } from "@/components/organisms/trackpad/TrackpadScrollSimulator";
import { TrackpadTraceCanvas } from "@/components/organisms/trackpad/TrackpadTraceCanvas";
import { TrackpadWaveformChart } from "@/components/organisms/trackpad/TrackpadWaveformChart";
import { Box, HStack, VStack } from "@/components/template/Flex";
import { Header, Main, MainLayout } from "@/components/template/MainLayout";
import { useTrackpadTrace } from "@/hooks/ui/useTrackpadTrace";

interface TrackpadTraceTestPageProps {
  onBack: () => void;
}

export function TrackpadTraceTestPage({ onBack }: TrackpadTraceTestPageProps) {
  const {
    captureSource,
    setCaptureSource,
    isCapturing,
    setIsCapturing,
    points,
    logs,
    metrics,
    scrollConfig,
    setScrollConfig,
    simulatedScroll,
    clearTrace,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    handleWheel,
    handleGenericPointerMove,
    handleGenericWheel,
  } = useTrackpadTrace();

  return (
    <MainLayout fullWidth>
      <Header>
        <HStack as="header" className="mb-6 items-center justify-between">
          <HStack gap={3}>
            <Box className="rounded-lg border border-pink-500/20 bg-pink-500/10 p-2">
              <Icon className="text-pink-400" icon={Activity} size="lg" />
            </Box>
            <VStack>
              <HStack className="items-center" gap={2}>
                <Text
                  as="h1"
                  className="font-bold text-slate-100 text-xl tracking-tight"
                >
                  トラックパッド追従性テストパネル
                </Text>
                <span className="rounded-full border border-pink-500/30 bg-pink-500/20 px-2 py-0.5 font-semibold text-[10px] text-pink-300">
                  Experimental Trace Studio
                </span>
              </HStack>
              <Text size="xs" variant="muted">
                サンプリング周波数 (Hz)・移動デルタ (dx,
                dy)・キー連動スクロール検証
              </Text>
            </VStack>
          </HStack>

          {/* ツールバーコントロール */}
          <HStack className="items-center" gap={2}>
            {/* キャプチャソース切替 */}
            <div className="flex items-center rounded-lg border border-slate-800 bg-slate-900 p-0.5 text-xs">
              <button
                className={`rounded-md px-3 py-1.5 font-medium transition-all ${
                  captureSource === "canvas-pointer"
                    ? "border border-primary/40 bg-primary/20 text-primary shadow-sm"
                    : "text-slate-400 hover:text-slate-200"
                }`}
                onClick={() => setCaptureSource("canvas-pointer")}
                type="button"
              >
                Web Pointer モード
              </button>
              <button
                className={`rounded-md px-3 py-1.5 font-medium transition-all ${
                  captureSource === "native-hook"
                    ? "border border-pink-500/40 bg-pink-500/20 text-pink-300 shadow-sm"
                    : "text-slate-400 hover:text-slate-200"
                }`}
                onClick={() => setCaptureSource("native-hook")}
                type="button"
              >
                OS Native Hook モード
              </button>
            </div>

            {/* 一時停止 / 再開 */}
            <Button
              className="h-8 gap-1.5 border-slate-700 text-xs"
              onClick={() => setIsCapturing((prev) => !prev)}
              size="sm"
              variant={isCapturing ? "outline" : "default"}
            >
              <Icon icon={isCapturing ? Pause : Play} size="sm" />
              {isCapturing ? "一時停止" : "再開"}
            </Button>

            {/* リセット */}
            <Button
              className="h-8 gap-1.5 text-slate-400 text-xs hover:text-slate-200"
              onClick={clearTrace}
              size="sm"
              variant="ghost"
            >
              <Icon icon={RotateCcw} size="sm" />
              リセット
            </Button>

            {/* 戻る */}
            <Button
              className="h-8 gap-1.5 border-slate-700 text-xs hover:bg-slate-800"
              onClick={onBack}
              size="sm"
              variant="outline"
            >
              <Icon icon={ArrowLeft} size="sm" />
              キーリマップ画面に戻る
            </Button>
          </HStack>
        </HStack>
      </Header>

      <Main>
        <div className="flex flex-col gap-5 pb-12">
          {/* 1. メトリクスカード群 */}
          <TrackpadMetricsCards
            metrics={metrics}
            triggerVk={scrollConfig.triggerVk}
          />

          {/* 2. トレースキャンバス & リアルタイム波形 */}
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
            {/* 左側: トレースキャンバス (7カラム) */}
            <div className="flex flex-col gap-2 lg:col-span-7">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MousePointer className="h-4 w-4 text-cyan-400" />
                  <span className="font-semibold text-slate-200 text-sm">
                    ポインタ軌跡トレース (リアルタイム描画)
                  </span>
                </div>
                <span className="text-slate-400 text-xs">
                  {captureSource === "canvas-pointer"
                    ? "エリア上で操作して追従性を確認"
                    : "OS全体のマウスフック中"}
                </span>
              </div>
              <TrackpadTraceCanvas
                captureSource={captureSource}
                isKeyActive={metrics.isKeyActive}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onWheel={handleWheel}
                points={points}
              />
            </div>

            {/* 右側: 波形チャート (5カラム) */}
            <div className="flex flex-col gap-2 lg:col-span-5">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-emerald-400" />
                <span className="font-semibold text-slate-200 text-sm">
                  追従性波形ストリーム
                </span>
              </div>
              <TrackpadWaveformChart points={points} />

              {/* ガイダンス情報 */}
              <div className="flex flex-col gap-1.5 rounded-xl border border-slate-800 bg-slate-900/40 p-3 text-slate-400 text-xs">
                <span className="font-semibold text-slate-300">
                  🔍 追従性チェックのポイント:
                </span>
                <ul className="list-disc space-y-1 pl-4 text-[11px] text-slate-400">
                  <li>
                    <b className="text-cyan-300">Hz (サンプリング周波数)</b>:
                    指を動かしたときに十分な頻度（60Hz〜125Hz以上）でイベントが飛んでいるか
                  </li>
                  <li>
                    <b className="text-emerald-300">dt (イベント間隔)</b>:
                    間隔が安定しているか（スパイクや急な欠落がないか）
                  </li>
                  <li>
                    <b className="text-amber-300">dx / dy (移動量)</b>:
                    ゆっくり動かしたときの最小分解能が 1px 〜 数px
                    で取れているか
                  </li>
                </ul>
              </div>
            </div>
          </div>

          {/* 3. キー連動スクロールシミュレーター */}
          <TrackpadScrollSimulator
            config={scrollConfig}
            isKeyActive={metrics.isKeyActive}
            onChangeConfig={setScrollConfig}
            onGenericPointerMove={handleGenericPointerMove}
            onGenericWheel={handleGenericWheel}
            simulatedDelta={simulatedScroll}
          />

          {/* 4. イベント生ログテーブル */}
          <TrackpadLogTable logs={logs} onClear={clearTrace} />
        </div>
      </Main>
    </MainLayout>
  );
}
