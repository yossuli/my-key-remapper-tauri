use std::time::Instant;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum KeyState {
    Idle,
    WaitingForHold { pressed_at: Instant },
    HoldActive { activated_at: Instant, last_repeated_at: Instant },
    PassthroughHoldActive { activated_at: Instant, last_repeated_at: Instant },
    WaitingForDoubleTap { first_released_at: Instant },
    TapActive { activated_at: Instant, last_repeated_at: Instant },
    DoubleTapActive { activated_at: Instant, last_repeated_at: Instant },
}

impl KeyState {
    pub fn is_passthrough(&self) -> bool {
        matches!(self, KeyState::PassthroughHoldActive { .. })
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum KeyCapability {
    TapOnly,
    HoldOnly { is_passthrough: bool },
    DoubleTapOnly,
    TapAndHold,
    TapAndDoubleTap,
    HoldAndDoubleTap { is_passthrough: bool },
    Full,
}

impl KeyCapability {
    pub fn has_hold(&self) -> bool {
        matches!(
            self,
            KeyCapability::HoldOnly { .. }
                | KeyCapability::TapAndHold
                | KeyCapability::HoldAndDoubleTap { .. }
                | KeyCapability::Full
        )
    }

    pub fn has_double_tap(&self) -> bool {
        matches!(
            self,
            KeyCapability::DoubleTapOnly
                | KeyCapability::TapAndDoubleTap
                | KeyCapability::HoldAndDoubleTap { .. }
                | KeyCapability::Full
        )
    }

    pub fn is_passthrough(&self) -> bool {
        match self {
            KeyCapability::HoldOnly { is_passthrough } => *is_passthrough,
            KeyCapability::HoldAndDoubleTap { is_passthrough } => *is_passthrough,
            _ => false,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TriggerEvent {
    Pressed,
    Released,
    Timeout,
    OtherKeyPressed,
    CustomRepeat,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ActionCommand {
    None,
    ExecuteTap,
    ReleaseTap,
    ExecuteTapAtomic,
    ExecuteHold,
    ExecutePassthroughHoldDelayed,
    ReleaseHold,
    ExecuteHoldRepeat,
    ExecuteDoubleTap,
    ReleaseDoubleTap,
}

pub use crate::model::InterruptBehavior;

pub fn transition(
    state: KeyState,
    event: TriggerEvent,
    capability: KeyCapability,
    interrupt_behavior: InterruptBehavior,
    now: Instant,
) -> (KeyState, ActionCommand) {
    match (state, event) {
        (KeyState::Idle, TriggerEvent::Pressed) => {
            match capability {
                KeyCapability::HoldOnly { is_passthrough: true } => {
                    (
                        KeyState::PassthroughHoldActive {
                            activated_at: now,
                            last_repeated_at: now,
                        },
                        ActionCommand::ExecuteHold,
                    )
                }
                KeyCapability::TapOnly => {
                    (
                        KeyState::TapActive {
                            activated_at: now,
                            last_repeated_at: now,
                        },
                        ActionCommand::ExecuteTap,
                    )
                }
                _ => {
                    (
                        KeyState::WaitingForHold {
                            pressed_at: now,
                        },
                        ActionCommand::None,
                    )
                }
            }
        }

        (KeyState::WaitingForHold { .. }, TriggerEvent::Timeout) => {
            match capability {
                KeyCapability::HoldOnly { is_passthrough: true }
                | KeyCapability::HoldAndDoubleTap { is_passthrough: true } => (
                    KeyState::PassthroughHoldActive {
                        activated_at: now,
                        last_repeated_at: now,
                    },
                    ActionCommand::ExecutePassthroughHoldDelayed,
                ),
                KeyCapability::HoldOnly { is_passthrough: false }
                | KeyCapability::HoldAndDoubleTap { is_passthrough: false }
                | KeyCapability::TapAndHold
                | KeyCapability::Full => (
                    KeyState::HoldActive {
                        activated_at: now,
                        last_repeated_at: now,
                    },
                    ActionCommand::ExecuteHold,
                ),
                KeyCapability::TapOnly
                | KeyCapability::TapAndDoubleTap
                | KeyCapability::DoubleTapOnly => (
                    KeyState::TapActive {
                        activated_at: now,
                        last_repeated_at: now,
                    },
                    ActionCommand::ExecuteTap,
                ),
            }
        }
        (KeyState::WaitingForHold { .. }, TriggerEvent::OtherKeyPressed) => {
            match (interrupt_behavior, capability) {
                (InterruptBehavior::ForceTap, _) => (
                    KeyState::TapActive {
                        activated_at: now,
                        last_repeated_at: now,
                    },
                    ActionCommand::ExecuteTap,
                ),
                (
                    InterruptBehavior::ForceHold,
                    KeyCapability::HoldOnly { is_passthrough: true }
                    | KeyCapability::HoldAndDoubleTap { is_passthrough: true },
                ) => (
                    KeyState::PassthroughHoldActive {
                        activated_at: now,
                        last_repeated_at: now,
                    },
                    ActionCommand::ExecutePassthroughHoldDelayed,
                ),
                (InterruptBehavior::ForceHold, _) => (
                    KeyState::HoldActive {
                        activated_at: now,
                        last_repeated_at: now,
                    },
                    ActionCommand::ExecuteHold,
                ),
                (InterruptBehavior::Ignore, _) => (state, ActionCommand::None),
            }
        }
        (KeyState::WaitingForHold { .. }, TriggerEvent::Released) => {
            match capability {
                KeyCapability::Full
                | KeyCapability::TapAndDoubleTap
                | KeyCapability::HoldAndDoubleTap { .. }
                | KeyCapability::DoubleTapOnly => (
                    KeyState::WaitingForDoubleTap {
                        first_released_at: now,
                    },
                    ActionCommand::None,
                ),
                KeyCapability::TapOnly
                | KeyCapability::TapAndHold
                | KeyCapability::HoldOnly { .. } => {
                    (KeyState::Idle, ActionCommand::ExecuteTapAtomic)
                }
            }
        }

        (KeyState::HoldActive { .. }, TriggerEvent::Released) => {
            (KeyState::Idle, ActionCommand::ReleaseHold)
        }
        (KeyState::HoldActive { activated_at, .. }, TriggerEvent::Pressed) => {
            (KeyState::HoldActive { activated_at, last_repeated_at: now }, ActionCommand::ExecuteHoldRepeat)
        }
        (KeyState::HoldActive { activated_at, .. }, TriggerEvent::CustomRepeat) => {
            (KeyState::HoldActive { activated_at, last_repeated_at: now }, ActionCommand::ExecuteHoldRepeat)
        }

        (KeyState::PassthroughHoldActive { .. }, TriggerEvent::Released) => {
            (KeyState::Idle, ActionCommand::ReleaseHold)
        }
        (KeyState::PassthroughHoldActive { activated_at, .. }, TriggerEvent::Pressed) => {
            (
                KeyState::PassthroughHoldActive { activated_at, last_repeated_at: now },
                ActionCommand::ExecuteHoldRepeat,
            )
        }
        (KeyState::PassthroughHoldActive { activated_at, .. }, TriggerEvent::CustomRepeat) => {
            (
                KeyState::PassthroughHoldActive { activated_at, last_repeated_at: now },
                ActionCommand::ExecuteHoldRepeat,
            )
        }

        (KeyState::WaitingForDoubleTap { .. }, TriggerEvent::Timeout)
        | (KeyState::WaitingForDoubleTap { .. }, TriggerEvent::OtherKeyPressed) => {
            (KeyState::Idle, ActionCommand::ExecuteTapAtomic)
        }
        (KeyState::WaitingForDoubleTap { .. }, TriggerEvent::Pressed) => {
            (KeyState::DoubleTapActive { activated_at: now, last_repeated_at: now }, ActionCommand::ExecuteDoubleTap)
        }

        (KeyState::TapActive { .. }, TriggerEvent::Released) => (KeyState::Idle, ActionCommand::ReleaseTap),
        (KeyState::TapActive { activated_at, .. }, TriggerEvent::Pressed) => (KeyState::TapActive { activated_at, last_repeated_at: now }, ActionCommand::ExecuteTap),
        (KeyState::TapActive { activated_at, .. }, TriggerEvent::CustomRepeat) => (KeyState::TapActive { activated_at, last_repeated_at: now }, ActionCommand::ExecuteTap),

        (KeyState::DoubleTapActive { .. }, TriggerEvent::Released) => {
            (KeyState::Idle, ActionCommand::ReleaseDoubleTap)
        }
        (KeyState::DoubleTapActive { activated_at, .. }, TriggerEvent::Pressed) => {
            (KeyState::DoubleTapActive { activated_at, last_repeated_at: now }, ActionCommand::ExecuteDoubleTap)
        }
        (KeyState::DoubleTapActive { activated_at, .. }, TriggerEvent::CustomRepeat) => {
            (KeyState::DoubleTapActive { activated_at, last_repeated_at: now }, ActionCommand::ExecuteDoubleTap)
        }

        _ => (state, ActionCommand::None),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_simple_tap_only() {
        let (s1, a1) = transition(KeyState::Idle, TriggerEvent::Pressed, KeyCapability::TapOnly, InterruptBehavior::ForceTap, Instant::now());
        assert!(matches!(s1, KeyState::TapActive { .. }));
        assert_eq!(a1, ActionCommand::ExecuteTap);

        let (s2, a2) = transition(s1, TriggerEvent::Released, KeyCapability::TapOnly, InterruptBehavior::ForceTap, Instant::now());
        assert_eq!(s2, KeyState::Idle);
        assert_eq!(a2, ActionCommand::ReleaseTap);
    }

    #[test]
    fn test_hold_success() {
        let cap = KeyCapability::TapAndHold;
        let (s1, a1) = transition(KeyState::Idle, TriggerEvent::Pressed, cap, InterruptBehavior::ForceTap, Instant::now());
        assert!(matches!(s1, KeyState::WaitingForHold { .. }));
        assert_eq!(a1, ActionCommand::None);

        let (s2, a2) = transition(s1, TriggerEvent::Timeout, cap, InterruptBehavior::ForceTap, Instant::now());
        assert!(matches!(s2, KeyState::HoldActive { .. }));
        assert_eq!(a2, ActionCommand::ExecuteHold);

        let (s3, a3) = transition(s2, TriggerEvent::Released, cap, InterruptBehavior::ForceTap, Instant::now());
        assert_eq!(s3, KeyState::Idle);
        assert_eq!(a3, ActionCommand::ReleaseHold);
    }

    #[test]
    fn test_non_passthrough_hold_only_waits_and_taps_atomic() {
        let cap = KeyCapability::HoldOnly { is_passthrough: false };
        let (s1, a1) = transition(KeyState::Idle, TriggerEvent::Pressed, cap, InterruptBehavior::ForceTap, Instant::now());
        assert!(matches!(s1, KeyState::WaitingForHold { .. }));
        assert_eq!(a1, ActionCommand::None);

        let (s2, a2) = transition(s1, TriggerEvent::Released, cap, InterruptBehavior::ForceTap, Instant::now());
        assert_eq!(s2, KeyState::Idle);
        assert_eq!(a2, ActionCommand::ExecuteTapAtomic);

        let (s3, _) = transition(KeyState::Idle, TriggerEvent::Pressed, cap, InterruptBehavior::ForceTap, Instant::now());
        let (s4, a4) = transition(s3, TriggerEvent::Timeout, cap, InterruptBehavior::ForceTap, Instant::now());
        assert!(matches!(s4, KeyState::HoldActive { .. }));
        assert_eq!(a4, ActionCommand::ExecuteHold);
    }

    #[test]
    fn test_passthrough_momentary_zero_latency_immediate() {
        let cap = KeyCapability::HoldOnly { is_passthrough: true };
        let (s1, a1) = transition(KeyState::Idle, TriggerEvent::Pressed, cap, InterruptBehavior::ForceTap, Instant::now());
        assert!(matches!(s1, KeyState::PassthroughHoldActive { .. }));
        assert!(s1.is_passthrough());
        assert_eq!(a1, ActionCommand::ExecuteHold);

        let (s2, a2) = transition(s1, TriggerEvent::Released, cap, InterruptBehavior::ForceTap, Instant::now());
        assert_eq!(s2, KeyState::Idle);
        assert_eq!(a2, ActionCommand::ReleaseHold);
    }

    #[test]
    fn test_hold_interrupted_force_tap() {
        let cap = KeyCapability::TapAndHold;
        let (s1, _) = transition(KeyState::Idle, TriggerEvent::Pressed, cap, InterruptBehavior::ForceTap, Instant::now());
        let (s2, a2) = transition(s1, TriggerEvent::OtherKeyPressed, cap, InterruptBehavior::ForceTap, Instant::now());
        assert!(matches!(s2, KeyState::TapActive { .. }));
        assert_eq!(a2, ActionCommand::ExecuteTap);
    }

    #[test]
    fn test_hold_interrupted_ignore() {
        let cap = KeyCapability::TapAndHold;
        let (s1, _) = transition(KeyState::Idle, TriggerEvent::Pressed, cap, InterruptBehavior::Ignore, Instant::now());
        let (s2, a2) = transition(s1, TriggerEvent::OtherKeyPressed, cap, InterruptBehavior::Ignore, Instant::now());
        assert!(matches!(s2, KeyState::WaitingForHold { .. }));
        assert_eq!(a2, ActionCommand::None);
    }

    #[test]
    fn test_hold_interrupted_force_hold() {
        let cap = KeyCapability::TapAndHold;
        let (s1, _) = transition(KeyState::Idle, TriggerEvent::Pressed, cap, InterruptBehavior::ForceHold, Instant::now());
        let (s2, a2) = transition(s1, TriggerEvent::OtherKeyPressed, cap, InterruptBehavior::ForceHold, Instant::now());
        assert!(matches!(s2, KeyState::HoldActive { .. }));
        assert_eq!(a2, ActionCommand::ExecuteHold);
    }

    #[test]
    fn test_hold_interrupted_force_hold_passthrough() {
        let cap = KeyCapability::HoldAndDoubleTap { is_passthrough: true };
        let (s1, _) = transition(KeyState::Idle, TriggerEvent::Pressed, cap, InterruptBehavior::ForceHold, Instant::now());
        let (s2, a2) = transition(s1, TriggerEvent::OtherKeyPressed, cap, InterruptBehavior::ForceHold, Instant::now());
        assert!(matches!(s2, KeyState::PassthroughHoldActive { .. }));
        assert_eq!(a2, ActionCommand::ExecutePassthroughHoldDelayed);
    }

    #[test]
    fn test_hold_released_early() {
        let cap = KeyCapability::TapAndHold;
        let (s1, a1) = transition(KeyState::Idle, TriggerEvent::Pressed, cap, InterruptBehavior::ForceTap, Instant::now());
        assert!(matches!(s1, KeyState::WaitingForHold { .. }));
        assert_eq!(a1, ActionCommand::None);

        let (s2, a2) = transition(s1, TriggerEvent::Released, cap, InterruptBehavior::ForceTap, Instant::now());
        assert_eq!(s2, KeyState::Idle);
        assert_eq!(a2, ActionCommand::ExecuteTapAtomic);
    }

    #[test]
    fn test_double_tap_success() {
        let cap = KeyCapability::TapAndDoubleTap;
        let (s1, _) = transition(KeyState::Idle, TriggerEvent::Pressed, cap, InterruptBehavior::ForceTap, Instant::now());
        let (s2, _) = transition(s1, TriggerEvent::Released, cap, InterruptBehavior::ForceTap, Instant::now());
        assert!(matches!(s2, KeyState::WaitingForDoubleTap { .. }));

        let (s3, a3) = transition(s2, TriggerEvent::Pressed, cap, InterruptBehavior::ForceTap, Instant::now());
        assert!(matches!(s3, KeyState::DoubleTapActive { .. }));
        assert_eq!(a3, ActionCommand::ExecuteDoubleTap);

        let (s4, a4) = transition(s3, TriggerEvent::Released, cap, InterruptBehavior::ForceTap, Instant::now());
        assert_eq!(s4, KeyState::Idle);
        assert_eq!(a4, ActionCommand::ReleaseDoubleTap);
    }

    #[test]
    fn test_double_tap_timeout() {
        let cap = KeyCapability::TapAndDoubleTap;
        let (s1, _) = transition(KeyState::Idle, TriggerEvent::Pressed, cap, InterruptBehavior::ForceTap, Instant::now());
        let (s2, _) = transition(s1, TriggerEvent::Released, cap, InterruptBehavior::ForceTap, Instant::now());

        let (s3, a3) = transition(s2, TriggerEvent::Timeout, cap, InterruptBehavior::ForceTap, Instant::now());
        assert_eq!(s3, KeyState::Idle);
        assert_eq!(a3, ActionCommand::ExecuteTapAtomic);
    }
}
