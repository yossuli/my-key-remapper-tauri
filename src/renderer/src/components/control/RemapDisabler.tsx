import { useEffect } from "react";
import { useRemapControl } from "@/hooks/api/useRemapControl";

/**
 * マウント中にリマップを無効化し、アンマウント時に有効化する制御コンポーネント
 * 命令的な Effect を排除し、JSX 内で宣言的に無効化を制御するために使用します
 */
export function RemapDisabler() {
  const { disableRemap, enableRemap } = useRemapControl();

  useEffect(() => {
    disableRemap();
    return () => enableRemap();
  }, [disableRemap, enableRemap]);

  return null;
}
