import { Move } from "lucide-react";
import { useState } from "react";
import { EditorSection } from "@/components/molecules/EditorSection";
import { MousePositionInput } from "@/components/molecules/forms/MousePositionInput";
import type { ActionSetters } from "@/hooks/ui/useBindingConfig";
import { useMousePosition } from "@/hooks/ui/useMousePosition";
import type { MouseMoveBindingState } from "@/models/bindingStateModel";

export const COUNTDOWN_START_VALUE = 3;
export const COUNTDOWN_INTERVAL_MS = 1000;

interface MouseMoveActionSettingsProps {
  state: MouseMoveBindingState;
  actionSetters: ActionSetters;
  setIsInputFocused: (focused: boolean) => void;
}

export function MouseMoveActionSettings({
  state,
  actionSetters,
  setIsInputFocused,
}: MouseMoveActionSettingsProps) {
  const { getCursorPosition } = useMousePosition();
  const [isCapturing, setIsCapturing] = useState(false);
  const [countdown, setCountdown] = useState(0);

  // コンポーネントの状態管理用に現在の座標をローカルでも保持
  const [mouseX, setLocalMouseX] = useState<number | undefined>(state.mouseX);
  const [mouseY, setLocalMouseY] = useState<number | undefined>(state.mouseY);

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
            actionSetters.setMouseMoveAction(pos.x, pos.y);
          });
          return 0;
        }
        return prev - 1;
      });
    }, COUNTDOWN_INTERVAL_MS);
  };

  const updateX = (val: number | undefined) => {
    setLocalMouseX(val);
    actionSetters.setMouseMoveAction(val, mouseY);
  };

  const updateY = (val: number | undefined) => {
    setLocalMouseY(val);
    actionSetters.setMouseMoveAction(mouseX, val);
  };

  return (
    <EditorSection
      description="マウスカーソルを指定座標に移動します"
      icon={Move}
      title="マウス移動"
    >
      <MousePositionInput
        countdown={countdown}
        idPrefix="move"
        isCapturing={isCapturing}
        onGetMousePosition={handleGetMousePosition}
        setIsInputFocused={setIsInputFocused}
        setMouseX={updateX}
        setMouseY={updateY}
        x={mouseX}
        y={mouseY}
      />
    </EditorSection>
  );
}
