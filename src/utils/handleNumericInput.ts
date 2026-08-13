import type { ChangeEvent } from "react";

/**
 * 数値のみを受け付ける入力ハンドラー (カリー化)
 *
 * @param setter 状態セット関数
 * @param options min: 最小値, max: 最大値
 * @returns input の onChange イベントハンドラー
 */
export const handleNumericInput =
  (
    setter: (value: number | undefined) => void,
    options: { min?: number; max?: number } = {}
  ) =>
  (e: ChangeEvent<HTMLInputElement>): void => {
    const value = e.target.value;

    if (value === "") {
      setter(undefined);
      return;
    }

    const num = Number.parseInt(value, 10);
    if (Number.isNaN(num)) {
      return;
    }

    const { min, max } = options;

    if (min !== undefined && num < min) {
      return;
    }
    if (max !== undefined && num > max) {
      return;
    }

    setter(num);
  };
