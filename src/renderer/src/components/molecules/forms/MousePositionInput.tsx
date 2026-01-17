import type { ReactNode } from "react";
import { Button } from "@/components/atoms/Button";
import { Center, VStack } from "@/components/template/Flex";
import { useScreenSize } from "@/hooks/ui/useScreenSize";
import { ActionNumericInput } from "./ActionNumericInput";

interface MousePositionInputProps {
  /** 現在のマウス X 座標 */
  x: number | undefined;
  /** 現在のマウス Y 座標 */
  y: number | undefined;
  /** キャプチャ実行中かどうか */
  isCapturing: boolean;
  /** キャプチャまでのカウントダウン秒数 */
  countdown: number;
  /** X座標が変更された時のハンドラ */
  setMouseX: (x: number | undefined) => void;
  /** Y座標が変更された時のハンドラ */
  setMouseY: (y: number | undefined) => void;
  /** 座標取得ボタンがクリックされた時のハンドラ */
  onGetMousePosition: () => void;
  /** フォーカス状態変更ハンドラ */
  setIsInputFocused: (focused: boolean) => void;
  /** ID接頭辞 */
  idPrefix?: string;
  /** 追加の操作UIなど */
  children?: ReactNode;
}

export function MousePositionInput({
  x,
  y,
  isCapturing,
  countdown,
  onGetMousePosition,
  setMouseX,
  setMouseY,
  setIsInputFocused,
  idPrefix = "mouse",
  children,
}: MousePositionInputProps) {
  const screenSize = useScreenSize();

  const PERCENTAGE_MULTIPLIER = 100;
  const DEFAULT_POSITION_PERCENT = 50;

  const relativeX = screenSize
    ? ((x ?? 0) / screenSize.width) * PERCENTAGE_MULTIPLIER
    : DEFAULT_POSITION_PERCENT;
  const relativeY = screenSize
    ? ((y ?? 0) / screenSize.height) * PERCENTAGE_MULTIPLIER
    : DEFAULT_POSITION_PERCENT;

  const screenRatioStyle = screenSize
    ? {
        aspectRatio: `${screenSize.width} / ${screenSize.height}`,
      }
    : { aspectRatio: "16 / 9" };

  return (
    <Center>
      <div className="grid w-fit grid-cols-[auto_160px_auto] items-stretch gap-6">
        <VStack className="justify-center" gap={2}>
          <ActionNumericInput
            id={`${idPrefix}-x`}
            label="X"
            onValueChange={setMouseX}
            setIsInputFocused={setIsInputFocused}
            value={x}
          />
          <ActionNumericInput
            id={`${idPrefix}-y`}
            label="Y"
            onValueChange={setMouseY}
            setIsInputFocused={setIsInputFocused}
            value={y}
          />
        </VStack>

        <div className="flex flex-col items-center justify-center">
          <Button
            className="group relative h-24 w-full overflow-hidden border-none bg-muted/40 p-0 shadow-inner transition-colors hover:bg-muted/50"
            disabled={isCapturing}
            onClick={onGetMousePosition}
            style={screenRatioStyle}
            variant="ghost"
          >
            <div className="absolute inset-[5px]">
              <div
                className="-translate-x-1/2 -translate-y-1/2 absolute z-20 h-2.5 w-2.5 rounded-full border border-white bg-primary shadow-lg ring-2 ring-primary/20 transition-all duration-300"
                style={{
                  left: `${relativeX}%`,
                  top: `${relativeY}%`,
                }}
              />
            </div>

            <span className="relative z-10 rounded bg-background/95 px-3 py-1.5 font-bold text-xs shadow-md ring-1 ring-border/50">
              {isCapturing ? `${countdown}` : "位置を取得"}
            </span>
          </Button>
        </div>

        <div className="flex items-center">{children}</div>
      </div>
    </Center>
  );
}
