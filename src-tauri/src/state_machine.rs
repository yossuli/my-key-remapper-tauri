use std::time::Instant;

/// キーの現在の状態
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum KeyState {
    Idle,
    WaitingForHold { pressed_at: Instant },
    HoldActive { activated_at: Instant, last_repeated_at: Instant },
    WaitingForDoubleTap { first_released_at: Instant },
    TapActive { activated_at: Instant, last_repeated_at: Instant },
    DoubleTapActive { activated_at: Instant, last_repeated_at: Instant },
}

/// 状態を遷移させるための入力イベント
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TriggerEvent {
    Pressed,
    Released,
    Timeout,
    OtherKeyPressed,
    CustomRepeat,
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
    ExecuteHoldRepeat, // Holdを押下し続ける（リピート）
    ExecuteDoubleTap, // DoubleTapを押下
    ReleaseDoubleTap, // DoubleTapを離す
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum InterruptBehavior {
    ForceTap,
    Ignore,
}

/// ステートマシンの状態遷移関数
/// 純粋関数として実装し、副作用を持たない
pub fn transition(
    state: KeyState,
    event: TriggerEvent,
    has_hold: bool,
    has_double_tap: bool,
    interrupt_behavior: InterruptBehavior,
    now: Instant,
) -> (KeyState, ActionCommand) {
    match (state, event) {
        // === IDLE ===
        (KeyState::Idle, TriggerEvent::Pressed) => {
            if has_hold || has_double_tap {
                (
                    KeyState::WaitingForHold {
                        pressed_at: now,
                    },
                    ActionCommand::None,
                )
            } else {
                (KeyState::TapActive { activated_at: now, last_repeated_at: now }, ActionCommand::ExecuteTap)
            }
        }

        // === WAITING FOR HOLD ===
        (KeyState::WaitingForHold { .. }, TriggerEvent::Timeout) => {
            if has_hold {
                (KeyState::HoldActive { activated_at: now, last_repeated_at: now }, ActionCommand::ExecuteHold)
            } else {
                (KeyState::TapActive { activated_at: now, last_repeated_at: now }, ActionCommand::ExecuteTap)
            }
        }
        (KeyState::WaitingForHold { .. }, TriggerEvent::OtherKeyPressed) => {
            match interrupt_behavior {
                InterruptBehavior::ForceTap => (KeyState::TapActive { activated_at: now, last_repeated_at: now }, ActionCommand::ExecuteTap),
                InterruptBehavior::Ignore => (state, ActionCommand::None),
            }
        }
        (KeyState::WaitingForHold { .. }, TriggerEvent::Released) => {
            if has_double_tap {
                (
                    KeyState::WaitingForDoubleTap {
                        first_released_at: now,
                    },
                    ActionCommand::None,
                )
            } else {
                (KeyState::Idle, ActionCommand::ExecuteTapAtomic)
            }
        }

        // === HOLD ACTIVE ===
        (KeyState::HoldActive { .. }, TriggerEvent::Released) => {
            (KeyState::Idle, ActionCommand::ReleaseHold)
        }
        (KeyState::HoldActive { activated_at, .. }, TriggerEvent::Pressed) => {
            // OSのキーリピートによる再押下イベントをスルーせず、再度ダウンを送信してリピートを発生させる
            (KeyState::HoldActive { activated_at, last_repeated_at: now }, ActionCommand::ExecuteHoldRepeat)
        }
        (KeyState::HoldActive { activated_at, .. }, TriggerEvent::CustomRepeat) => {
            (KeyState::HoldActive { activated_at, last_repeated_at: now }, ActionCommand::ExecuteHoldRepeat)
        }

        // === WAITING FOR DOUBLE TAP ===
        (KeyState::WaitingForDoubleTap { .. }, TriggerEvent::Timeout)
        | (KeyState::WaitingForDoubleTap { .. }, TriggerEvent::OtherKeyPressed) => {
            (KeyState::Idle, ActionCommand::ExecuteTapAtomic)
        }
        (KeyState::WaitingForDoubleTap { .. }, TriggerEvent::Pressed) => {
            let now = now;
            (KeyState::DoubleTapActive { activated_at: now, last_repeated_at: now }, ActionCommand::ExecuteDoubleTap)
        }

        // === TAP ACTIVE ===
        (KeyState::TapActive { .. }, TriggerEvent::Released) => (KeyState::Idle, ActionCommand::ReleaseTap),
        (KeyState::TapActive { activated_at, .. }, TriggerEvent::Pressed) => (KeyState::TapActive { activated_at, last_repeated_at: now }, ActionCommand::ExecuteTap),
        (KeyState::TapActive { activated_at, .. }, TriggerEvent::CustomRepeat) => (KeyState::TapActive { activated_at, last_repeated_at: now }, ActionCommand::ExecuteTap),

        // === DOUBLE TAP ACTIVE ===
        (KeyState::DoubleTapActive { .. }, TriggerEvent::Released) => {
            (KeyState::Idle, ActionCommand::ReleaseDoubleTap)
        }
        (KeyState::DoubleTapActive { activated_at, .. }, TriggerEvent::Pressed) => {
            (KeyState::DoubleTapActive { activated_at, last_repeated_at: now }, ActionCommand::ExecuteDoubleTap)
        }
        (KeyState::DoubleTapActive { activated_at, .. }, TriggerEvent::CustomRepeat) => {
            (KeyState::DoubleTapActive { activated_at, last_repeated_at: now }, ActionCommand::ExecuteDoubleTap)
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
        let (s1, a1) = transition(KeyState::Idle, TriggerEvent::Pressed, false, false, InterruptBehavior::ForceTap, Instant::now());
        assert!(matches!(s1, KeyState::TapActive { .. }));
        assert_eq!(a1, ActionCommand::ExecuteTap);

        let (s2, a2) = transition(s1, TriggerEvent::Released, false, false, InterruptBehavior::ForceTap, Instant::now());
        assert_eq!(s2, KeyState::Idle);
        assert_eq!(a2, ActionCommand::ReleaseTap);
    }

    #[test]
    fn test_hold_success() {
        let (s1, a1) = transition(KeyState::Idle, TriggerEvent::Pressed, true, false, InterruptBehavior::ForceTap, Instant::now());
        assert!(matches!(s1, KeyState::WaitingForHold { .. }));
        assert_eq!(a1, ActionCommand::None);

        let (s2, a2) = transition(s1, TriggerEvent::Timeout, true, false, InterruptBehavior::ForceTap, Instant::now());
        assert!(matches!(s2, KeyState::HoldActive { .. }));
        assert_eq!(a2, ActionCommand::ExecuteHold);

        let (s3, a3) = transition(s2, TriggerEvent::Released, true, false, InterruptBehavior::ForceTap, Instant::now());
        assert_eq!(s3, KeyState::Idle);
        assert_eq!(a3, ActionCommand::ReleaseHold);
    }

    #[test]
    fn test_hold_interrupted_force_tap() {
        let (s1, _) = transition(KeyState::Idle, TriggerEvent::Pressed, true, false, InterruptBehavior::ForceTap, Instant::now());
        let (s2, a2) = transition(s1, TriggerEvent::OtherKeyPressed, true, false, InterruptBehavior::ForceTap, Instant::now());
        assert!(matches!(s2, KeyState::TapActive { .. }));
        assert_eq!(a2, ActionCommand::ExecuteTap);
    }

    #[test]
    fn test_hold_interrupted_ignore() {
        let (s1, _) = transition(KeyState::Idle, TriggerEvent::Pressed, true, false, InterruptBehavior::Ignore, Instant::now());
        let (s2, a2) = transition(s1, TriggerEvent::OtherKeyPressed, true, false, InterruptBehavior::Ignore, Instant::now());
        assert!(matches!(s2, KeyState::WaitingForHold { .. }));
        assert_eq!(a2, ActionCommand::None);
    }

    #[test]
    fn test_hold_released_early() {
        let (s1, a1) = transition(KeyState::Idle, TriggerEvent::Pressed, true, false, InterruptBehavior::ForceTap, Instant::now());
        assert!(matches!(s1, KeyState::WaitingForHold { .. }));
        assert_eq!(a1, ActionCommand::None);

        let (s2, a2) = transition(s1, TriggerEvent::Released, true, false, InterruptBehavior::ForceTap, Instant::now());
        assert_eq!(s2, KeyState::Idle);
        assert_eq!(a2, ActionCommand::ExecuteTapAtomic);
    }

    #[test]
    fn test_double_tap_success() {
        let (s1, _) = transition(KeyState::Idle, TriggerEvent::Pressed, false, true, InterruptBehavior::ForceTap, Instant::now());
        let (s2, _) = transition(s1, TriggerEvent::Released, false, true, InterruptBehavior::ForceTap, Instant::now());
        assert!(matches!(s2, KeyState::WaitingForDoubleTap { .. }));

        let (s3, a3) = transition(s2, TriggerEvent::Pressed, false, true, InterruptBehavior::ForceTap, Instant::now());
        assert!(matches!(s3, KeyState::DoubleTapActive { .. }));
        assert_eq!(a3, ActionCommand::ExecuteDoubleTap);

        let (s4, a4) = transition(s3, TriggerEvent::Released, false, true, InterruptBehavior::ForceTap, Instant::now());
        assert_eq!(s4, KeyState::Idle);
        assert_eq!(a4, ActionCommand::ReleaseDoubleTap);
    }

    #[test]
    fn test_double_tap_timeout() {
        let (s1, _) = transition(KeyState::Idle, TriggerEvent::Pressed, false, true, InterruptBehavior::ForceTap, Instant::now());
        let (s2, _) = transition(s1, TriggerEvent::Released, false, true, InterruptBehavior::ForceTap, Instant::now());
        
        let (s3, a3) = transition(s2, TriggerEvent::Timeout, false, true, InterruptBehavior::ForceTap, Instant::now());
        assert_eq!(s3, KeyState::Idle);
        assert_eq!(a3, ActionCommand::ExecuteTapAtomic);
    }
}
