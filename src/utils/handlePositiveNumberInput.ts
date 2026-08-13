import type { ChangeEvent } from "react";

/**
 * 正の整数のみを受け付ける入力ハンドラー (カリー化)
 *
 * @param setter 状態セット関数
 * @returns input の onChange イベントハンドラー
 */
export const handlePositiveNumberInput =
  (setter: (value: number | undefined) => void) =>
  (e: ChangeEvent<HTMLInputElement>): void => {
    const value = e.target.value;
    if (value === "") {
      setter(undefined);
    } else {
      const num = Number.parseInt(value, 10);
      if (!Number.isNaN(num) && num > 0) {
        setter(num);
      }
    }
  };
