pub mod state;
pub mod utils;
pub mod actions;

use smallvec::SmallVec;
use crate::{Action, Config, InterruptBehavior, Trigger};
use crate::state_machine::{transition, ActionCommand, KeyCapability, KeyState, TriggerEvent};
use std::time::Instant;
use state::get_state;
use utils::{
    send_key_raw, send_key_atomic, apply_layer_modifiers,
    restore_suppressed_modifiers,
};
use actions::apply_action;

#[derive(Debug, PartialEq, Eq)]
pub enum HookAction {
    Block,
    PassThrough,
}

#[derive(Debug, PartialEq, Eq)]
pub enum TimerAction {
    Trigger(TriggerEvent),
    Pending(Instant),
}

#[derive(Debug, PartialEq, Eq)]
pub enum ReconcileAction {
    Execute,
    WaitUntil(Instant),
    None,
}

pub struct KeyProcessor;

impl KeyProcessor {
    fn get_bindings_with_layer<'a>(
        vk: u16,
        config: &'a Config,
        active_layers: &[String],
    ) -> Option<(&'a str, &'a Vec<crate::Binding>)> {
        for layer_id in config.layer_order.iter().rev() {
            if active_layers.contains(layer_id) || layer_id == "base" {
                if let Some(layer) = config.layers.iter().find(|l| &l.id == layer_id) {
                    if let Some(bindings) = layer.bindings.get(&vk) {
                        if !bindings.is_empty() {
                            return Some((layer_id.as_str(), bindings));
                        }
                    }
                }
            }
        }
        None
    }

    fn get_bindings<'a>(
        vk: u16,
        config: &'a Config,
        active_layers: &[String],
    ) -> Option<&'a Vec<crate::Binding>> {
        Self::get_bindings_with_layer(vk, config, active_layers).map(|(_, b)| b)
    }

    pub fn determine_capability(
        vk: u16,
        config: &Config,
        active_layers: &[String],
    ) -> Option<KeyCapability> {
        let bindings = Self::get_bindings(vk, config, active_layers)?;
        if bindings.is_empty() {
            return None;
        }

        let has_tap = bindings.iter().any(|b| b.trigger == Trigger::Tap);
        let has_double_tap = bindings.iter().any(|b| b.trigger == Trigger::DoubleTap);
        let hold_binding = bindings.iter().find(|b| b.trigger == Trigger::Hold);
        let has_hold = hold_binding.is_some();

        let is_passthrough = hold_binding
            .and_then(|hb| {
                if let Action::LayerMomentary { ref layer_id } = hb.action {
                    config.layers.iter().find(|l| &l.id == layer_id)?.passthrough_trigger_key
                } else {
                    None
                }
            })
            .unwrap_or(false);

        match (has_tap, has_hold, has_double_tap) {
            (true, true, true) => Some(KeyCapability::Full),
            (true, true, false) => Some(KeyCapability::TapAndHold),
            (true, false, true) => Some(KeyCapability::TapAndDoubleTap),
            (true, false, false) => Some(KeyCapability::TapOnly),
            (false, true, true) => Some(KeyCapability::HoldAndDoubleTap { is_passthrough }),
            (false, true, false) => Some(KeyCapability::HoldOnly { is_passthrough }),
            (false, false, true) => Some(KeyCapability::DoubleTapOnly),
            (false, false, false) => None,
        }
    }

    fn get_action_with_layer<'a>(
        vk: u16,
        trigger: Trigger,
        config: &'a Config,
        active_layers: &[String],
    ) -> Option<(&'a str, &'a Action)> {
        if let Some((layer_id, bindings)) = Self::get_bindings_with_layer(vk, config, active_layers) {
            if let Some(binding) = bindings.iter().find(|b| b.trigger == trigger) {
                return Some((layer_id, &binding.action));
            }
        }
        None
    }

    fn get_action<'a>(vk: u16, trigger: Trigger, config: &'a Config, active_layers: &[String]) -> Option<&'a Action> {
        Self::get_action_with_layer(vk, trigger, config, active_layers).map(|(_, a)| a)
    }

    fn get_timing(vk: u16, trigger: Trigger, config: &Config, active_layers: &[String]) -> Option<u32> {
        Self::get_bindings(vk, config, active_layers)
            .and_then(|b| b.iter().find(|x| x.trigger == trigger))
            .and_then(|b| b.timing_ms)
    }

    fn get_repeat_interval(vk: u16, trigger: Trigger, config: &Config, active_layers: &[String]) -> Option<u32> {
        if let Some(Action::Remap { repeat: Some(true), repeat_interval_ms, .. }) = Self::get_action(vk, trigger, config, active_layers) {
            *repeat_interval_ms
        } else {
            None
        }
    }

    fn execute_action(cmd: ActionCommand, vk: u16, config: &Config) {
        let get_action = |trigger: Trigger| {
            let state = get_state().lock().unwrap();
            Self::get_action_with_layer(vk, trigger, config, &state.active_layers)
        };

        match cmd {
            ActionCommand::None => {}
            ActionCommand::ExecuteTap => {
                if let Some((source_layer, action)) = get_action(Trigger::Tap) {
                    apply_action(vk, action, false, config, Some(source_layer));
                } else {
                    send_key_atomic(vk);
                }
            }
            ActionCommand::ExecuteTapAtomic => {
                if let Some((source_layer, action)) = get_action(Trigger::Tap) {
                    apply_action(vk, action, true, config, Some(source_layer));
                } else {
                    send_key_atomic(vk);
                }
                get_state().lock().unwrap().pressed_vks.remove(&vk);
            }
            ActionCommand::ExecuteHold => {
                if let Some((source_layer, action)) = get_action(Trigger::Hold) {
                    apply_action(vk, action, false, config, Some(source_layer));
                }
            }
            ActionCommand::ExecutePassthroughHoldDelayed => {
                send_key_raw(vk, false);
                if let Some((source_layer, action)) = get_action(Trigger::Hold) {
                    apply_action(vk, action, false, config, Some(source_layer));
                }
            }
            ActionCommand::ExecuteHoldRepeat => {
                if let Some((_, action)) = get_action(Trigger::Hold) {
                    actions::apply_repeat(vk, action);
                }
            }
            ActionCommand::ExecuteDoubleTap => {
                if let Some((source_layer, action)) = get_action(Trigger::DoubleTap) {
                    apply_action(vk, action, false, config, Some(source_layer));
                }
            }
            ActionCommand::ReleaseTap | ActionCommand::ReleaseHold | ActionCommand::ReleaseDoubleTap => {
                Self::release_key(vk, config);
            }
        }
    }

    fn release_key(vk: u16, config: &Config) {
        #[cfg(windows)]
        crate::hook::set_scroll_mode_state(false, 1.0, false, "both");

        let mut state = get_state().lock().unwrap();
        let vks = state.pressed_vks.remove(&vk).unwrap_or_default();
        for target in vks {
            send_key_raw(target, true);
        }

        if let Some(suppressed) = state.suppressed_modifiers_for_key.remove(&vk) {
            restore_suppressed_modifiers(&suppressed);
        }

        if let Some(pushed_layers) = state.momentary_layers.remove(&vk) {
            let old_layers = state.active_layers.clone();
            for layer_to_remove in pushed_layers.iter().rev() {
                if let Some(pos) = state.active_layers.iter().rposition(|l| l == layer_to_remove) {
                    state.active_layers.remove(pos);
                }
            }
            let new_layers = state.active_layers.clone();
            drop(state);
            apply_layer_modifiers(&old_layers, &new_layers, config);
            #[cfg(windows)]
            crate::hook::emit_layer_stack_changed(&new_layers);
        }
    }
    fn get_interrupt_behavior(vk_code: u16, config: &Config, active_layers: &[String]) -> crate::state_machine::InterruptBehavior {
        let bindings = match Self::get_bindings(vk_code, config, active_layers) {
            Some(b) => b,
            None => return crate::state_machine::InterruptBehavior::ForceTap,
        };

        let hold_binding = match bindings.iter().find(|b| b.trigger == Trigger::Hold) {
            Some(b) => b,
            None => return crate::state_machine::InterruptBehavior::ForceTap,
        };

        let has_tap = bindings.iter().any(|b| b.trigger == Trigger::Tap);
        match (hold_binding.interrupt_behavior, has_tap) {
            (Some(InterruptBehavior::Ignore), _) => crate::state_machine::InterruptBehavior::Ignore,
            (Some(InterruptBehavior::ForceHold), _) | (None, false) => crate::state_machine::InterruptBehavior::ForceHold,
            _ => crate::state_machine::InterruptBehavior::ForceTap,
        }
    }

    pub fn process_key(vk_code: u16, is_down: bool, config: &Config) -> HookAction {
        let mut state_guard = get_state().lock().unwrap();

        if is_down {
            let mut other_cmds: SmallVec<[(u16, ActionCommand); 16]> = SmallVec::new();

            let crate::key_processor::state::ProcessorState {
                ref mut key_states,
                ref active_layers,
                ..
            } = *state_guard;

            for (&other_vk, other_state) in key_states.iter_mut() {
                if other_vk != vk_code {
                    let cap = Self::determine_capability(other_vk, config, active_layers)
                        .unwrap_or(KeyCapability::TapOnly);
                    let (new_state, cmd) = transition(
                        *other_state,
                        TriggerEvent::OtherKeyPressed,
                        cap,
                        Self::get_interrupt_behavior(other_vk, config, active_layers),
                        Instant::now(),
                    );
                    *other_state = new_state;
                    other_cmds.push((other_vk, cmd));
                }
            }
            drop(state_guard);
            for (other_vk, cmd) in other_cmds {
                Self::execute_action(cmd, other_vk, config);
            }
            state_guard = get_state().lock().unwrap();
        }

        let is_tracked = state_guard.key_states.contains_key(&vk_code);
        let capability = Self::determine_capability(vk_code, config, &state_guard.active_layers);

        if capability.is_none() && !is_tracked {
            return HookAction::PassThrough;
        }

        let current_state = state_guard
            .key_states
            .get(&vk_code)
            .copied()
            .unwrap_or(KeyState::Idle);

        if is_down {
            match current_state {
                KeyState::HoldActive { .. } | KeyState::PassthroughHoldActive { .. } => {
                    if Self::get_repeat_interval(vk_code, Trigger::Hold, config, &state_guard.active_layers).is_some() {
                        return HookAction::Block;
                    }
                }
                KeyState::TapActive { .. } => {
                    if Self::get_repeat_interval(vk_code, Trigger::Tap, config, &state_guard.active_layers).is_some() {
                        return HookAction::Block;
                    }
                }
                _ => {}
            }
        }

        let event = if is_down {
            TriggerEvent::Pressed
        } else {
            TriggerEvent::Released
        };

        let cap = capability.unwrap_or(KeyCapability::TapOnly);
        let interrupt_behavior = Self::get_interrupt_behavior(vk_code, config, &state_guard.active_layers);
        let (new_state, cmd) = transition(current_state, event, cap, interrupt_behavior, Instant::now());
        log::debug!("DEBUG[transition]: vk={} event={:?} state {:?} -> {:?} (cmd: {:?})", vk_code, event, current_state, new_state, cmd);

        let is_passthrough = new_state.is_passthrough() || current_state.is_passthrough();

        if new_state == KeyState::Idle {
            state_guard.key_states.remove(&vk_code);
        } else {
            state_guard.key_states.insert(vk_code, new_state);
        }
        drop(state_guard);
        crate::key_processor::state::get_state_wrapper().cvar.notify_all();

        Self::execute_action(cmd, vk_code, config);

        if is_passthrough {
            HookAction::PassThrough
        } else {
            HookAction::Block
        }
    }

    fn update_next_timeout(next_timeout: &mut Option<Instant>, target: Instant) {
        *next_timeout = Some(next_timeout.map_or(target, |curr| curr.min(target)));
    }

    fn check_key_timer(
        key_state: &KeyState,
        vk: u16,
        config: &Config,
        active_layers: &[String],
        now: Instant,
    ) -> Option<TimerAction> {
        let (target_time, event) = match key_state {
            KeyState::WaitingForHold { pressed_at } => {
                let timing = Self::get_timing(vk, Trigger::Hold, config, active_layers).unwrap_or(200);
                (*pressed_at + std::time::Duration::from_millis(timing as u64), TriggerEvent::Timeout)
            }
            KeyState::WaitingForDoubleTap { first_released_at } => {
                let timing = Self::get_timing(vk, Trigger::DoubleTap, config, active_layers).unwrap_or(200);
                (*first_released_at + std::time::Duration::from_millis(timing as u64), TriggerEvent::Timeout)
            }
            KeyState::HoldActive { last_repeated_at, .. } | KeyState::PassthroughHoldActive { last_repeated_at, .. } => {
                let interval = Self::get_repeat_interval(vk, Trigger::Hold, config, active_layers)?;
                (*last_repeated_at + std::time::Duration::from_millis(interval as u64), TriggerEvent::CustomRepeat)
            }
            KeyState::TapActive { last_repeated_at, .. } => {
                let interval = Self::get_repeat_interval(vk, Trigger::Tap, config, active_layers)?;
                (*last_repeated_at + std::time::Duration::from_millis(interval as u64), TriggerEvent::CustomRepeat)
            }
            _ => return None,
        };

        if now >= target_time {
            Some(TimerAction::Trigger(event))
        } else {
            Some(TimerAction::Pending(target_time))
        }
    }

    fn check_reconcile_status(state: &crate::key_processor::state::ProcessorState, now: Instant) -> ReconcileAction {
        const IDLE_RECONCILE_THRESHOLD: std::time::Duration = std::time::Duration::from_millis(1500);

        if state.pressed_vks.is_empty() && state.momentary_layers.is_empty() {
            return ReconcileAction::None;
        }

        match crate::key_processor::state::get_last_key_activity() {
            Some(last_act) => {
                let idle_target = last_act + IDLE_RECONCILE_THRESHOLD;
                if now >= idle_target {
                    ReconcileAction::Execute
                } else {
                    ReconcileAction::WaitUntil(idle_target)
                }
            }
            None => ReconcileAction::Execute,
        }
    }

    pub fn start_timeout_worker(app: tauri::AppHandle) {
        use tauri::Manager;
        std::thread::spawn(move || {
            let mut state_guard = crate::key_processor::state::get_state_wrapper().mutex.lock().unwrap();

            loop {
                if !crate::hook::REMAP_ENABLED.load(std::sync::atomic::Ordering::SeqCst) {
                    let result = crate::key_processor::state::get_state_wrapper()
                        .cvar
                        .wait_timeout(state_guard, std::time::Duration::from_millis(100))
                        .unwrap();
                    state_guard = result.0;
                    continue;
                }

                let state = app.state::<crate::ConfigState>();
                let config = state.config.load();
                let now = Instant::now();
                let mut cmds: SmallVec<[(u16, ActionCommand); 16]> = SmallVec::new();
                let mut next_timeout: Option<Instant> = None;

                let crate::key_processor::state::ProcessorState {
                    ref mut key_states,
                    ref active_layers,
                    ..
                } = *state_guard;

                for (&vk, key_state) in key_states.iter_mut() {
                    match Self::check_key_timer(key_state, vk, &config, active_layers, now) {
                        Some(TimerAction::Trigger(event)) => {
                            let cap = Self::determine_capability(vk, &config, active_layers)
                                .unwrap_or(KeyCapability::TapOnly);
                            let interrupt_behavior = Self::get_interrupt_behavior(vk, &config, active_layers);
                            let (new_state, cmd) = transition(
                                *key_state,
                                event,
                                cap,
                                interrupt_behavior,
                                now,
                            );
                            if event == TriggerEvent::Timeout {
                                log::debug!("DEBUG[timeout]: vk={} state {:?} -> {:?} (cmd: {:?})", vk, key_state, new_state, cmd);
                            }
                            *key_state = new_state;
                            cmds.push((vk, cmd));
                        }
                        Some(TimerAction::Pending(target_time)) => {
                            Self::update_next_timeout(&mut next_timeout, target_time);
                        }
                        None => {}
                    }
                }
                state_guard.key_states.retain(|_, s| *s != KeyState::Idle);

                let should_reconcile = match Self::check_reconcile_status(&state_guard, now) {
                    ReconcileAction::Execute => true,
                    ReconcileAction::WaitUntil(target) => {
                        Self::update_next_timeout(&mut next_timeout, target);
                        false
                    }
                    ReconcileAction::None => false,
                };

                drop(state_guard);
                for (vk, cmd) in cmds {
                    Self::execute_action(cmd, vk, &config);
                }

                if should_reconcile {
                    #[cfg(windows)]
                    crate::key_processor::utils::reconcile_physical_keys();
                }

                state_guard = crate::key_processor::state::get_state_wrapper().mutex.lock().unwrap();

                if let Some(timeout) = next_timeout {
                    let wait_dur = timeout.saturating_duration_since(Instant::now());
                    if wait_dur > std::time::Duration::ZERO {
                        let result = crate::key_processor::state::get_state_wrapper()
                            .cvar
                            .wait_timeout(state_guard, wait_dur)
                            .unwrap();
                        state_guard = result.0;
                    }
                } else {
                    state_guard = crate::key_processor::state::get_state_wrapper().cvar.wait(state_guard).unwrap();
                }
            }
        });
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn create_test_config() -> Config {
        let mut config = crate::get_default_config();
        config.layers.push(crate::Layer {
            id: "shift".to_string(),
            passthrough_trigger_key: Some(true),
            default_modifiers: Some(serde_json::json!([160])),
            bindings: std::collections::HashMap::new(),
            parent_layer_id: None,
        });
        config.layer_order.push("shift".to_string());
        config
    }

    #[test]
    fn test_determine_capability() {
        let mut config = create_test_config();

        {
            let base_layer = config.layers.iter_mut().find(|l| l.id == "base").unwrap();
            base_layer.bindings.insert(65, vec![crate::Binding {
                trigger: Trigger::Tap,
                action: Action::Remap {
                    keys: vec![66],
                    repeat: None,
                    repeat_delay_ms: None,
                    repeat_interval_ms: None,
                },
                timing_ms: None,
                interrupt_behavior: None,
            }]);
        }

        let cap = KeyProcessor::determine_capability(65, &config, &["base".to_string()]);
        assert_eq!(cap, Some(KeyCapability::TapOnly));

        {
            let base_layer = config.layers.iter_mut().find(|l| l.id == "base").unwrap();
            base_layer.bindings.insert(160, vec![crate::Binding {
                trigger: Trigger::Hold,
                action: Action::LayerMomentary { layer_id: "shift".to_string() },
                timing_ms: None,
                interrupt_behavior: None,
            }]);
        }

        let cap = KeyProcessor::determine_capability(160, &config, &["base".to_string()]);
        assert_eq!(cap, Some(KeyCapability::HoldOnly { is_passthrough: true }));

        {
            let base_layer = config.layers.iter_mut().find(|l| l.id == "base").unwrap();
            base_layer.bindings.insert(29, vec![
                crate::Binding {
                    trigger: Trigger::Tap,
                    action: Action::Remap {
                        keys: vec![29],
                        repeat: None,
                        repeat_delay_ms: None,
                        repeat_interval_ms: None,
                    },
                    timing_ms: None,
                    interrupt_behavior: None,
                },
                crate::Binding {
                    trigger: Trigger::Hold,
                    action: Action::LayerMomentary { layer_id: "shift".to_string() },
                    timing_ms: None,
                    interrupt_behavior: None,
                },
            ]);
        }

        let cap = KeyProcessor::determine_capability(29, &config, &["base".to_string()]);
        assert_eq!(cap, Some(KeyCapability::TapAndHold));
    }

    #[test]
    fn test_process_key_fastpath_passthrough_momentary() {
        let _lock = state::TEST_LOCK.lock().unwrap();
        let mut config = create_test_config();
        {
            let base_layer = config.layers.iter_mut().find(|l| l.id == "base").unwrap();
            base_layer.bindings.insert(160, vec![crate::Binding {
                trigger: Trigger::Hold,
                action: Action::LayerMomentary { layer_id: "shift".to_string() },
                timing_ms: None,
                interrupt_behavior: None,
            }]);
        }

        {
            let mut state = get_state().lock().unwrap();
            state.active_layers = vec!["base".to_string()];
            state.key_states.clear();
            state.momentary_layers.clear();
        }

        let action_down = KeyProcessor::process_key(160, true, &config);
        assert_eq!(action_down, HookAction::PassThrough);

        {
            let state = get_state().lock().unwrap();
            assert!(matches!(state.key_states.get(&160), Some(KeyState::PassthroughHoldActive { .. })));
            assert!(state.active_layers.contains(&"shift".to_string()));
            assert_eq!(state.get_passthrough_trigger_keys().contains(&160), true);
        }

        let action_up = KeyProcessor::process_key(160, false, &config);
        assert_eq!(action_up, HookAction::PassThrough);

        {
            let state = get_state().lock().unwrap();
            assert!(!state.key_states.contains_key(&160));
            assert!(!state.active_layers.contains(&"shift".to_string()));
            assert_eq!(state.get_passthrough_trigger_keys().contains(&160), false);
        }
    }

    #[test]
    fn test_process_key_non_passthrough_momentary_muhenkan() {
        let _lock = state::TEST_LOCK.lock().unwrap();
        let mut config = create_test_config();
        config.layers.push(crate::Layer {
            id: "num".to_string(),
            passthrough_trigger_key: Some(false),
            default_modifiers: None,
            bindings: std::collections::HashMap::new(),
            parent_layer_id: None,
        });
        config.layer_order.push("num".to_string());

        {
            let base_layer = config.layers.iter_mut().find(|l| l.id == "base").unwrap();
            base_layer.bindings.insert(29, vec![crate::Binding {
                trigger: Trigger::Hold,
                action: Action::LayerMomentary { layer_id: "num".to_string() },
                timing_ms: Some(200),
                interrupt_behavior: Some(InterruptBehavior::ForceHold),
            }]);
        }

        {
            let mut state = get_state().lock().unwrap();
            state.active_layers = vec!["base".to_string()];
            state.key_states.clear();
            state.momentary_layers.clear();
        }

        let action_down = KeyProcessor::process_key(29, true, &config);
        assert_eq!(action_down, HookAction::Block);

        {
            let state = get_state().lock().unwrap();
            assert!(matches!(state.key_states.get(&29), Some(KeyState::WaitingForHold { .. })));
            assert!(!state.active_layers.contains(&"num".to_string()));
        }

        let action_up = KeyProcessor::process_key(29, false, &config);
        assert_eq!(action_up, HookAction::Block);

        {
            let state = get_state().lock().unwrap();
            assert!(!state.key_states.contains_key(&29));
            assert!(!state.active_layers.contains(&"num".to_string()));
        }
    }
}
