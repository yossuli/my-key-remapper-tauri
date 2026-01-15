// 指定キーの長押しでアクションを実行するロジックのフック

import { useCallback, useRef } from "react";

export interface UseKeyHoldActionProps {
  /** 対象キー（例: "Enter", "Space" など） */
  targetKey: number;
  /** 長押し判定時間（ミリ秒） */
  holdMs?: number;
}

interface KeyDownCallbacks {
  /** 対象キーホールド時に呼ばれるコールバック */
  onHold?: () => void;
  /** 対象キー以外の場合に呼ばれるコールバック */
  onOtherKeyDown?: (e: number) => void;
}

interface KeyUpCallbacks {
  /** 単押しの場合に呼ばれるコールバック */
  onTap?: () => void;
  /** 長押しの場合に呼ばれるコールバック */
  onHold?: () => void;
  /** 対象キー以外の場合に呼ばれるコールバック */
  onOtherKeyUp?: (e: number) => void;
}

export interface UseKeyHoldActionReturn {
  /**
   * keydown ハンドラー。
   * @param e - number
   * @param callbacks - コールバックオブジェクト
   */
  handleHoldKeyDown: (e: number, callbacks?: KeyDownCallbacks) => void;
  /**
   * keyup ハンドラー。
   * @param e - number
   * @param callbacks - コールバックオブジェクト
   */
  handleHoldKeyUp: (e: number, callbacks: KeyUpCallbacks) => void;
  clearTimer: () => void;
  isActionReady: () => boolean;
  isKeyActive: () => boolean;
}

/**
 * 指定キーの長押しでアクションを実行するフック
 * addEventListener は呼び出し側で管理する
 */
export function useKeyHoldAction({
  targetKey,
  holdMs = 1000,
}: UseKeyHoldActionProps): UseKeyHoldActionReturn {
  const timerRef = useRef<number | null>(null);
  const keyActiveRef = useRef(false);
  const actionReadyRef = useRef(false);

  const clearTimer = useCallback<UseKeyHoldActionReturn["clearTimer"]>(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    keyActiveRef.current = false;
    actionReadyRef.current = false;
  }, []);

  // アクション準備完了かどうかを確認
  const isActionReady = useCallback<UseKeyHoldActionReturn["isActionReady"]>(
    () => actionReadyRef.current,
    []
  );

  // キー長押し開始を知らせるフラグ
  const isKeyActive = useCallback<UseKeyHoldActionReturn["isKeyActive"]>(
    () => keyActiveRef.current,
    []
  );

  // keydown ハンドラー
  const handleHoldKeyDown = useCallback<
    UseKeyHoldActionReturn["handleHoldKeyDown"]
  >(
    (e, callbacks) => {
      // 対象キー以外ならコールバック呼び出しして終了
      if (e !== targetKey) {
        callbacks?.onOtherKeyDown?.(e);
        return;
      }

      // アクション準備完了状態なら onTargetKey を呼び出し
      if (actionReadyRef.current) {
        callbacks?.onHold?.();
        clearTimer();
        return;
      }

      // タイマー開始
      if (!keyActiveRef.current) {
        keyActiveRef.current = true;
        timerRef.current = window.setTimeout(() => {
          actionReadyRef.current = true;
          keyActiveRef.current = false;
        }, holdMs);
      }
    },
    [clearTimer, holdMs, targetKey]
  );

  // keyup ハンドラー
  const handleHoldKeyUp = useCallback<
    UseKeyHoldActionReturn["handleHoldKeyUp"]
  >(
    (e, callbacks) => {
      if (e !== targetKey) {
        callbacks.onOtherKeyUp?.(e);
        return;
      }

      // アクション準備完了状態なら長押し完了
      if (actionReadyRef.current) {
        clearTimer();
        callbacks.onHold?.();
        return;
      }

      // まだ長押しが完了していない場合は単押し（tap）として処理
      if (keyActiveRef.current) {
        clearTimer();
        callbacks.onTap?.();
      }
    },
    [clearTimer, targetKey]
  );
  return {
    handleHoldKeyDown,
    handleHoldKeyUp,
    clearTimer,
    isActionReady,
    isKeyActive,
  };
}
