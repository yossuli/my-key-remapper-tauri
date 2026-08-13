import { MousePointer2 } from "lucide-react";
import { useState } from "react";
import { ToggleButton } from "@/components/atoms/ToggleButton";
import { EditorSection } from "@/components/molecules/EditorSection";
import { MousePositionInput } from "@/components/molecules/forms/MousePositionInput";
import { VStack } from "@/components/template/Flex";
import type { ActionSetters } from "@/hooks/ui/useBindingConfig";
import { useMousePosition } from "@/hooks/ui/useMousePosition";
import type { MouseClickBindingState } from "@/models/bindingStateModel";
import {
  COUNTDOWN_INTERVAL_MS,
  COUNTDOWN_START_VALUE,
} from "./MouseMoveActionSettings";

const MOUSE_BUTTON_OPTIONS = ["left", "middle", "right"] as const;
const MOUSE_BUTTON_LABELS = {
  left: "左",
  middle: "中",
  right: "右",
} as const;

const CLICK_COUNT_OPTIONS = [1, 2] as const;
const CLICK_COUNT_LABELS = {
  1: "1回",
  2: "2回",
} as const;

interface MouseClickActionSettingsProps {
  state: MouseClickBindingState;
  actionSetters: ActionSetters;
  setIsInputFocused: (focused: boolean) => void;
}

export function MouseClickActionSettings({
  state,
  actionSetters,
  setIsInputFocused,
}: MouseClickActionSettingsProps) {
  const { getCursorPosition } = useMousePosition();
  const [isCapturing, setIsCapturing] = useState(false);
  const [countdown, setCountdown] = useState(0);

  // コンポーネントの状態管理用に現在の座標をローカルでも保持
  const [mouseX, setLocalMouseX] = useState<number | undefined>(state.mouseX);
  const [mouseY, setLocalMouseY] = useState<number | undefined>(state.mouseY);
  const [mouseButton, setLocalMouseButton] = useState<
    "left" | "right" | "middle"
  >(state.mouseButton);
  const [clickCount, setLocalClickCount] = useState<number>(state.clickCount);

  const handleGetMousePosition = () => {
    setIsCapturing(true);
    setCountdown(COUNTDOWN_START_VALUE);
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          getCursorPosition().then((pos) => {
            setLocalMouseX(pos.x);
            setLocalMouseY(pos.y);
            setIsCapturing(false);
            actionSetters.setMouseClickAction(
              pos.x,
              pos.y,
              mouseButton,
              clickCount
            );
          });
          return 0;
        }
        return prev - 1;
      });
    }, COUNTDOWN_INTERVAL_MS);
  };

  const updateX = (val: number | undefined) => {
    setLocalMouseX(val);
    actionSetters.setMouseClickAction(val, mouseY, mouseButton, clickCount);
  };

  const updateY = (val: number | undefined) => {
    setLocalMouseY(val);
    actionSetters.setMouseClickAction(mouseX, val, mouseButton, clickCount);
  };

  const updateButton = (btn: "left" | "right" | "middle") => {
    setLocalMouseButton(btn);
    actionSetters.setMouseClickAction(mouseX, mouseY, btn, clickCount);
  };

  const updateClickCount = (count: number) => {
    setLocalClickCount(count);
    actionSetters.setMouseClickAction(mouseX, mouseY, mouseButton, count);
  };

  return (
    <EditorSection
      description="指定座標をクリックします"
      icon={MousePointer2}
      title="マウスクリック"
    >
      <MousePositionInput
        countdown={countdown}
        idPrefix="click"
        isCapturing={isCapturing}
        onGetMousePosition={handleGetMousePosition}
        setIsInputFocused={setIsInputFocused}
        setMouseX={updateX}
        setMouseY={updateY}
        x={mouseX}
        y={mouseY}
      >
        <VStack className="h-full justify-around" gap={2}>
          <ToggleButton
            className="w-24"
            labels={MOUSE_BUTTON_LABELS}
            onChange={updateButton}
            options={MOUSE_BUTTON_OPTIONS}
            value={mouseButton}
          />

          <ToggleButton
            className="w-24"
            labels={CLICK_COUNT_LABELS}
            onChange={updateClickCount}
            options={CLICK_COUNT_OPTIONS}
            value={clickCount}
          />
        </VStack>
      </MousePositionInput>
    </EditorSection>
  );
}
