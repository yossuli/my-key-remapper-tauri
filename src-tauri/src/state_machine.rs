use std::time::Instant;

/// キーの現在の状態
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum KeyState {
    Idle,
    WaitingForHold { pressed_at: Instant },
    HoldActive,
    WaitingForDoubleTap { first_released_at: Instant },
    TapActive,
    DoubleTapActive,
}

/// 状態を遷移させるための入力イベント
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TriggerEvent {
    Pressed,
    Released,
    Timeout,
    OtherKeyPressed,
}

/// 遷移に伴って発火すべきアクション
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ActionCommand {
    None,
    ExecuteTap,       // Tapを押下
    ReleaseTap,       // Tapを離す
    ExecuteTapAtomic, // Tapを押下してすぐ離す（一連の動作）
    ExecuteHold,      // Holdを押下
    ReleaseHold,      // Holdを離す
    ExecuteDoubleTap, // DoubleTapを押下
    ReleaseDoubleTap, // DoubleTapを離す
}

/// ステートマシンの状態遷移関数
/// 純粋関数として実装し、副作用を持たない
pub fn transition(
    state: KeyState,
    event: TriggerEvent,
    has_hold: bool,
    has_double_tap: bool,
) -> (KeyState, ActionCommand) {
    match (state, event) {
        // === IDLE ===
        (KeyState::Idle, TriggerEvent::Pressed) => {
            if has_hold || has_double_tap {
                (
                    KeyState::WaitingForHold {
                        pressed_at: Instant::now(),
                    },
                    ActionCommand::None,
                )
            } else {
                (KeyState::TapActive, ActionCommand::ExecuteTap)
            }
        }

        // === WAITING FOR HOLD ===
        (KeyState::WaitingForHold { .. }, TriggerEvent::Timeout)
        | (KeyState::WaitingForHold { .. }, TriggerEvent::OtherKeyPressed) => {
            if has_hold {
                (KeyState::HoldActive, ActionCommand::ExecuteHold)
            } else {
                (KeyState::TapActive, ActionCommand::ExecuteTap)
            }
        }
        (KeyState::WaitingForHold { .. }, TriggerEvent::Released) => {
            if has_double_tap {
                (
                    KeyState::WaitingForDoubleTap {
                        first_released_at: Instant::now(),
                    },
                    ActionCommand::None,
                )
            } else {
                (KeyState::Idle, ActionCommand::ExecuteTapAtomic)
            }
        }

        // === HOLD ACTIVE ===
        (KeyState::HoldActive, TriggerEvent::Released) => {
            (KeyState::Idle, ActionCommand::ReleaseHold)
        }

        // === WAITING FOR DOUBLE TAP ===
        (KeyState::WaitingForDoubleTap { .. }, TriggerEvent::Timeout)
        | (KeyState::WaitingForDoubleTap { .. }, TriggerEvent::OtherKeyPressed) => {
            (KeyState::Idle, ActionCommand::ExecuteTapAtomic)
        }
        (KeyState::WaitingForDoubleTap { .. }, TriggerEvent::Pressed) => {
            (KeyState::DoubleTapActive, ActionCommand::ExecuteDoubleTap)
        }

        // === TAP ACTIVE ===
        (KeyState::TapActive, TriggerEvent::Released) => (KeyState::Idle, ActionCommand::ReleaseTap),

        // === DOUBLE TAP ACTIVE ===
        (KeyState::DoubleTapActive, TriggerEvent::Released) => {
            (KeyState::Idle, ActionCommand::ReleaseDoubleTap)
        }

        // Ignore redundant or invalid events (e.g. OtherKeyPressed while HoldActive)
        _ => (state, ActionCommand::None),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_simple_tap_only() {
        // HoldもDoubleTapもない場合、即座にTapActiveになる
        let (s1, a1) = transition(KeyState::Idle, TriggerEvent::Pressed, false, false);
        assert_eq!(s1, KeyState::TapActive);
        assert_eq!(a1, ActionCommand::ExecuteTap);

        let (s2, a2) = transition(s1, TriggerEvent::Released, false, false);
        assert_eq!(s2, KeyState::Idle);
        assert_eq!(a2, ActionCommand::ReleaseTap);
    }

    #[test]
    fn test_hold_success() {
        // Holdがある場合、まずは待機
        let (s1, a1) = transition(KeyState::Idle, TriggerEvent::Pressed, true, false);
        assert!(matches!(s1, KeyState::WaitingForHold { .. }));
        assert_eq!(a1, ActionCommand::None);

        // タイムアウトでHold確定
        let (s2, a2) = transition(s1, TriggerEvent::Timeout, true, false);
        assert_eq!(s2, KeyState::HoldActive);
        assert_eq!(a2, ActionCommand::ExecuteHold);

        // 離すとHold解除
        let (s3, a3) = transition(s2, TriggerEvent::Released, true, false);
        assert_eq!(s3, KeyState::Idle);
        assert_eq!(a3, ActionCommand::ReleaseHold);
    }

    #[test]
    fn test_hold_interrupted() {
        // Holdがある場合
        let (s1, _) = transition(KeyState::Idle, TriggerEvent::Pressed, true, false);

        // タイムアウト前に他のキーが押されたら、即座にHold確定 (Pattern A)
        let (s2, a2) = transition(s1, TriggerEvent::OtherKeyPressed, true, false);
        assert_eq!(s2, KeyState::HoldActive);
        assert_eq!(a2, ActionCommand::ExecuteHold);
    }

    #[test]
    fn test_hold_released_early() {
        // Holdのみある場合
        let (s1, _) = transition(KeyState::Idle, TriggerEvent::Pressed, true, false);

        // タイムアウト前に離されたら、Tapアクションを発動してIdleに戻る
        let (s2, a2) = transition(s1, TriggerEvent::Released, true, false);
        assert_eq!(s2, KeyState::Idle);
        assert_eq!(a2, ActionCommand::ExecuteTapAtomic);
    }

    #[test]
    fn test_double_tap_success() {
        // Holdなし、DoubleTapあり
        let (s1, a1) = transition(KeyState::Idle, TriggerEvent::Pressed, false, true);
        assert!(matches!(s1, KeyState::WaitingForHold { .. }));
        assert_eq!(a1, ActionCommand::None);

        // 1回目のリリースでDoubleTap待機
        let (s2, a2) = transition(s1, TriggerEvent::Released, false, true);
        assert!(matches!(s2, KeyState::WaitingForDoubleTap { .. }));
        assert_eq!(a2, ActionCommand::None);

        // 待機中に再度押されたらDoubleTap確定
        let (s3, a3) = transition(s2, TriggerEvent::Pressed, false, true);
        assert_eq!(s3, KeyState::DoubleTapActive);
        assert_eq!(a3, ActionCommand::ExecuteDoubleTap);
    }

    #[test]
    fn test_double_tap_timeout() {
        // 1回目のリリースでDoubleTap待機
        let (s1, _) = transition(KeyState::Idle, TriggerEvent::Pressed, false, true);
        let (s2, _) = transition(s1, TriggerEvent::Released, false, true);

        // 時間切れになったら1回目のTapとして確定
        let (s3, a3) = transition(s2, TriggerEvent::Timeout, false, true);
        assert_eq!(s3, KeyState::Idle);
        assert_eq!(a3, ActionCommand::ExecuteTapAtomic);
    }
}
