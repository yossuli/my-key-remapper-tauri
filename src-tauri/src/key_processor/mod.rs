pub mod state;
pub mod utils;
pub mod actions;
pub mod reconciliation;

#[cfg(test)]
mod ime_diagnostics;

use smallvec::SmallVec;
use crate::{Action, Config, InterruptBehavior, Trigger};
use crate::state_machine::{transition, ActionCommand, KeyCapability, KeyState, TriggerEvent};
use std::time::Instant;
use state::get_state;
use utils::{
    send_key_raw, send_key_atomic,
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
    pub(crate) fn get_bindings_with_layer<'a>(
        vk: u16,
        config: &'a Config,
        active_layers: &[String],
    ) -> Option<(&'a str, &'a Vec<crate::Binding>)> {
        for layer_id in active_layers.iter().rev() {
            if let Some(layer) = config.layers.iter().find(|l| &l.id == layer_id) {
                if let Some(bindings) = layer.bindings.get(&vk) {
                    if !bindings.is_empty() {
                        return Some((layer.id.as_str(), bindings));
                    }
                }
            }
        }
        if !active_layers.iter().any(|l| l == "base") {
            if let Some(layer) = config.layers.iter().find(|l| l.id == "base") {
                if let Some(bindings) = layer.bindings.get(&vk) {
                    if !bindings.is_empty() {
                        return Some((layer.id.as_str(), bindings));
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
            if !(utils::is_modifier(target) && utils::is_key_passed_through(target, &state)) {
                send_key_raw(target, true);
            }
        }

        let is_momentary = state.momentary_layers.remove(&vk).is_some();
        state.momentary_keys.retain(|&(k, _)| k != vk);
        state.ghost_keys.remove(&vk);

        let mut effects = reconciliation::ReconcileEffects::new();
        let mut new_layers = Vec::new();

        if is_momentary {
            let (rec_effects, rec_layers) = reconciliation::reconcile_momentary_on_release(&mut state, config);
            effects = rec_effects;
            new_layers = rec_layers;
        }

        if let Some(suppressed) = state.suppressed_modifiers_for_key.remove(&vk) {
            restore_suppressed_modifiers(&suppressed, &mut state, config);
        }

        drop(state);

        if is_momentary {
            // ロック外で副作用（キー送信）を一括実行
            effects.execute();

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

        if !is_down && state_guard.ghost_keys.remove(&vk_code) {
            state_guard.key_states.remove(&vk_code);
            state_guard.momentary_keys.retain(|&(k, _)| k != vk_code);
            state_guard.momentary_layers.remove(&vk_code);
            if utils::is_modifier(vk_code) {
                state_guard.physically_pressed_modifiers.remove(&vk_code);
            }
            return HookAction::Block;
        }

        if is_down && state_guard.ghost_keys.contains(&vk_code) {
            return HookAction::Block;
        }

        if utils::is_modifier(vk_code) {
            if is_down {
                state_guard.physically_pressed_modifiers.insert(vk_code);
            } else {
                state_guard.physically_pressed_modifiers.remove(&vk_code);
            }
        }

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
            default_modifiers: Some(crate::model::ModifierOutput::new().with_shift(true)),
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

    #[test]
    fn test_shift_held_through_momentary_layer_and_remap() {
        let _lock = state::TEST_LOCK.lock().unwrap();
        let mut config = crate::get_default_config();

        // ユーザー設定の構成:
        // - base: 160 -> Hold(shift) [forceHold]
        // - shift: defaultModifiers: { shift: false }, passthroughTriggerKey: true
        //          29 -> Hold(num_shift)
        // - num_shift: defaultModifiers: { shift: true }
        //              87 ('w') -> Tap(Remap [160, 50])
        config.layers.clear();
        config.layer_order = vec![
            "base".to_string(),
            "shift".to_string(),
            "num_shift".to_string(),
        ];

        let mut base_bindings = std::collections::HashMap::new();
        base_bindings.insert(160, vec![crate::Binding {
            trigger: Trigger::Hold,
            action: Action::LayerMomentary { layer_id: "shift".to_string() },
            timing_ms: None,
            interrupt_behavior: Some(InterruptBehavior::ForceHold),
        }]);
        config.layers.push(crate::Layer {
            id: "base".to_string(),
            bindings: base_bindings,
            default_modifiers: Some(crate::model::ModifierOutput::new().with_shift(false)),
            passthrough_trigger_key: None,
            parent_layer_id: None,
        });

        let mut shift_bindings = std::collections::HashMap::new();
        shift_bindings.insert(29, vec![crate::Binding {
            trigger: Trigger::Hold,
            action: Action::LayerMomentary { layer_id: "num_shift".to_string() },
            timing_ms: None,
            interrupt_behavior: None,
        }]);
        config.layers.push(crate::Layer {
            id: "shift".to_string(),
            bindings: shift_bindings,
            default_modifiers: Some(crate::model::ModifierOutput::new().with_shift(false)),
            passthrough_trigger_key: Some(true),
            parent_layer_id: None,
        });

        let mut num_shift_bindings = std::collections::HashMap::new();
        num_shift_bindings.insert(87, vec![crate::Binding {
            trigger: Trigger::Tap,
            action: Action::Remap {
                keys: vec![160, 50],
                repeat: Some(false),
                repeat_delay_ms: None,
                repeat_interval_ms: None,
            },
            timing_ms: None,
            interrupt_behavior: None,
        }]);
        config.layers.push(crate::Layer {
            id: "num_shift".to_string(),
            bindings: num_shift_bindings,
            default_modifiers: Some(crate::model::ModifierOutput::new().with_shift(true)),
            passthrough_trigger_key: None,
            parent_layer_id: None,
        });

        // 状態初期化
        {
            let mut state = get_state().lock().unwrap();
            state.active_layers = vec!["base".to_string()];
            state.key_states.clear();
            state.momentary_layers.clear();
            state.pressed_vks.clear();
            state.suppressed_modifiers_for_key.clear();
            utils::TEST_SENT_KEYS.lock().unwrap().clear();
        }

        // 1. Shift (160) 押下 (passthroughTriggerKey: true なので PassThrough)
        let a1 = KeyProcessor::process_key(160, true, &config);
        assert_eq!(a1, HookAction::PassThrough);

        // 2. 'a' (65) 押下 & リリース
        let a2 = KeyProcessor::process_key(65, true, &config);
        assert_eq!(a2, HookAction::PassThrough);
        let a3 = KeyProcessor::process_key(65, false, &config);
        assert_eq!(a3, HookAction::PassThrough);

        // 3. Shift を押したまま 無変換 (29) 押下
        let a4 = KeyProcessor::process_key(29, true, &config);
        assert_eq!(a4, HookAction::Block);

        // 送信履歴をクリア
        utils::TEST_SENT_KEYS.lock().unwrap().clear();

        // 4. 'w' (87) 押下 & リリース
        let a5 = KeyProcessor::process_key(87, true, &config);
        assert_eq!(a5, HookAction::Block);
        let a6 = KeyProcessor::process_key(87, false, &config);
        assert_eq!(a6, HookAction::Block);

        // 5. 無変換 (29) リリース
        let a7 = KeyProcessor::process_key(29, false, &config);
        assert_eq!(a7, HookAction::Block);

        // ★ 検証: 'w' 入力〜無変換リリースまでの間に、160 の KeyUp が送信されていないこと！
        let sent_keys = utils::TEST_SENT_KEYS.lock().unwrap().clone();
        let shift_up_count = sent_keys.iter().filter(|&&(vk, is_up)| (vk == 160 || vk == 16) && is_up).count();
        assert_eq!(shift_up_count, 0, "Shift KeyUp should NOT be sent while Shift is physically held! Sent: {:?}", sent_keys);

        // 6. 's' (83) 押下 -> PassThrough
        let a8 = KeyProcessor::process_key(83, true, &config);
        assert_eq!(a8, HookAction::PassThrough);

        // 7. 最後に Shift (160) をリリース
        let a9 = KeyProcessor::process_key(160, false, &config);
        // passthrough なので PassThrough で OS に KeyUp が届く
        assert_eq!(a9, HookAction::PassThrough);
    }

    #[test]
    fn test_modifier_remap_released_cleanly_when_not_physically_held() {
        let _lock = state::TEST_LOCK.lock().unwrap();
        let mut config = crate::get_default_config();
        config.layers.clear();
        config.layer_order = vec!["base".to_string()];

        let mut base_bindings = std::collections::HashMap::new();
        // Aキー (65) -> Tap で [Ctrl(162), C(67)]
        base_bindings.insert(65, vec![crate::Binding {
            trigger: Trigger::Tap,
            action: Action::Remap {
                keys: vec![162, 67],
                repeat: Some(false),
                repeat_delay_ms: None,
                repeat_interval_ms: None,
            },
            timing_ms: None,
            interrupt_behavior: None,
        }]);
        // Bキー (66) -> Tap で [Shift(160)] (修飾キー単体リマップ: Shift)
        base_bindings.insert(66, vec![crate::Binding {
            trigger: Trigger::Tap,
            action: Action::Remap {
                keys: vec![160],
                repeat: Some(false),
                repeat_delay_ms: None,
                repeat_interval_ms: None,
            },
            timing_ms: None,
            interrupt_behavior: None,
        }]);

        config.layers.push(crate::Layer {
            id: "base".to_string(),
            bindings: base_bindings,
            default_modifiers: None,
            passthrough_trigger_key: None,
            parent_layer_id: None,
        });

        // 状態初期化
        {
            let mut state = get_state().lock().unwrap();
            state.active_layers = vec!["base".to_string()];
            state.key_states.clear();
            state.momentary_layers.clear();
            state.pressed_vks.clear();
            state.suppressed_modifiers_for_key.clear();
            state.physically_pressed_modifiers.clear();
            utils::TEST_SENT_KEYS.lock().unwrap().clear();
        }

        // 1. Aキー (65) 押下 (Tap開始)
        let _ = KeyProcessor::process_key(65, true, &config);
        // Aキー (65) リリース (Tap確定・解放)
        let _ = KeyProcessor::process_key(65, false, &config);

        let sent = utils::TEST_SENT_KEYS.lock().unwrap().clone();
        assert!(sent.iter().any(|&(vk, is_up)| vk == 162 && !is_up), "Ctrl KeyDown should be sent");
        assert!(sent.iter().any(|&(vk, is_up)| vk == 162 && is_up), "Ctrl KeyUp must be sent after remap! Sent: {:?}", sent);
        assert!(sent.iter().any(|&(vk, is_up)| vk == 67 && !is_up), "C KeyDown should be sent");
        assert!(sent.iter().any(|&(vk, is_up)| vk == 67 && is_up), "C KeyUp should be sent");

        // 送信履歴をクリア
        utils::TEST_SENT_KEYS.lock().unwrap().clear();

        // 2. Bキー (66) 押下 & リリース (修飾キー単体リマップ: Shift)
        let _ = KeyProcessor::process_key(66, true, &config);
        let _ = KeyProcessor::process_key(66, false, &config);

        let sent_b = utils::TEST_SENT_KEYS.lock().unwrap().clone();
        assert!(sent_b.iter().any(|&(vk, is_up)| vk == 160 && !is_up), "Shift KeyDown should be sent");
        assert!(sent_b.iter().any(|&(vk, is_up)| vk == 160 && is_up), "Shift KeyUp must be sent after modifier-only remap! Sent: {:?}", sent_b);
    }

    #[test]
    fn test_non_passthrough_momentary_modifier_sends_default_modifiers() {
        let _lock = state::TEST_LOCK.lock().unwrap();
        let mut config = crate::get_default_config();
        config.layers.clear();
        config.layer_order = vec![
            "base".to_string(),
            "num".to_string(),
            "num_shift".to_string(),
        ];

        // base: 29 (無変換) -> Hold(num) [forceHold]
        let mut base_bindings = std::collections::HashMap::new();
        base_bindings.insert(29, vec![crate::Binding {
            trigger: Trigger::Hold,
            action: Action::LayerMomentary { layer_id: "num".to_string() },
            timing_ms: None,
            interrupt_behavior: Some(InterruptBehavior::ForceHold),
        }]);
        config.layers.push(crate::Layer {
            id: "base".to_string(),
            bindings: base_bindings,
            default_modifiers: None,
            passthrough_trigger_key: None,
            parent_layer_id: None,
        });

        // num: 160 (LShift) -> Hold(num_shift) [forceHold, passthroughTriggerKey なし (ブロック)]
        let mut num_bindings = std::collections::HashMap::new();
        num_bindings.insert(160, vec![crate::Binding {
            trigger: Trigger::Hold,
            action: Action::LayerMomentary { layer_id: "num_shift".to_string() },
            timing_ms: None,
            interrupt_behavior: Some(InterruptBehavior::ForceHold),
        }]);
        config.layers.push(crate::Layer {
            id: "num".to_string(),
            bindings: num_bindings,
            default_modifiers: None,
            passthrough_trigger_key: None,
            parent_layer_id: None,
        });

        // num_shift: defaultModifiers: { shift: true }
        // 87 ('w') -> Tap(Remap [50])
        let mut num_shift_bindings = std::collections::HashMap::new();
        num_shift_bindings.insert(87, vec![crate::Binding {
            trigger: Trigger::Tap,
            action: Action::Remap {
                keys: vec![50],
                repeat: Some(false),
                repeat_delay_ms: None,
                repeat_interval_ms: None,
            },
            timing_ms: None,
            interrupt_behavior: None,
        }]);
        config.layers.push(crate::Layer {
            id: "num_shift".to_string(),
            bindings: num_shift_bindings,
            default_modifiers: Some(crate::model::ModifierOutput::new().with_shift(true)),
            passthrough_trigger_key: None,
            parent_layer_id: Some("num".to_string()),
        });

        // 状態初期化
        {
            let mut state = get_state().lock().unwrap();
            state.active_layers = vec!["base".to_string()];
            state.key_states.clear();
            state.momentary_layers.clear();
            state.pressed_vks.clear();
            state.suppressed_modifiers_for_key.clear();
            state.physically_pressed_modifiers.clear();
            utils::TEST_SENT_KEYS.lock().unwrap().clear();
        }

        // 1. 無変換 (29) 押下
        let a1 = KeyProcessor::process_key(29, true, &config);
        assert_eq!(a1, HookAction::Block);

        // 2. Shift (160) 押下 -> 29 が ForceHold で確定して num レイヤーへ
        let a2 = KeyProcessor::process_key(160, true, &config);
        assert_eq!(a2, HookAction::Block);

        // 3. 'w' (87) 押下 -> 160 が ForceHold で確定して num_shift レイヤーへ
        let a3 = KeyProcessor::process_key(87, true, &config);
        assert_eq!(a3, HookAction::Block);

        // ★ 検証: num_shift の defaultModifiers: { shift: true } により、
        // 物理Shiftはブロックされていても、OSに対して 160 KeyDown が正しく送信されていること！
        // また、Remap [50] (Shiftなし) の押下時には、Shiftが一時的に suppress され、50 Down が送信される（長押し維持のため 50 Up は送出されない）。
        let sent_keys = utils::TEST_SENT_KEYS.lock().unwrap().clone();
        assert_eq!(
            sent_keys,
            vec![(160, false), (160, true), (50, false)],
            "Expected sequence on down: Shift Down (layer mod) -> Shift Up (suppress) -> 50 Down (hold sustained)"
        );

        // 'w' (87) リリース -> 50 Up と Shift restore (160 Down) が送信される
        utils::TEST_SENT_KEYS.lock().unwrap().clear();
        let _ = KeyProcessor::process_key(87, false, &config);
        let sent_keys_w_rel = utils::TEST_SENT_KEYS.lock().unwrap().clone();
        assert_eq!(
            sent_keys_w_rel,
            vec![(50, true), (160, false)],
            "Expected sequence on release: 50 Up -> Shift Down (restore)"
        );

        // 4. Shift (160) リリース -> OSに 160 KeyUp が送信されること
        utils::TEST_SENT_KEYS.lock().unwrap().clear();
        let a4 = KeyProcessor::process_key(160, false, &config);
        assert_eq!(a4, HookAction::Block);

        let sent_keys_after_rel = utils::TEST_SENT_KEYS.lock().unwrap().clone();
        let shift_up_count = sent_keys_after_rel.iter().filter(|&&(vk, is_up)| vk == 160 && is_up).count();
        assert_eq!(shift_up_count, 1, "Shift KeyUp must be sent when num_shift is popped! Sent: {:?}", sent_keys_after_rel);

        // 5. 無変換 (29) リリース
        let _ = KeyProcessor::process_key(29, false, &config);
    }

    #[test]
    fn test_get_bindings_with_layer_stack_order() {
        let mut config = crate::get_default_config();
        config.layers.clear();
        // layer_order は "bottom" の方が後ろ
        config.layer_order = vec!["base".to_string(), "top".to_string(), "bottom".to_string()];

        let mut top_bindings = std::collections::HashMap::new();
        top_bindings.insert(65, vec![crate::Binding {
            trigger: Trigger::Tap,
            action: Action::Remap {
                keys: vec![1],
                repeat: None,
                repeat_delay_ms: None,
                repeat_interval_ms: None,
            },
            timing_ms: None,
            interrupt_behavior: None,
        }]);
        config.layers.push(crate::Layer {
            id: "top".to_string(),
            bindings: top_bindings,
            default_modifiers: None,
            passthrough_trigger_key: None,
            parent_layer_id: None,
        });

        let mut bottom_bindings = std::collections::HashMap::new();
        bottom_bindings.insert(65, vec![crate::Binding {
            trigger: Trigger::Tap,
            action: Action::Remap {
                keys: vec![2],
                repeat: None,
                repeat_delay_ms: None,
                repeat_interval_ms: None,
            },
            timing_ms: None,
            interrupt_behavior: None,
        }]);
        config.layers.push(crate::Layer {
            id: "bottom".to_string(),
            bindings: bottom_bindings,
            default_modifiers: None,
            passthrough_trigger_key: None,
            parent_layer_id: None,
        });

        // スタックで top が上（末尾）にある場合
        let stack1 = vec!["base".to_string(), "bottom".to_string(), "top".to_string()];
        let (found_layer, _) = KeyProcessor::get_bindings_with_layer(65, &config, &stack1).unwrap();
        assert_eq!(found_layer, "top");

        // スタックで bottom が上（末尾）にある場合
        let stack2 = vec!["base".to_string(), "top".to_string(), "bottom".to_string()];
        let (found_layer2, _) = KeyProcessor::get_bindings_with_layer(65, &config, &stack2).unwrap();
        assert_eq!(found_layer2, "bottom");
    }

    #[test]
    fn test_muhenkan_shift_rollover_recovers_to_shift_layer() {
        let _lock = state::TEST_LOCK.lock().unwrap();
        let mut config = crate::get_default_config();
        config.layers.clear();
        config.layer_order = vec![
            "base".to_string(),
            "num".to_string(),
            "shift".to_string(),
            "num_shift".to_string(),
        ];

        // 1. base: 29(無変換) -> num, 160(Shift) -> shift
        let mut base_bindings = std::collections::HashMap::new();
        base_bindings.insert(29, vec![crate::Binding {
            trigger: Trigger::Hold,
            action: Action::LayerMomentary { layer_id: "num".to_string() },
            timing_ms: None,
            interrupt_behavior: Some(InterruptBehavior::ForceHold),
        }]);
        base_bindings.insert(160, vec![crate::Binding {
            trigger: Trigger::Hold,
            action: Action::LayerMomentary { layer_id: "shift".to_string() },
            timing_ms: None,
            interrupt_behavior: Some(InterruptBehavior::ForceHold),
        }]);
        config.layers.push(crate::Layer {
            id: "base".to_string(),
            bindings: base_bindings,
            default_modifiers: None,
            passthrough_trigger_key: None,
            parent_layer_id: None,
        });

        // 2. num: 160 -> num_shift, 74('J') -> Remap [192] (`)
        let mut num_bindings = std::collections::HashMap::new();
        num_bindings.insert(160, vec![crate::Binding {
            trigger: Trigger::Hold,
            action: Action::LayerMomentary { layer_id: "num_shift".to_string() },
            timing_ms: None,
            interrupt_behavior: Some(InterruptBehavior::ForceHold),
        }]);
        num_bindings.insert(74, vec![crate::Binding {
            trigger: Trigger::Tap,
            action: Action::Remap {
                keys: vec![192],
                repeat: None,
                repeat_delay_ms: None,
                repeat_interval_ms: None,
            },
            timing_ms: None,
            interrupt_behavior: None,
        }]);
        config.layers.push(crate::Layer {
            id: "num".to_string(),
            bindings: num_bindings,
            default_modifiers: None,
            passthrough_trigger_key: None,
            parent_layer_id: None,
        });

        // 3. shift: 29 -> num_shift, defaultModifiers: { shift: false }, passthroughTriggerKey: true
        let mut shift_bindings = std::collections::HashMap::new();
        shift_bindings.insert(29, vec![crate::Binding {
            trigger: Trigger::Hold,
            action: Action::LayerMomentary { layer_id: "num_shift".to_string() },
            timing_ms: None,
            interrupt_behavior: Some(InterruptBehavior::ForceHold),
        }]);
        config.layers.push(crate::Layer {
            id: "shift".to_string(),
            bindings: shift_bindings,
            default_modifiers: Some(crate::model::ModifierOutput::new().with_shift(false)),
            passthrough_trigger_key: Some(true),
            parent_layer_id: None,
        });

        // 4. num_shift: defaultModifiers: { shift: true } (74のバインディングなし)
        config.layers.push(crate::Layer {
            id: "num_shift".to_string(),
            bindings: std::collections::HashMap::new(),
            default_modifiers: Some(crate::model::ModifierOutput::new().with_shift(true)),
            passthrough_trigger_key: None,
            parent_layer_id: Some("num".to_string()),
        });

        // 状態初期化
        {
            let mut state = get_state().lock().unwrap();
            state.active_layers = vec!["base".to_string()];
            state.key_states.clear();
            state.momentary_layers.clear();
            state.momentary_keys.clear();
            state.ghost_keys.clear();
            state.pressed_vks.clear();
            state.suppressed_modifiers_for_key.clear();
            state.physically_pressed_modifiers.clear();
            utils::TEST_SENT_KEYS.lock().unwrap().clear();
        }

        // 1. 無変換 (29) 押下 (WaitingForHold)
        let _ = KeyProcessor::process_key(29, true, &config);

        // 2. Shift (160) 押下 -> 29 が ForceHold で確定して num レイヤーへ
        let _ = KeyProcessor::process_key(160, true, &config);
        assert_eq!(get_state().lock().unwrap().active_layers, vec!["base", "num"]);

        // 3. J (74) タップ (1回目) -> 160 が確定して num_shift へ、そして num の J -> 192 (`) が発火すること
        utils::TEST_SENT_KEYS.lock().unwrap().clear();
        let _ = KeyProcessor::process_key(74, true, &config);
        let _ = KeyProcessor::process_key(74, false, &config);
        let sent_1 = utils::TEST_SENT_KEYS.lock().unwrap().clone();
        assert!(sent_1.iter().any(|&(vk, is_up)| vk == 192 && !is_up), "First J must output ` (192), sent: {:?}", sent_1);

        // 4. 無変換 (29) リリース！
        // ★重要: このリリースで残ったShift(160)が再評価され、スタックが直ちに [base, shift] に再同期すること！
        utils::TEST_SENT_KEYS.lock().unwrap().clear();
        let _ = KeyProcessor::process_key(29, false, &config);
        let active = get_state().lock().unwrap().active_layers.clone();
        assert_eq!(active, vec!["base".to_string(), "shift".to_string()], "Stack must re-evaluate to [base, shift]!");

        // ★重要: 修飾キーの余計な KeyUp/KeyDown 再送信が発生していないこと
        let sent_during_rel = utils::TEST_SENT_KEYS.lock().unwrap().clone();
        assert!(
            sent_during_rel.is_empty(),
            "No spurious modifier KeyUp/KeyDown should be sent during re-evaluation! Sent: {:?}",
            sent_during_rel
        );

        // 5. J (74) タップ (2回目) -> shift レイヤーに74の設定はないため、パススルー (HookAction::PassThrough) になり、
        // 192 (`) に化けずに OS へ J が直接通ること（Shiftが効いているので大文字Jになる）！
        utils::TEST_SENT_KEYS.lock().unwrap().clear();
        let a_j_down = KeyProcessor::process_key(74, true, &config);
        assert_eq!(a_j_down, HookAction::PassThrough, "Second J must be passed through directly to OS!");
        let a_j_up = KeyProcessor::process_key(74, false, &config);
        assert_eq!(a_j_up, HookAction::PassThrough);
        let sent_2 = utils::TEST_SENT_KEYS.lock().unwrap().clone();
        assert!(sent_2.is_empty(), "No remap keys (like 192) should be sent! Sent: {:?}", sent_2);

        // 6. Shift (160) リリース -> [base] に戻り、パススルー (HookAction::PassThrough) で物理 KeyUp が直接 OS に通ること
        utils::TEST_SENT_KEYS.lock().unwrap().clear();
        let a_shift_up = KeyProcessor::process_key(160, false, &config);
        assert_eq!(a_shift_up, HookAction::PassThrough, "Shift KeyUp must be passed through directly to OS!");
        assert_eq!(get_state().lock().unwrap().active_layers, vec!["base".to_string()]);
    }

    #[test]
    fn test_multi_level_nesting_rollover_order() {
        let _lock = state::TEST_LOCK.lock().unwrap();
        let mut config = crate::get_default_config();
        config.layers.clear();
        config.layer_order = vec![
            "base".to_string(),
            "layer1".to_string(),
            "layer1_c".to_string(),
            "layer1_bc".to_string(),
        ];

        // A=10: base -> layer1
        let mut base_bindings = std::collections::HashMap::new();
        base_bindings.insert(10, vec![crate::Binding {
            trigger: Trigger::Hold,
            action: Action::LayerMomentary { layer_id: "layer1".to_string() },
            timing_ms: None,
            interrupt_behavior: Some(InterruptBehavior::ForceHold),
        }]);
        config.layers.push(crate::Layer {
            id: "base".to_string(),
            bindings: base_bindings,
            default_modifiers: None,
            passthrough_trigger_key: None,
            parent_layer_id: None,
        });

        // layer1: B=20 -> layer1_b (or simultaneous), C=30 -> layer1_c
        let mut layer1_bindings = std::collections::HashMap::new();
        layer1_bindings.insert(30, vec![crate::Binding {
            trigger: Trigger::Hold,
            action: Action::LayerMomentary { layer_id: "layer1_c".to_string() },
            timing_ms: None,
            interrupt_behavior: Some(InterruptBehavior::ForceHold),
        }]);
        layer1_bindings.insert(20, vec![crate::Binding {
            trigger: Trigger::Hold,
            action: Action::LayerMomentary { layer_id: "layer1_b".to_string() },
            timing_ms: None,
            interrupt_behavior: Some(InterruptBehavior::ForceHold),
        }]);
        config.layers.push(crate::Layer {
            id: "layer1".to_string(),
            bindings: layer1_bindings,
            default_modifiers: None,
            passthrough_trigger_key: None,
            parent_layer_id: None,
        });

        config.layers.push(crate::Layer {
            id: "layer1_c".to_string(),
            bindings: std::collections::HashMap::new(),
            default_modifiers: None,
            passthrough_trigger_key: None,
            parent_layer_id: None,
        });

        // 状態初期化
        {
            let mut state = get_state().lock().unwrap();
            state.active_layers = vec!["base".to_string()];
            state.key_states.clear();
            state.momentary_layers.clear();
            state.momentary_keys.clear();
            state.ghost_keys.clear();
        }

        // A(10)押下 -> B(20)押下(Aが確定) -> C(30)押下(Bが確定) -> ダミーキー40押下(Cが確定)
        let _ = KeyProcessor::process_key(10, true, &config);
        let _ = KeyProcessor::process_key(20, true, &config);
        let _ = KeyProcessor::process_key(30, true, &config);
        let _ = KeyProcessor::process_key(40, true, &config);

        // B(20) をリリース！
        let _ = KeyProcessor::process_key(20, false, &config);

        // A(10) が先に評価され、その上で C(30) が評価されるため、スタックには layer1_c が残ること！
        let active = get_state().lock().unwrap().active_layers.clone();
        assert!(
            active.contains(&"layer1_c".to_string()),
            "C's layer must survive because A was evaluated first! Active: {:?}",
            active
        );
    }

    #[test]
    fn test_ghost_key_prevented_from_leaking() {
        let _lock = state::TEST_LOCK.lock().unwrap();
        let mut config = crate::get_default_config();
        config.layers.clear();

        // A=10: base -> layer1
        let mut base_bindings = std::collections::HashMap::new();
        base_bindings.insert(10, vec![crate::Binding {
            trigger: Trigger::Hold,
            action: Action::LayerMomentary { layer_id: "layer1".to_string() },
            timing_ms: None,
            interrupt_behavior: Some(InterruptBehavior::ForceHold),
        }]);
        // Base で B=20 は Tap -> Remap [99] (通常文字)
        base_bindings.insert(20, vec![crate::Binding {
            trigger: Trigger::Tap,
            action: Action::Remap { keys: vec![99], repeat: None, repeat_delay_ms: None, repeat_interval_ms: None },
            timing_ms: None,
            interrupt_behavior: None,
        }]);
        config.layers.push(crate::Layer {
            id: "base".to_string(),
            bindings: base_bindings,
            default_modifiers: None,
            passthrough_trigger_key: None,
            parent_layer_id: None,
        });

        // layer1: B=20 -> Hold(sublayer)
        let mut layer1_bindings = std::collections::HashMap::new();
        layer1_bindings.insert(20, vec![crate::Binding {
            trigger: Trigger::Hold,
            action: Action::LayerMomentary { layer_id: "sublayer".to_string() },
            timing_ms: None,
            interrupt_behavior: Some(InterruptBehavior::ForceHold),
        }]);
        config.layers.push(crate::Layer {
            id: "layer1".to_string(),
            bindings: layer1_bindings,
            default_modifiers: None,
            passthrough_trigger_key: None,
            parent_layer_id: None,
        });

        // 状態初期化
        {
            let mut state = get_state().lock().unwrap();
            state.active_layers = vec!["base".to_string()];
            state.key_states.clear();
            state.momentary_layers.clear();
            state.momentary_keys.clear();
            state.ghost_keys.clear();
            utils::TEST_SENT_KEYS.lock().unwrap().clear();
        }

        // 1. A(10) 押下 -> B(20) 押下で A(10) が確定
        let _ = KeyProcessor::process_key(10, true, &config);
        let _ = KeyProcessor::process_key(20, true, &config);
        // 2. ダミーキー30押下で B(20) が確定
        let _ = KeyProcessor::process_key(30, true, &config);

        // 3. 親キー A(10) をリリース！
        // B は Base では Hold が定義されていないため、ゴーストキーとしてマークされる
        let _ = KeyProcessor::process_key(10, false, &config);
        assert!(get_state().lock().unwrap().ghost_keys.contains(&20), "B must be ghosted");

        // 4. B(20) を物理的に離す (KeyUp)
        utils::TEST_SENT_KEYS.lock().unwrap().clear();
        let action = KeyProcessor::process_key(20, false, &config);
        assert_eq!(action, HookAction::Block, "Ghost key KeyUp must be blocked");

        // Base の Remap [99] が誤爆送信されていないこと！
        let sent = utils::TEST_SENT_KEYS.lock().unwrap().clone();
        assert!(sent.is_empty(), "No spurious base keys should be sent when ghost key is released!");
    }

    #[test]
    fn test_ghost_key_releases_passthrough_output_and_cleans_modifier() {
        let _lock = state::TEST_LOCK.lock().unwrap();
        let mut config = crate::get_default_config();
        config.layers.clear();

        // A=10: base -> layer_a
        let mut base_bindings = std::collections::HashMap::new();
        base_bindings.insert(10, vec![crate::Binding {
            trigger: Trigger::Hold,
            action: Action::LayerMomentary { layer_id: "layer_a".to_string() },
            timing_ms: None,
            interrupt_behavior: Some(InterruptBehavior::ForceHold),
        }]);
        config.layers.push(crate::Layer {
            id: "base".to_string(),
            bindings: base_bindings,
            default_modifiers: None,
            passthrough_trigger_key: None,
            parent_layer_id: None,
        });

        // layer_a: LSHIFT(0xA0) -> Hold(layer_b), passthrough_trigger_key: true
        let mut layer_a_bindings = std::collections::HashMap::new();
        layer_a_bindings.insert(utils::VK_LSHIFT, vec![crate::Binding {
            trigger: Trigger::Hold,
            action: Action::LayerMomentary { layer_id: "layer_b".to_string() },
            timing_ms: None,
            interrupt_behavior: Some(InterruptBehavior::ForceHold),
        }]);
        config.layers.push(crate::Layer {
            id: "layer_a".to_string(),
            bindings: layer_a_bindings,
            default_modifiers: None,
            passthrough_trigger_key: None,
            parent_layer_id: None,
        });

        config.layers.push(crate::Layer {
            id: "layer_b".to_string(),
            bindings: std::collections::HashMap::new(),
            default_modifiers: None,
            passthrough_trigger_key: Some(true),
            parent_layer_id: None,
        });

        // 状態初期化
        {
            let mut state = get_state().lock().unwrap();
            state.active_layers = vec!["base".to_string()];
            state.key_states.clear();
            state.momentary_layers.clear();
            state.momentary_keys.clear();
            state.ghost_keys.clear();
            state.physically_pressed_modifiers.clear();
            utils::TEST_SENT_KEYS.lock().unwrap().clear();
        }

        // 1. A(10) 押下 -> Shift(0xA0) 押下 -> ダミー(30)押下で Shift が PassthroughHoldActive に確定
        let _ = KeyProcessor::process_key(10, true, &config);
        let _ = KeyProcessor::process_key(utils::VK_LSHIFT, true, &config);
        let _ = KeyProcessor::process_key(30, true, &config);

        assert!(get_state().lock().unwrap().physically_pressed_modifiers.contains(&utils::VK_LSHIFT));
        utils::TEST_SENT_KEYS.lock().unwrap().clear();

        // 2. 親キー A(10) をリリース！
        // Shift は Base ではモーメンタリ設定を持たないため、ゴーストキーに移行する
        let _ = KeyProcessor::process_key(10, false, &config);

        // 検証1: 透過中だった Shift の KeyUp (is_up: true) が直ちに送信されていること！
        let sent = utils::TEST_SENT_KEYS.lock().unwrap().clone();
        assert!(
            sent.iter().any(|&(vk, is_up)| vk == utils::VK_LSHIFT && is_up),
            "Shift KeyUp must be sent when passthrough key is ghosted!"
        );

        // 検証2: physically_pressed_modifiers から Shift が削除されていること！
        assert!(
            !get_state().lock().unwrap().physically_pressed_modifiers.contains(&utils::VK_LSHIFT),
            "Shift must be removed from physically_pressed_modifiers on ghost transition"
        );

        // 検証3: Shift のオートリピート KeyDown が来てもブロックされ、OS に送信されないこと！
        utils::TEST_SENT_KEYS.lock().unwrap().clear();
        let repeat_action = KeyProcessor::process_key(utils::VK_LSHIFT, true, &config);
        assert_eq!(repeat_action, HookAction::Block, "Repeat KeyDown for ghost key must be blocked");
        let sent_repeat = utils::TEST_SENT_KEYS.lock().unwrap().clone();
        assert!(sent_repeat.is_empty(), "No keys should be sent on ghost repeat");

        // 検証4: Shift を物理的に離したとき (KeyUp) もブロックされ、ゴーストキーが片付くこと！
        let up_action = KeyProcessor::process_key(utils::VK_LSHIFT, false, &config);
        assert_eq!(up_action, HookAction::Block, "Ghost KeyUp must be blocked");
        assert!(
            !get_state().lock().unwrap().ghost_keys.contains(&utils::VK_LSHIFT),
            "Ghost key must be cleared after physical release"
        );
    }

    #[test]
    fn test_ghost_key_does_not_resurrect_after_release() {
        let _lock = state::TEST_LOCK.lock().unwrap();
        let mut config = crate::get_default_config();
        config.layers.clear();

        // A=10: base -> layer_a
        let mut base_bindings = std::collections::HashMap::new();
        base_bindings.insert(10, vec![crate::Binding {
            trigger: Trigger::Hold,
            action: Action::LayerMomentary { layer_id: "layer_a".to_string() },
            timing_ms: None,
            interrupt_behavior: Some(InterruptBehavior::ForceHold),
        }]);
        config.layers.push(crate::Layer {
            id: "base".to_string(),
            bindings: base_bindings,
            default_modifiers: None,
            passthrough_trigger_key: None,
            parent_layer_id: None,
        });

        // layer_a: B=20 -> Hold(layer_b)
        let mut layer_a_bindings = std::collections::HashMap::new();
        layer_a_bindings.insert(20, vec![crate::Binding {
            trigger: Trigger::Hold,
            action: Action::LayerMomentary { layer_id: "layer_b".to_string() },
            timing_ms: None,
            interrupt_behavior: Some(InterruptBehavior::ForceHold),
        }]);
        config.layers.push(crate::Layer {
            id: "layer_a".to_string(),
            bindings: layer_a_bindings,
            default_modifiers: None,
            passthrough_trigger_key: None,
            parent_layer_id: None,
        });

        config.layers.push(crate::Layer {
            id: "layer_b".to_string(),
            bindings: std::collections::HashMap::new(),
            default_modifiers: None,
            passthrough_trigger_key: None,
            parent_layer_id: None,
        });

        // 状態初期化
        {
            let mut state = get_state().lock().unwrap();
            state.active_layers = vec!["base".to_string()];
            state.key_states.clear();
            state.momentary_layers.clear();
            state.momentary_keys.clear();
            state.ghost_keys.clear();
        }

        // 1. A(10) 押下 -> B(20) 押下 -> ダミー(30)押下で B 確定
        let _ = KeyProcessor::process_key(10, true, &config);
        let _ = KeyProcessor::process_key(20, true, &config);
        let _ = KeyProcessor::process_key(30, true, &config);

        // 2. A(10) をリリース -> B はゴースト化
        let _ = KeyProcessor::process_key(10, false, &config);
        assert!(get_state().lock().unwrap().ghost_keys.contains(&20));
        assert!(
            !get_state().lock().unwrap().momentary_keys.iter().any(|&(k, _)| k == 20),
            "Ghosted key 20 must be removed from momentary_keys immediately"
        );

        // 3. B(20) をリリース
        let _ = KeyProcessor::process_key(20, false, &config);
        assert!(!get_state().lock().unwrap().ghost_keys.contains(&20));

        // 4. 再度 A(10) を押下・リリース
        let _ = KeyProcessor::process_key(10, true, &config);
        let _ = KeyProcessor::process_key(10, false, &config);

        // B(20) がゴーストキーや momentary_keys に再出現していないこと！
        assert!(!get_state().lock().unwrap().ghost_keys.contains(&20));
        assert!(!get_state().lock().unwrap().momentary_keys.iter().any(|&(k, _)| k == 20));

        // 5. 通常キーとして B(20) を押下・リリースしたとき、KeyUp が Block されず PassThrough されること！
        let down_action = KeyProcessor::process_key(20, true, &config);
        assert_eq!(down_action, HookAction::PassThrough);
        let up_action = KeyProcessor::process_key(20, false, &config);
        assert_eq!(up_action, HookAction::PassThrough);
    }

    #[test]
    fn test_ghosting_passthrough_key_does_not_release_modifier_held_by_other_layer() {
        let _lock = state::TEST_LOCK.lock().unwrap();
        let mut config = crate::get_default_config();
        config.layers.clear();

        // 1. base:
        //    - 10 (A): Hold -> layer_a
        //    - 50 (X): Hold -> layer_x
        let mut base_bindings = std::collections::HashMap::new();
        base_bindings.insert(10, vec![crate::Binding {
            trigger: Trigger::Hold,
            action: Action::LayerMomentary { layer_id: "layer_a".to_string() },
            timing_ms: None,
            interrupt_behavior: Some(InterruptBehavior::ForceHold),
        }]);
        base_bindings.insert(50, vec![crate::Binding {
            trigger: Trigger::Hold,
            action: Action::LayerMomentary { layer_id: "layer_x".to_string() },
            timing_ms: None,
            interrupt_behavior: Some(InterruptBehavior::ForceHold),
        }]);
        config.layers.push(crate::Layer {
            id: "base".to_string(),
            bindings: base_bindings,
            default_modifiers: None,
            passthrough_trigger_key: None,
            parent_layer_id: None,
        });

        // 2. layer_x: default_modifiers: { shift: true }
        config.layers.push(crate::Layer {
            id: "layer_x".to_string(),
            bindings: std::collections::HashMap::new(),
            default_modifiers: Some(crate::model::ModifierOutput::new().with_shift(true)),
            passthrough_trigger_key: None,
            parent_layer_id: None,
        });

        // 3. layer_a: LSHIFT(0xA0) -> Hold(layer_b)
        let mut layer_a_bindings = std::collections::HashMap::new();
        layer_a_bindings.insert(utils::VK_LSHIFT, vec![crate::Binding {
            trigger: Trigger::Hold,
            action: Action::LayerMomentary { layer_id: "layer_b".to_string() },
            timing_ms: None,
            interrupt_behavior: Some(InterruptBehavior::ForceHold),
        }]);
        config.layers.push(crate::Layer {
            id: "layer_a".to_string(),
            bindings: layer_a_bindings,
            default_modifiers: None,
            passthrough_trigger_key: None,
            parent_layer_id: None,
        });

        // 4. layer_b: passthrough_trigger_key: true
        config.layers.push(crate::Layer {
            id: "layer_b".to_string(),
            bindings: std::collections::HashMap::new(),
            default_modifiers: None,
            passthrough_trigger_key: Some(true),
            parent_layer_id: None,
        });

        // 状態初期化
        {
            let mut state = get_state().lock().unwrap();
            state.active_layers = vec!["base".to_string()];
            state.key_states.clear();
            state.momentary_layers.clear();
            state.momentary_keys.clear();
            state.ghost_keys.clear();
            state.physically_pressed_modifiers.clear();
            utils::TEST_SENT_KEYS.lock().unwrap().clear();
        }

        // X(50) 押下 -> layer_x がアクティブになり Shift Down が送信される
        let _ = KeyProcessor::process_key(50, true, &config);
        let _ = KeyProcessor::process_key(999, true, &config); // 確定ダミー
        assert!(get_state().lock().unwrap().active_layers.contains(&"layer_x".to_string()));

        // A(10) 押下 -> layer_a がアクティブ
        let _ = KeyProcessor::process_key(10, true, &config);
        let _ = KeyProcessor::process_key(998, true, &config); // 確定ダミー

        // Shift(0xA0) 押下 -> layer_b がアクティブ (透過Shift)
        let _ = KeyProcessor::process_key(utils::VK_LSHIFT, true, &config);
        let _ = KeyProcessor::process_key(997, true, &config); // 確定ダミー
        assert!(matches!(
            get_state().lock().unwrap().key_states.get(&utils::VK_LSHIFT),
            Some(KeyState::PassthroughHoldActive { .. })
        ));

        // 送信ログをクリア
        utils::TEST_SENT_KEYS.lock().unwrap().clear();

        // A(10) を解放 (KeyUp)！
        // Shift は Base でモーメンタリ設定を持たないためゴースト化するが、
        // スタックには layer_x (shift: true) が残っている！
        let _ = KeyProcessor::process_key(10, false, &config);

        // ★ 検証: layer_x が残っているため、Shift Up が誤送信されていないこと！
        let sent = utils::TEST_SENT_KEYS.lock().unwrap().clone();
        let shift_up_sent = sent.iter().any(|&(vk, is_up)| (vk == utils::VK_SHIFT || vk == utils::VK_LSHIFT) && is_up);
        assert!(!shift_up_sent, "Shift Up must NOT be sent while layer_x still requires Shift! Sent: {:?}", sent);

        // クリーンアップ: ゴースト化した Shift(160) と X(50) を物理解放
        let _ = KeyProcessor::process_key(utils::VK_LSHIFT, false, &config);
        let _ = KeyProcessor::process_key(50, false, &config);
    }

    #[test]
    fn test_transition_from_passthrough_to_non_passthrough_releases_output_and_blocks_repeat() {
        let _lock = state::TEST_LOCK.lock().unwrap();
        let mut config = crate::get_default_config();
        config.layers.clear();

        // base: A(10) -> layer_a, Shift(0xA0) -> layer_base_shift (非透過: None)
        let mut base_bindings = std::collections::HashMap::new();
        base_bindings.insert(10, vec![crate::Binding {
            trigger: Trigger::Hold,
            action: Action::LayerMomentary { layer_id: "layer_a".to_string() },
            timing_ms: None,
            interrupt_behavior: Some(InterruptBehavior::ForceHold),
        }]);
        base_bindings.insert(utils::VK_LSHIFT, vec![crate::Binding {
            trigger: Trigger::Hold,
            action: Action::LayerMomentary { layer_id: "layer_base_shift".to_string() },
            timing_ms: None,
            interrupt_behavior: Some(InterruptBehavior::ForceHold),
        }]);
        config.layers.push(crate::Layer {
            id: "base".to_string(),
            bindings: base_bindings,
            default_modifiers: None,
            passthrough_trigger_key: None,
            parent_layer_id: None,
        });

        // layer_a: Shift(0xA0) -> layer_a_shift (透過: true)
        let mut layer_a_bindings = std::collections::HashMap::new();
        layer_a_bindings.insert(utils::VK_LSHIFT, vec![crate::Binding {
            trigger: Trigger::Hold,
            action: Action::LayerMomentary { layer_id: "layer_a_shift".to_string() },
            timing_ms: None,
            interrupt_behavior: Some(InterruptBehavior::ForceHold),
        }]);
        config.layers.push(crate::Layer {
            id: "layer_a".to_string(),
            bindings: layer_a_bindings,
            default_modifiers: None,
            passthrough_trigger_key: None,
            parent_layer_id: None,
        });

        config.layers.push(crate::Layer {
            id: "layer_a_shift".to_string(),
            bindings: std::collections::HashMap::new(),
            default_modifiers: None,
            passthrough_trigger_key: Some(true),
            parent_layer_id: None,
        });

        config.layers.push(crate::Layer {
            id: "layer_base_shift".to_string(),
            bindings: std::collections::HashMap::new(),
            default_modifiers: None,
            passthrough_trigger_key: None,
            parent_layer_id: None,
        });

        // 状態初期化
        {
            let mut state = get_state().lock().unwrap();
            state.active_layers = vec!["base".to_string()];
            state.key_states.clear();
            state.momentary_layers.clear();
            state.momentary_keys.clear();
            state.ghost_keys.clear();
            state.physically_pressed_modifiers.clear();
            utils::TEST_SENT_KEYS.lock().unwrap().clear();
        }

        // 1. A(10) 押下 -> Shift(0xA0) 押下 -> ダミー押下で Shift 確定 (透過)
        let _ = KeyProcessor::process_key(10, true, &config);
        let _ = KeyProcessor::process_key(utils::VK_LSHIFT, true, &config);
        let _ = KeyProcessor::process_key(999, true, &config);
        assert!(matches!(
            get_state().lock().unwrap().key_states.get(&utils::VK_LSHIFT),
            Some(KeyState::PassthroughHoldActive { .. })
        ));

        utils::TEST_SENT_KEYS.lock().unwrap().clear();

        // 2. A(10) を解放！Shift は Base の layer_base_shift (非透過) に移行
        let _ = KeyProcessor::process_key(10, false, &config);

        // ★ 検証1: 透過がオフになったため、OS へ Shift Up が送信されたこと！
        let sent = utils::TEST_SENT_KEYS.lock().unwrap().clone();
        let shift_up_sent = sent.iter().any(|&(vk, is_up)| (vk == utils::VK_SHIFT || vk == utils::VK_LSHIFT) && is_up);
        assert!(shift_up_sent, "Shift Up must be sent when transitioning to non-passthrough! Sent: {:?}", sent);

        // ★ 検証2: Shift の KeyState が HoldActive (非透過) に降格していること！
        assert!(matches!(
            get_state().lock().unwrap().key_states.get(&utils::VK_LSHIFT),
            Some(KeyState::HoldActive { .. })
        ));

        // ★ 検証3: Shift のリピート KeyDown が来ても Block されること！
        utils::TEST_SENT_KEYS.lock().unwrap().clear();
        let repeat_action = KeyProcessor::process_key(utils::VK_LSHIFT, true, &config);
        assert_eq!(repeat_action, HookAction::Block);
        let sent_repeat = utils::TEST_SENT_KEYS.lock().unwrap().clone();
        assert!(sent_repeat.is_empty(), "No keys should be sent on non-passthrough repeat");

        // クリーンアップ: Shift を物理解放
        let _ = KeyProcessor::process_key(utils::VK_LSHIFT, false, &config);
    }

    #[test]
    fn test_transition_from_non_passthrough_to_passthrough_sends_required_keydown() {
        let _lock = state::TEST_LOCK.lock().unwrap();
        let mut config = crate::get_default_config();
        config.layers.clear();

        // base: A(10) -> layer_a, Shift(0xA0) -> layer_base_shift (透過: true)
        let mut base_bindings = std::collections::HashMap::new();
        base_bindings.insert(10, vec![crate::Binding {
            trigger: Trigger::Hold,
            action: Action::LayerMomentary { layer_id: "layer_a".to_string() },
            timing_ms: None,
            interrupt_behavior: Some(InterruptBehavior::ForceHold),
        }]);
        base_bindings.insert(utils::VK_LSHIFT, vec![crate::Binding {
            trigger: Trigger::Hold,
            action: Action::LayerMomentary { layer_id: "layer_base_shift".to_string() },
            timing_ms: None,
            interrupt_behavior: Some(InterruptBehavior::ForceHold),
        }]);
        config.layers.push(crate::Layer {
            id: "base".to_string(),
            bindings: base_bindings,
            default_modifiers: None,
            passthrough_trigger_key: None,
            parent_layer_id: None,
        });

        // layer_a: Shift(0xA0) -> layer_a_shift (非透過: None)
        let mut layer_a_bindings = std::collections::HashMap::new();
        layer_a_bindings.insert(utils::VK_LSHIFT, vec![crate::Binding {
            trigger: Trigger::Hold,
            action: Action::LayerMomentary { layer_id: "layer_a_shift".to_string() },
            timing_ms: None,
            interrupt_behavior: Some(InterruptBehavior::ForceHold),
        }]);
        config.layers.push(crate::Layer {
            id: "layer_a".to_string(),
            bindings: layer_a_bindings,
            default_modifiers: None,
            passthrough_trigger_key: None,
            parent_layer_id: None,
        });

        config.layers.push(crate::Layer {
            id: "layer_a_shift".to_string(),
            bindings: std::collections::HashMap::new(),
            default_modifiers: None,
            passthrough_trigger_key: None,
            parent_layer_id: None,
        });

        config.layers.push(crate::Layer {
            id: "layer_base_shift".to_string(),
            bindings: std::collections::HashMap::new(),
            default_modifiers: None,
            passthrough_trigger_key: Some(true),
            parent_layer_id: None,
        });

        // 状態初期化
        {
            let mut state = get_state().lock().unwrap();
            state.active_layers = vec!["base".to_string()];
            state.key_states.clear();
            state.momentary_layers.clear();
            state.momentary_keys.clear();
            state.ghost_keys.clear();
            state.physically_pressed_modifiers.clear();
            utils::TEST_SENT_KEYS.lock().unwrap().clear();
        }

        // 1. A(10) 押下 -> Shift(0xA0) 押下 -> ダミー押下で Shift 確定 (非透過)
        let _ = KeyProcessor::process_key(10, true, &config);
        let _ = KeyProcessor::process_key(utils::VK_LSHIFT, true, &config);
        let _ = KeyProcessor::process_key(999, true, &config);
        assert!(matches!(
            get_state().lock().unwrap().key_states.get(&utils::VK_LSHIFT),
            Some(KeyState::HoldActive { .. })
        ));

        // 送信ログクリア (非透過なので Shift Down は送られていない)
        utils::TEST_SENT_KEYS.lock().unwrap().clear();

        // 2. A(10) を解放！Shift は Base の layer_base_shift (透過) に移行
        let _ = KeyProcessor::process_key(10, false, &config);

        // ★ 検証1: 透過になったため、OS へ Shift Down (is_up: false) が送信されたこと！
        let sent = utils::TEST_SENT_KEYS.lock().unwrap().clone();
        let shift_down_sent = sent.iter().any(|&(vk, is_up)| (vk == utils::VK_SHIFT || vk == utils::VK_LSHIFT) && !is_up);
        assert!(shift_down_sent, "Shift Down must be sent when transitioning to passthrough! Sent: {:?}", sent);

        // ★ 検証2: Shift の KeyState が PassthroughHoldActive に昇格していること！
        assert!(matches!(
            get_state().lock().unwrap().key_states.get(&utils::VK_LSHIFT),
            Some(KeyState::PassthroughHoldActive { .. })
        ));

        // 3. Shift を物理リリース
        utils::TEST_SENT_KEYS.lock().unwrap().clear();
        let up_action = KeyProcessor::process_key(utils::VK_LSHIFT, false, &config);
        assert_eq!(up_action, HookAction::PassThrough);
    }

    #[test]
    fn test_plain_physical_modifier_not_released_when_layer_modifier_deactivated() {
        let _lock = state::TEST_LOCK.lock().unwrap();
        let mut config = crate::get_default_config();
        config.layers.clear();

        // base: A(10) -> layer_ctrl
        let mut base_bindings = std::collections::HashMap::new();
        base_bindings.insert(10, vec![crate::Binding {
            trigger: Trigger::Hold,
            action: Action::LayerMomentary { layer_id: "layer_ctrl".to_string() },
            timing_ms: None,
            interrupt_behavior: Some(InterruptBehavior::ForceHold),
        }]);
        config.layers.push(crate::Layer {
            id: "base".to_string(),
            bindings: base_bindings,
            default_modifiers: None,
            passthrough_trigger_key: None,
            parent_layer_id: None,
        });

        // layer_ctrl: default_modifiers: { ctrl: true }
        config.layers.push(crate::Layer {
            id: "layer_ctrl".to_string(),
            bindings: std::collections::HashMap::new(),
            default_modifiers: Some(crate::model::ModifierOutput::new().with_ctrl(true)),
            passthrough_trigger_key: None,
            parent_layer_id: None,
        });

        // 状態初期化
        {
            let mut state = get_state().lock().unwrap();
            state.active_layers = vec!["base".to_string()];
            state.key_states.clear();
            state.momentary_layers.clear();
            state.momentary_keys.clear();
            state.ghost_keys.clear();
            state.physically_pressed_modifiers.clear();
            utils::TEST_SENT_KEYS.lock().unwrap().clear();
        }

        // 1. 通常の物理 LCONTROL(162) を押下 (素通し)
        let a1 = KeyProcessor::process_key(utils::VK_LCONTROL, true, &config);
        assert_eq!(a1, HookAction::PassThrough);
        assert!(get_state().lock().unwrap().physically_pressed_modifiers.contains(&utils::VK_LCONTROL));

        // 2. A(10) 押下 -> layer_ctrl 有効化
        let _ = KeyProcessor::process_key(10, true, &config);
        let _ = KeyProcessor::process_key(999, true, &config); // 確定
        assert!(get_state().lock().unwrap().active_layers.contains(&"layer_ctrl".to_string()));

        // 送信履歴クリア
        utils::TEST_SENT_KEYS.lock().unwrap().clear();

        // 3. A(10) を解放 (KeyUp)！ layer_ctrl が外れる
        let _ = KeyProcessor::process_key(10, false, &config);

        // ★ 検証: ユーザーは物理 Ctrl を押し続けているので、Ctrl Up は誤送信されないこと！
        let sent = utils::TEST_SENT_KEYS.lock().unwrap().clone();
        let ctrl_up_sent = sent.iter().any(|&(vk, is_up)| (vk == utils::VK_CONTROL || vk == utils::VK_LCONTROL || vk == utils::VK_RCONTROL) && is_up);
        assert!(!ctrl_up_sent, "Ctrl Up must NOT be sent while plain physical Ctrl is held! Sent: {:?}", sent);

        // クリーンアップ: 物理 Ctrl を離す
        let _ = KeyProcessor::process_key(utils::VK_LCONTROL, false, &config);
    }

    #[test]
    fn test_ghosting_right_shift_releases_right_shift_while_preserving_left_shift_of_other_layer() {
        let _lock = state::TEST_LOCK.lock().unwrap();
        let mut config = crate::get_default_config();
        config.layers.clear();

        // 1. base:
        //    - 10 (A): Hold -> layer_a
        //    - 50 (X): Hold -> layer_x
        let mut base_bindings = std::collections::HashMap::new();
        base_bindings.insert(10, vec![crate::Binding {
            trigger: Trigger::Hold,
            action: Action::LayerMomentary { layer_id: "layer_a".to_string() },
            timing_ms: None,
            interrupt_behavior: Some(InterruptBehavior::ForceHold),
        }]);
        base_bindings.insert(50, vec![crate::Binding {
            trigger: Trigger::Hold,
            action: Action::LayerMomentary { layer_id: "layer_x".to_string() },
            timing_ms: None,
            interrupt_behavior: Some(InterruptBehavior::ForceHold),
        }]);
        config.layers.push(crate::Layer {
            id: "base".to_string(),
            bindings: base_bindings,
            default_modifiers: None,
            passthrough_trigger_key: None,
            parent_layer_id: None,
        });

        // 2. layer_x: default_modifiers: { shift: true } (VK_LSHIFT を要求)
        config.layers.push(crate::Layer {
            id: "layer_x".to_string(),
            bindings: std::collections::HashMap::new(),
            default_modifiers: Some(crate::model::ModifierOutput::new().with_shift(true)),
            passthrough_trigger_key: None,
            parent_layer_id: None,
        });

        // 3. layer_a: RSHIFT(0xA1) -> Hold(layer_b)
        let mut layer_a_bindings = std::collections::HashMap::new();
        layer_a_bindings.insert(utils::VK_RSHIFT, vec![crate::Binding {
            trigger: Trigger::Hold,
            action: Action::LayerMomentary { layer_id: "layer_b".to_string() },
            timing_ms: None,
            interrupt_behavior: Some(InterruptBehavior::ForceHold),
        }]);
        config.layers.push(crate::Layer {
            id: "layer_a".to_string(),
            bindings: layer_a_bindings,
            default_modifiers: None,
            passthrough_trigger_key: None,
            parent_layer_id: None,
        });

        // 4. layer_b: passthrough_trigger_key: true
        config.layers.push(crate::Layer {
            id: "layer_b".to_string(),
            bindings: std::collections::HashMap::new(),
            default_modifiers: None,
            passthrough_trigger_key: Some(true),
            parent_layer_id: None,
        });

        // 状態初期化
        {
            let mut state = get_state().lock().unwrap();
            state.active_layers = vec!["base".to_string()];
            state.key_states.clear();
            state.momentary_layers.clear();
            state.momentary_keys.clear();
            state.ghost_keys.clear();
            state.physically_pressed_modifiers.clear();
            utils::TEST_SENT_KEYS.lock().unwrap().clear();
        }

        // X(50) 押下 -> layer_x 有効化 (VK_LSHIFT Down 送信)
        let _ = KeyProcessor::process_key(50, true, &config);
        let _ = KeyProcessor::process_key(999, true, &config);
        assert!(get_state().lock().unwrap().active_layers.contains(&"layer_x".to_string()));

        // A(10) 押下 -> layer_a 有効化
        let _ = KeyProcessor::process_key(10, true, &config);
        let _ = KeyProcessor::process_key(998, true, &config);

        // 右Shift(VK_RSHIFT 161) 押下 -> layer_b 有効化 (透過)
        let _ = KeyProcessor::process_key(utils::VK_RSHIFT, true, &config);
        let _ = KeyProcessor::process_key(997, true, &config);
        assert!(matches!(
            get_state().lock().unwrap().key_states.get(&utils::VK_RSHIFT),
            Some(KeyState::PassthroughHoldActive { .. })
        ));

        // 送信履歴クリア
        utils::TEST_SENT_KEYS.lock().unwrap().clear();

        // A(10) を解放 (KeyUp)！
        // 右Shift はゴースト化される
        let _ = KeyProcessor::process_key(10, false, &config);

        // ★ 検証1: ゴースト化した VK_RSHIFT (161) の KeyUp が直ちに送信されていること！
        let sent = utils::TEST_SENT_KEYS.lock().unwrap().clone();
        let rshift_up_sent = sent.iter().any(|&(vk, is_up)| vk == utils::VK_RSHIFT && is_up);
        assert!(rshift_up_sent, "VK_RSHIFT Up must be sent immediately when right shift is ghosted! Sent: {:?}", sent);

        // ★ 検証2: 一方で layer_x が要求する VK_LSHIFT の KeyUp は送信されていないこと！
        let lshift_up_sent = sent.iter().any(|&(vk, is_up)| (vk == utils::VK_LSHIFT || vk == utils::VK_SHIFT) && is_up);
        assert!(!lshift_up_sent, "VK_LSHIFT Up must NOT be sent because layer_x still requires shift! Sent: {:?}", sent);

        // 送信履歴クリア
        utils::TEST_SENT_KEYS.lock().unwrap().clear();

        // 右Shift を物理リリース (ゴーストなので Block)
        let up_action = KeyProcessor::process_key(utils::VK_RSHIFT, false, &config);
        assert_eq!(up_action, HookAction::Block);

        // X(50) を解放 (KeyUp)！
        // layer_x が外れるため、ここで VK_LSHIFT Up が送信されること！
        let _ = KeyProcessor::process_key(50, false, &config);
        let sent_x = utils::TEST_SENT_KEYS.lock().unwrap().clone();
        let final_lshift_up = sent_x.iter().any(|&(vk, is_up)| (vk == utils::VK_LSHIFT || vk == utils::VK_SHIFT) && is_up);
        assert!(final_lshift_up, "VK_LSHIFT Up must be sent when layer_x is finally released! Sent: {:?}", sent_x);
    }

    #[test]
    fn test_ghosting_right_shift_hands_over_to_active_layer_shift_modifier() {
        let _lock = crate::key_processor::state::TEST_LOCK.lock().unwrap();

        let mut config = crate::get_default_config();
        config.layers.clear();

        // 1. base:
        //    - 10('A') -> Hold(layer_a)
        //    - 50('X') -> Hold(layer_x)
        let mut base_bindings = std::collections::HashMap::new();
        base_bindings.insert(10, vec![crate::Binding {
            trigger: Trigger::Hold,
            action: Action::LayerMomentary { layer_id: "layer_a".to_string() },
            timing_ms: None,
            interrupt_behavior: Some(InterruptBehavior::ForceHold),
        }]);
        base_bindings.insert(50, vec![crate::Binding {
            trigger: Trigger::Hold,
            action: Action::LayerMomentary { layer_id: "layer_x".to_string() },
            timing_ms: None,
            interrupt_behavior: Some(InterruptBehavior::ForceHold),
        }]);
        config.layers.push(crate::Layer {
            id: "base".to_string(),
            bindings: base_bindings,
            default_modifiers: None,
            passthrough_trigger_key: None,
            parent_layer_id: None,
        });

        // 2. layer_x: defaultModifiers: { shift: true }
        config.layers.push(crate::Layer {
            id: "layer_x".to_string(),
            bindings: std::collections::HashMap::new(),
            default_modifiers: Some(crate::model::ModifierOutput::new().with_shift(true)),
            passthrough_trigger_key: None,
            parent_layer_id: None,
        });

        // 3. layer_a: RSHIFT(161) -> Hold(layer_b)
        let mut layer_a_bindings = std::collections::HashMap::new();
        layer_a_bindings.insert(utils::VK_RSHIFT, vec![crate::Binding {
            trigger: Trigger::Hold,
            action: Action::LayerMomentary { layer_id: "layer_b".to_string() },
            timing_ms: None,
            interrupt_behavior: Some(InterruptBehavior::ForceHold),
        }]);
        config.layers.push(crate::Layer {
            id: "layer_a".to_string(),
            bindings: layer_a_bindings,
            default_modifiers: None,
            passthrough_trigger_key: None,
            parent_layer_id: None,
        });

        // 4. layer_b: passthrough_trigger_key: true
        config.layers.push(crate::Layer {
            id: "layer_b".to_string(),
            bindings: std::collections::HashMap::new(),
            default_modifiers: None,
            passthrough_trigger_key: Some(true),
            parent_layer_id: None,
        });

        // 状態初期化
        {
            let mut state = get_state().lock().unwrap();
            state.active_layers = vec!["base".to_string()];
            state.key_states.clear();
            state.momentary_layers.clear();
            state.momentary_keys.clear();
            state.ghost_keys.clear();
            state.physically_pressed_modifiers.clear();
            state.active_layer_modifiers.clear();
            utils::TEST_SENT_KEYS.lock().unwrap().clear();
        }

        // 1. A(10) 押下 -> layer_a 有効化
        let _ = KeyProcessor::process_key(10, true, &config);
        let _ = KeyProcessor::process_key(999, true, &config); // 確定

        // 2. 右Shift(161) 押下 -> layer_b 有効化 (透過モーメンタリ)
        let _ = KeyProcessor::process_key(utils::VK_RSHIFT, true, &config);
        let _ = KeyProcessor::process_key(998, true, &config); // 確定
        assert!(matches!(
            get_state().lock().unwrap().key_states.get(&utils::VK_RSHIFT),
            Some(KeyState::PassthroughHoldActive { .. })
        ));

        // 送信履歴クリア
        utils::TEST_SENT_KEYS.lock().unwrap().clear();

        // 3. X(50) 押下 -> layer_x 有効化 (defaultModifiers: { shift: true })
        // ★重要: 右Shiftが既に透過中なので、余計な VK_LSHIFT Down の二重送信が抑制されていること！
        let _ = KeyProcessor::process_key(50, true, &config);
        let _ = KeyProcessor::process_key(997, true, &config); // 確定
        let sent_during_x = utils::TEST_SENT_KEYS.lock().unwrap().clone();
        assert!(sent_during_x.is_empty(), "VK_LSHIFT Down should NOT be sent because VK_RSHIFT is already active! Sent: {:?}", sent_during_x);

        // 送信履歴クリア
        utils::TEST_SENT_KEYS.lock().unwrap().clear();


        // 4. A(10) を解放 (KeyUp)！
        // layer_a が外れ、右Shift はゴースト化される。
        let _ = KeyProcessor::process_key(10, false, &config);

        // ★★★ コア検証 ★★★
        // 1. ゴースト化した VK_RSHIFT (161) の Up が送信されていること！
        // 2. layer_x (shift: true) が残っているため、VK_LSHIFT (160) Down が直ちに補填・引き継ぎ送信されていること！
        let sent_during_a_rel = utils::TEST_SENT_KEYS.lock().unwrap().clone();
        let rshift_up = sent_during_a_rel.iter().any(|&(vk, is_up)| vk == utils::VK_RSHIFT && is_up);
        let lshift_down = sent_during_a_rel.iter().any(|&(vk, is_up)| vk == utils::VK_LSHIFT && !is_up);
        assert!(rshift_up, "VK_RSHIFT Up must be sent when right shift is ghosted! Sent: {:?}", sent_during_a_rel);
        assert!(lshift_down, "VK_LSHIFT Down must be sent to handover modifier output to layer_x! Sent: {:?}", sent_during_a_rel);
        assert!(get_state().lock().unwrap().active_layer_modifiers.contains(&utils::VK_LSHIFT));

        // 送信履歴クリア
        utils::TEST_SENT_KEYS.lock().unwrap().clear();

        // 5. 右Shift を物理リリース (ゴーストなので Block)
        let up_action = KeyProcessor::process_key(utils::VK_RSHIFT, false, &config);
        assert_eq!(up_action, HookAction::Block);
        let sent_during_rshift_rel = utils::TEST_SENT_KEYS.lock().unwrap().clone();
        assert!(sent_during_rshift_rel.is_empty(), "No keys should be sent on ghost release! Sent: {:?}", sent_during_rshift_rel);

        // 送信履歴クリア
        utils::TEST_SENT_KEYS.lock().unwrap().clear();

        // 6. X(50) を解放 (KeyUp)！
        // layer_x が外れるため、引き継がれていた VK_LSHIFT Up が送信されること！
        let _ = KeyProcessor::process_key(50, false, &config);
        let sent_during_x_rel = utils::TEST_SENT_KEYS.lock().unwrap().clone();
        let final_lshift_up = sent_during_x_rel.iter().any(|&(vk, is_up)| (vk == utils::VK_LSHIFT || vk == utils::VK_SHIFT) && is_up);
        assert!(final_lshift_up, "VK_LSHIFT Up must be sent when layer_x is finally released! Sent: {:?}", sent_during_x_rel);
        assert!(get_state().lock().unwrap().active_layer_modifiers.is_empty());
    }

    #[test]
    fn test_layer_toggle_base_preserves_rollover_re_evaluation() {
        let _lock = crate::key_processor::state::TEST_LOCK.lock().unwrap();
        let mut config = crate::get_default_config();
        config.layers.clear();
        config.layer_order = vec![
            "base".to_string(),
            "game".to_string(),
            "game_momentary1".to_string(),
            "game_momentary2".to_string(),
            "game_combo".to_string(),
        ];

        // 1. base: 10(A) -> LayerToggle("game")
        let mut base_bindings = std::collections::HashMap::new();
        base_bindings.insert(10, vec![crate::Binding {
            trigger: Trigger::Tap,
            action: Action::LayerToggle { layer_id: "game".to_string() },
            timing_ms: None,
            interrupt_behavior: None,
        }]);
        config.layers.push(crate::Layer {
            id: "base".to_string(),
            bindings: base_bindings,
            default_modifiers: None,
            passthrough_trigger_key: None,
            parent_layer_id: None,
        });

        // 2. game:
        //    - 10(A) -> LayerToggle("game") (トグルバック用)
        //    - 20(B) -> Hold(game_momentary1)
        //    - 30(C) -> Hold(game_momentary2)
        let mut game_bindings = std::collections::HashMap::new();
        game_bindings.insert(10, vec![crate::Binding {
            trigger: Trigger::Tap,
            action: Action::LayerToggle { layer_id: "game".to_string() },
            timing_ms: None,
            interrupt_behavior: None,
        }]);
        game_bindings.insert(20, vec![crate::Binding {
            trigger: Trigger::Hold,
            action: Action::LayerMomentary { layer_id: "game_momentary1".to_string() },
            timing_ms: None,
            interrupt_behavior: Some(InterruptBehavior::ForceHold),
        }]);
        game_bindings.insert(30, vec![crate::Binding {
            trigger: Trigger::Hold,
            action: Action::LayerMomentary { layer_id: "game_momentary2".to_string() },
            timing_ms: None,
            interrupt_behavior: Some(InterruptBehavior::ForceHold),
        }]);
        config.layers.push(crate::Layer {
            id: "game".to_string(),
            bindings: game_bindings,
            default_modifiers: None,
            passthrough_trigger_key: None,
            parent_layer_id: None,
        });

        // 3. game_momentary1:
        //    - 30(C) -> Hold(game_combo)
        let mut gm1_bindings = std::collections::HashMap::new();
        gm1_bindings.insert(30, vec![crate::Binding {
            trigger: Trigger::Hold,
            action: Action::LayerMomentary { layer_id: "game_combo".to_string() },
            timing_ms: None,
            interrupt_behavior: Some(InterruptBehavior::ForceHold),
        }]);
        config.layers.push(crate::Layer {
            id: "game_momentary1".to_string(),
            bindings: gm1_bindings,
            default_modifiers: None,
            passthrough_trigger_key: None,
            parent_layer_id: None,
        });

        // 4. game_momentary2
        config.layers.push(crate::Layer {
            id: "game_momentary2".to_string(),
            bindings: std::collections::HashMap::new(),
            default_modifiers: None,
            passthrough_trigger_key: None,
            parent_layer_id: None,
        });

        // 5. game_combo
        config.layers.push(crate::Layer {
            id: "game_combo".to_string(),
            bindings: std::collections::HashMap::new(),
            default_modifiers: None,
            passthrough_trigger_key: None,
            parent_layer_id: None,
        });

        // 状態初期化
        {
            let mut state = get_state().lock().unwrap();
            state.active_layers = vec!["base".to_string()];
            state.key_states.clear();
            state.momentary_layers.clear();
            state.momentary_keys.clear();
            state.ghost_keys.clear();
            state.physically_pressed_modifiers.clear();
            state.active_layer_modifiers.clear();
            utils::TEST_SENT_KEYS.lock().unwrap().clear();
        }

        // 1. 10(A) をタップして基底を "game" に切り替え
        let _ = KeyProcessor::process_key(10, true, &config);
        let _ = KeyProcessor::process_key(10, false, &config);
        assert_eq!(get_state().lock().unwrap().active_layers, vec!["game".to_string()]);

        // 2. 20(B) 押下 -> game_momentary1 へ
        let _ = KeyProcessor::process_key(20, true, &config);
        let _ = KeyProcessor::process_key(999, true, &config); // 確定ダミー
        assert_eq!(get_state().lock().unwrap().active_layers, vec!["game".to_string(), "game_momentary1".to_string()]);

        // 3. 30(C) 押下 -> game_combo へ
        let _ = KeyProcessor::process_key(30, true, &config);
        let _ = KeyProcessor::process_key(998, true, &config); // 確定ダミー
        assert_eq!(
            get_state().lock().unwrap().active_layers,
            vec!["game".to_string(), "game_momentary1".to_string(), "game_combo".to_string()]
        );

        // 4. 20(B) を解放 (KeyUp)！
        // ★重要: 基底 "game" が維持され、残った 30(C) が "game" 上で再評価されて game_momentary2 に再同期すること！
        let _ = KeyProcessor::process_key(20, false, &config);
        let active = get_state().lock().unwrap().active_layers.clone();
        assert_eq!(active, vec!["game".to_string(), "game_momentary2".to_string()]);

        // 5. 30(C) を解放 (KeyUp) -> 基底 "game" に戻る
        let _ = KeyProcessor::process_key(30, false, &config);
        assert_eq!(get_state().lock().unwrap().active_layers, vec!["game".to_string()]);

        // 6. 再度 10(A) をタップして基底を "base" にトグルバック
        let _ = KeyProcessor::process_key(10, true, &config);
        let _ = KeyProcessor::process_key(10, false, &config);
        assert_eq!(get_state().lock().unwrap().active_layers, vec!["base".to_string()]);
    }

    #[test]
    fn test_passthrough_and_layer_modifier_same_keycode_zero_chattering_handover() {
        let _lock = crate::key_processor::state::TEST_LOCK.lock().unwrap();
        let mut config = crate::get_default_config();
        config.layers.clear();

        // 1. base:
        //    - 10('A') -> Hold(layer_a)
        //    - 50('X') -> Hold(layer_shift)
        let mut base_bindings = std::collections::HashMap::new();
        base_bindings.insert(10, vec![crate::Binding {
            trigger: Trigger::Hold,
            action: Action::LayerMomentary { layer_id: "layer_a".to_string() },
            timing_ms: None,
            interrupt_behavior: Some(InterruptBehavior::ForceHold),
        }]);
        base_bindings.insert(50, vec![crate::Binding {
            trigger: Trigger::Hold,
            action: Action::LayerMomentary { layer_id: "layer_shift".to_string() },
            timing_ms: None,
            interrupt_behavior: Some(InterruptBehavior::ForceHold),
        }]);
        config.layers.push(crate::Layer {
            id: "base".to_string(),
            bindings: base_bindings,
            default_modifiers: None,
            passthrough_trigger_key: None,
            parent_layer_id: None,
        });

        // 2. layer_shift: defaultModifiers: { shift: true } (VK_LSHIFT を要求)
        config.layers.push(crate::Layer {
            id: "layer_shift".to_string(),
            bindings: std::collections::HashMap::new(),
            default_modifiers: Some(crate::model::ModifierOutput::new().with_shift(true)),
            passthrough_trigger_key: None,
            parent_layer_id: None,
        });

        // 3. layer_a: LSHIFT(160) -> Hold(layer_b)
        let mut layer_a_bindings = std::collections::HashMap::new();
        layer_a_bindings.insert(utils::VK_LSHIFT, vec![crate::Binding {
            trigger: Trigger::Hold,
            action: Action::LayerMomentary { layer_id: "layer_b".to_string() },
            timing_ms: None,
            interrupt_behavior: Some(InterruptBehavior::ForceHold),
        }]);
        config.layers.push(crate::Layer {
            id: "layer_a".to_string(),
            bindings: layer_a_bindings,
            default_modifiers: None,
            passthrough_trigger_key: None,
            parent_layer_id: None,
        });

        // 4. layer_b: passthrough_trigger_key: true
        config.layers.push(crate::Layer {
            id: "layer_b".to_string(),
            bindings: std::collections::HashMap::new(),
            default_modifiers: None,
            passthrough_trigger_key: Some(true),
            parent_layer_id: None,
        });

        // 状態初期化
        {
            let mut state = get_state().lock().unwrap();
            state.active_layers = vec!["base".to_string()];
            state.key_states.clear();
            state.momentary_layers.clear();
            state.momentary_keys.clear();
            state.ghost_keys.clear();
            state.physically_pressed_modifiers.clear();
            state.active_layer_modifiers.clear();
            utils::TEST_SENT_KEYS.lock().unwrap().clear();
        }

        // 1. X(50) 押下 -> layer_shift 有効化 (VK_LSHIFT Down が送信され active_layer_modifiers に登録)
        let _ = KeyProcessor::process_key(50, true, &config);
        let _ = KeyProcessor::process_key(999, true, &config); // 確定
        assert!(get_state().lock().unwrap().active_layer_modifiers.contains(&utils::VK_LSHIFT));

        // 2. A(10) 押下 -> layer_a 有効化
        let _ = KeyProcessor::process_key(10, true, &config);
        let _ = KeyProcessor::process_key(998, true, &config);

        // 3. 左Shift(VK_LSHIFT 160) 押下 -> layer_b 有効化 (透過モーメンタリ)
        // 既に layer_shift により VK_LSHIFT が Down されているため、重複送信は抑制される
        let _ = KeyProcessor::process_key(utils::VK_LSHIFT, true, &config);
        let _ = KeyProcessor::process_key(997, true, &config);
        assert!(matches!(
            get_state().lock().unwrap().key_states.get(&utils::VK_LSHIFT),
            Some(KeyState::PassthroughHoldActive { .. })
        ));

        // 送信履歴クリア
        utils::TEST_SENT_KEYS.lock().unwrap().clear();

        // 4. A(10) を解放 (KeyUp)！
        // layer_a が外れ、VK_LSHIFT は Base に Hold がないためゴースト化。
        // ★重要: layer_shift (shift: true) が残っているため、ゴースト化した物理透過 VK_LSHIFT は
        // 同一キーコードのレイヤー修飾キーとしてそのまま active_layer_modifiers に引き継がれる。
        // したがって、KeyUp も KeyDown も 1 回も送信されず、チャタリングが完全にゼロであること！
        let _ = KeyProcessor::process_key(10, false, &config);

        let sent_during_a_rel = utils::TEST_SENT_KEYS.lock().unwrap().clone();
        assert!(
            sent_during_a_rel.is_empty(),
            "No KeyUp or KeyDown should be sent during identical keycode handover! Sent: {:?}",
            sent_during_a_rel
        );
        assert!(get_state().lock().unwrap().active_layer_modifiers.contains(&utils::VK_LSHIFT));
        assert!(get_state().lock().unwrap().ghost_keys.contains(&utils::VK_LSHIFT));

        // 5. 左Shift(160) を物理リリース (ゴーストなので Block され、OS へキー送信なし)
        utils::TEST_SENT_KEYS.lock().unwrap().clear();
        let up_action = KeyProcessor::process_key(utils::VK_LSHIFT, false, &config);
        assert_eq!(up_action, HookAction::Block);
        let sent_during_shift_rel = utils::TEST_SENT_KEYS.lock().unwrap().clone();
        assert!(sent_during_shift_rel.is_empty(), "No keys should be sent on ghost release");

        // 6. X(50) を解放 (KeyUp)！
        // layer_shift が外れるため、ここでようやく VK_LSHIFT Up が送信されること！
        utils::TEST_SENT_KEYS.lock().unwrap().clear();
        let _ = KeyProcessor::process_key(50, false, &config);
        let sent_during_x_rel = utils::TEST_SENT_KEYS.lock().unwrap().clone();
        let final_lshift_up = sent_during_x_rel.iter().any(|&(vk, is_up)| (vk == utils::VK_LSHIFT || vk == utils::VK_SHIFT) && is_up);
        assert!(final_lshift_up, "VK_LSHIFT Up must be sent when layer_shift is released! Sent: {:?}", sent_during_x_rel);
        assert!(get_state().lock().unwrap().active_layer_modifiers.is_empty());
    }

    #[test]
    fn test_three_level_nesting_parent_release_multi_ghosting() {
        let _lock = crate::key_processor::state::TEST_LOCK.lock().unwrap();
        let mut config = crate::get_default_config();
        config.layers.clear();

        // base: 10(A) -> layer1
        let mut base_bindings = std::collections::HashMap::new();
        base_bindings.insert(10, vec![crate::Binding {
            trigger: Trigger::Hold,
            action: Action::LayerMomentary { layer_id: "layer1".to_string() },
            timing_ms: None,
            interrupt_behavior: Some(InterruptBehavior::ForceHold),
        }]);
        config.layers.push(crate::Layer {
            id: "base".to_string(),
            bindings: base_bindings,
            default_modifiers: None,
            passthrough_trigger_key: None,
            parent_layer_id: None,
        });

        // layer1: 20(B) -> layer2 (非透過)
        let mut layer1_bindings = std::collections::HashMap::new();
        layer1_bindings.insert(20, vec![crate::Binding {
            trigger: Trigger::Hold,
            action: Action::LayerMomentary { layer_id: "layer2".to_string() },
            timing_ms: None,
            interrupt_behavior: Some(InterruptBehavior::ForceHold),
        }]);
        config.layers.push(crate::Layer {
            id: "layer1".to_string(),
            bindings: layer1_bindings,
            default_modifiers: None,
            passthrough_trigger_key: None,
            parent_layer_id: None,
        });

        // layer2: RSHIFT(161) -> layer3 (透過: true)
        let mut layer2_bindings = std::collections::HashMap::new();
        layer2_bindings.insert(utils::VK_RSHIFT, vec![crate::Binding {
            trigger: Trigger::Hold,
            action: Action::LayerMomentary { layer_id: "layer3".to_string() },
            timing_ms: None,
            interrupt_behavior: Some(InterruptBehavior::ForceHold),
        }]);
        config.layers.push(crate::Layer {
            id: "layer2".to_string(),
            bindings: layer2_bindings,
            default_modifiers: None,
            passthrough_trigger_key: None,
            parent_layer_id: None,
        });

        config.layers.push(crate::Layer {
            id: "layer3".to_string(),
            bindings: std::collections::HashMap::new(),
            default_modifiers: None,
            passthrough_trigger_key: Some(true),
            parent_layer_id: None,
        });

        // 状態初期化
        {
            let mut state = get_state().lock().unwrap();
            state.active_layers = vec!["base".to_string()];
            state.key_states.clear();
            state.momentary_layers.clear();
            state.momentary_keys.clear();
            state.ghost_keys.clear();
            state.physically_pressed_modifiers.clear();
            state.active_layer_modifiers.clear();
            utils::TEST_SENT_KEYS.lock().unwrap().clear();
        }

        // 1. A(10) -> B(20) -> RSHIFT(161) と順次押下
        let _ = KeyProcessor::process_key(10, true, &config);
        let _ = KeyProcessor::process_key(20, true, &config);
        let _ = KeyProcessor::process_key(utils::VK_RSHIFT, true, &config);
        let _ = KeyProcessor::process_key(999, true, &config); // 確定

        assert!(matches!(
            get_state().lock().unwrap().key_states.get(&utils::VK_RSHIFT),
            Some(KeyState::PassthroughHoldActive { .. })
        ));

        // 送信履歴クリア
        utils::TEST_SENT_KEYS.lock().unwrap().clear();

        // 2. 最上位の親 A(10) を解放 (KeyUp)！
        // B(20) と RSHIFT(161) の両方がモーメンタリ設定を失い、同時にゴースト化する
        let _ = KeyProcessor::process_key(10, false, &config);

        // ★ 検証1: 20 と 161 の双方が ghost_keys に登録されていること！
        {
            let state = get_state().lock().unwrap();
            assert!(state.ghost_keys.contains(&20), "B(20) must be ghosted");
            assert!(state.ghost_keys.contains(&utils::VK_RSHIFT), "RSHIFT(161) must be ghosted");
            assert_eq!(state.active_layers, vec!["base".to_string()]);
        }

        // ★ 検証2: 透過中だった RSHIFT の KeyUp が直ちに送信されていること！
        let sent_during_rel = utils::TEST_SENT_KEYS.lock().unwrap().clone();
        let rshift_up = sent_during_rel.iter().any(|&(vk, is_up)| vk == utils::VK_RSHIFT && is_up);
        assert!(rshift_up, "VK_RSHIFT Up must be sent immediately upon parent release! Sent: {:?}", sent_during_rel);

        // ★ 検証3: B(20) と RSHIFT(161) のオートリピート KeyDown が遮断されること！
        utils::TEST_SENT_KEYS.lock().unwrap().clear();
        assert_eq!(KeyProcessor::process_key(20, true, &config), HookAction::Block);
        assert_eq!(KeyProcessor::process_key(utils::VK_RSHIFT, true, &config), HookAction::Block);
        assert!(utils::TEST_SENT_KEYS.lock().unwrap().is_empty());

        // ★ 検証4: それぞれの物理解放時に Block され、ghost_keys から削除されること！
        assert_eq!(KeyProcessor::process_key(20, false, &config), HookAction::Block);
        assert!(!get_state().lock().unwrap().ghost_keys.contains(&20));

        assert_eq!(KeyProcessor::process_key(utils::VK_RSHIFT, false, &config), HookAction::Block);
        assert!(!get_state().lock().unwrap().ghost_keys.contains(&utils::VK_RSHIFT));

        // 完全にクリーンな状態に戻っていること
        let final_state = get_state().lock().unwrap();
        assert!(final_state.ghost_keys.is_empty());
        assert!(final_state.momentary_keys.is_empty());
        assert_eq!(final_state.active_layers, vec!["base".to_string()]);
    }

    #[test]
    fn test_ghost_key_held_during_reactivation_of_parent_layer() {
        let _lock = crate::key_processor::state::TEST_LOCK.lock().unwrap();
        let mut config = crate::get_default_config();
        config.layers.clear();

        // base: 10(A) -> layer_a
        let mut base_bindings = std::collections::HashMap::new();
        base_bindings.insert(10, vec![crate::Binding {
            trigger: Trigger::Hold,
            action: Action::LayerMomentary { layer_id: "layer_a".to_string() },
            timing_ms: None,
            interrupt_behavior: Some(InterruptBehavior::ForceHold),
        }]);
        config.layers.push(crate::Layer {
            id: "base".to_string(),
            bindings: base_bindings,
            default_modifiers: None,
            passthrough_trigger_key: None,
            parent_layer_id: None,
        });

        // layer_a: 20(B) -> layer_b
        let mut layer_a_bindings = std::collections::HashMap::new();
        layer_a_bindings.insert(20, vec![crate::Binding {
            trigger: Trigger::Hold,
            action: Action::LayerMomentary { layer_id: "layer_b".to_string() },
            timing_ms: None,
            interrupt_behavior: Some(InterruptBehavior::ForceHold),
        }]);
        config.layers.push(crate::Layer {
            id: "layer_a".to_string(),
            bindings: layer_a_bindings,
            default_modifiers: None,
            passthrough_trigger_key: None,
            parent_layer_id: None,
        });

        config.layers.push(crate::Layer {
            id: "layer_b".to_string(),
            bindings: std::collections::HashMap::new(),
            default_modifiers: None,
            passthrough_trigger_key: None,
            parent_layer_id: None,
        });

        // 状態初期化
        {
            let mut state = get_state().lock().unwrap();
            state.active_layers = vec!["base".to_string()];
            state.key_states.clear();
            state.momentary_layers.clear();
            state.momentary_keys.clear();
            state.ghost_keys.clear();
        }

        // 1. A(10) 押下 -> B(20) 押下
        let _ = KeyProcessor::process_key(10, true, &config);
        let _ = KeyProcessor::process_key(20, true, &config);
        let _ = KeyProcessor::process_key(999, true, &config); // 確定
        assert_eq!(get_state().lock().unwrap().active_layers, vec!["base".to_string(), "layer_a".to_string(), "layer_b".to_string()]);

        // 2. A(10) を解放 -> B(20) はゴースト化
        let _ = KeyProcessor::process_key(10, false, &config);
        assert!(get_state().lock().unwrap().ghost_keys.contains(&20));
        assert_eq!(get_state().lock().unwrap().active_layers, vec!["base".to_string()]);

        // 3. B(20) を押したまま、再度 A(10) を押下して layer_a を再アクティブ化！
        let _ = KeyProcessor::process_key(10, true, &config);
        let _ = KeyProcessor::process_key(998, true, &config); // 確定
        assert_eq!(get_state().lock().unwrap().active_layers, vec!["base".to_string(), "layer_a".to_string()]);

        // ★ 検証: B(20) は依然として ghost_keys に存在し、リピート KeyDown は Block されること！
        // （勝手に layer_b に遷移したり、未初期化のステートマシンで誤作動しないこと）
        assert!(get_state().lock().unwrap().ghost_keys.contains(&20));
        let repeat_b = KeyProcessor::process_key(20, true, &config);
        assert_eq!(repeat_b, HookAction::Block);
        assert_eq!(get_state().lock().unwrap().active_layers, vec!["base".to_string(), "layer_a".to_string()]);

        // 4. B(20) を物理解放 -> Block され、ghost_keys から削除される
        let up_b = KeyProcessor::process_key(20, false, &config);
        assert_eq!(up_b, HookAction::Block);
        assert!(!get_state().lock().unwrap().ghost_keys.contains(&20));

        // 5. 改めて B(20) を押下 -> 今度は正常に layer_b がアクティブ化される！
        let _ = KeyProcessor::process_key(20, true, &config);
        let _ = KeyProcessor::process_key(997, true, &config); // 確定
        assert_eq!(get_state().lock().unwrap().active_layers, vec!["base".to_string(), "layer_a".to_string(), "layer_b".to_string()]);

        // クリーンアップ
        let _ = KeyProcessor::process_key(20, false, &config);
        let _ = KeyProcessor::process_key(10, false, &config);
        assert_eq!(get_state().lock().unwrap().active_layers, vec!["base".to_string()]);
    }

    #[test]
    fn test_complex_multiple_modifiers_reconciliation_with_plain_modifier() {
        let _lock = crate::key_processor::state::TEST_LOCK.lock().unwrap();
        let mut config = crate::get_default_config();
        config.layers.clear();

        // 1. base:
        //    - 10(A) -> layer_ctrl_shift (ctrl: true, shift: true)
        //    - 20(B) -> layer_shift_alt (shift: true, alt: true)
        let mut base_bindings = std::collections::HashMap::new();
        base_bindings.insert(10, vec![crate::Binding {
            trigger: Trigger::Hold,
            action: Action::LayerMomentary { layer_id: "layer_ctrl_shift".to_string() },
            timing_ms: None,
            interrupt_behavior: Some(InterruptBehavior::ForceHold),
        }]);
        base_bindings.insert(20, vec![crate::Binding {
            trigger: Trigger::Hold,
            action: Action::LayerMomentary { layer_id: "layer_shift_alt".to_string() },
            timing_ms: None,
            interrupt_behavior: Some(InterruptBehavior::ForceHold),
        }]);
        config.layers.push(crate::Layer {
            id: "base".to_string(),
            bindings: base_bindings,
            default_modifiers: None,
            passthrough_trigger_key: None,
            parent_layer_id: None,
        });

        // 2. layer_ctrl_shift: defaultModifiers: { ctrl: true, shift: true }
        config.layers.push(crate::Layer {
            id: "layer_ctrl_shift".to_string(),
            bindings: std::collections::HashMap::new(),
            default_modifiers: Some(crate::model::ModifierOutput::new().with_ctrl(true).with_shift(true)),
            passthrough_trigger_key: None,
            parent_layer_id: None,
        });

        // 3. layer_shift_alt: defaultModifiers: { shift: true, alt: true }
        config.layers.push(crate::Layer {
            id: "layer_shift_alt".to_string(),
            bindings: std::collections::HashMap::new(),
            default_modifiers: Some(crate::model::ModifierOutput::new().with_shift(true).with_alt(true)),
            passthrough_trigger_key: None,
            parent_layer_id: None,
        });

        // 状態初期化
        {
            let mut state = get_state().lock().unwrap();
            state.active_layers = vec!["base".to_string()];
            state.key_states.clear();
            state.momentary_layers.clear();
            state.momentary_keys.clear();
            state.ghost_keys.clear();
            state.physically_pressed_modifiers.clear();
            state.active_layer_modifiers.clear();
            utils::TEST_SENT_KEYS.lock().unwrap().clear();
        }

        // 1. 通常の物理 LCONTROL(162) を手動で押下 (素通し)
        let a_ctrl = KeyProcessor::process_key(utils::VK_LCONTROL, true, &config);
        assert_eq!(a_ctrl, HookAction::PassThrough);
        assert!(get_state().lock().unwrap().physically_pressed_modifiers.contains(&utils::VK_LCONTROL));

        // 送信履歴クリア
        utils::TEST_SENT_KEYS.lock().unwrap().clear();

        // 2. A(10) 押下 -> layer_ctrl_shift 有効化
        // 物理 Ctrl が押されているため、Ctrl の二重 Down は抑制され、Shift Down のみ送信される
        let _ = KeyProcessor::process_key(10, true, &config);
        let _ = KeyProcessor::process_key(999, true, &config); // 確定
        let sent_1 = utils::TEST_SENT_KEYS.lock().unwrap().clone();
        let ctrl_down_sent = sent_1.iter().any(|&(vk, is_up)| utils::is_ctrl(vk) && !is_up);
        let shift_down_sent = sent_1.iter().any(|&(vk, is_up)| utils::is_shift(vk) && !is_up);
        assert!(!ctrl_down_sent, "Ctrl Down should not be sent because plain physical Ctrl is held!");
        assert!(shift_down_sent, "Shift Down must be sent!");

        // 送信履歴クリア
        utils::TEST_SENT_KEYS.lock().unwrap().clear();

        // 3. B(20) 押下 -> layer_shift_alt 有効化
        // Shift は既に Down されているため、Alt Down のみが追加送信される
        let _ = KeyProcessor::process_key(20, true, &config);
        let _ = KeyProcessor::process_key(998, true, &config); // 確定
        let sent_2 = utils::TEST_SENT_KEYS.lock().unwrap().clone();
        let alt_down_sent = sent_2.iter().any(|&(vk, is_up)| utils::is_alt(vk) && !is_up);
        assert!(alt_down_sent, "Alt Down must be sent!");

        // 送信履歴クリア
        utils::TEST_SENT_KEYS.lock().unwrap().clear();

        // 4. A(10) を解放 (KeyUp)！
        // layer_ctrl_shift が外れ、残るは layer_shift_alt (shift: true, alt: true)。
        // ★重要:
        // - Alt: layer_shift_alt があるため保持
        // - Shift: layer_shift_alt があるため保持
        // - Ctrl: 物理キーで押されているため保護
        // したがって、KeyUp は一切送信されないこと！
        let _ = KeyProcessor::process_key(10, false, &config);
        let sent_3 = utils::TEST_SENT_KEYS.lock().unwrap().clone();
        assert!(
            sent_3.is_empty(),
            "No KeyUp should be sent when A is released! Sent: {:?}",
            sent_3
        );

        // 5. B(20) を解放 (KeyUp)！
        // layer_shift_alt が外れ、レイヤーの修飾キー要求はすべて消滅。
        // ★重要:
        // - Alt Up と Shift Up は送信される。
        // - しかし、物理 Ctrl は依然押されているため、Ctrl Up は絶対に送信されないこと！
        utils::TEST_SENT_KEYS.lock().unwrap().clear();
        let _ = KeyProcessor::process_key(20, false, &config);
        let sent_4 = utils::TEST_SENT_KEYS.lock().unwrap().clone();
        let ctrl_up_sent = sent_4.iter().any(|&(vk, is_up)| utils::is_ctrl(vk) && is_up);
        let shift_up_sent = sent_4.iter().any(|&(vk, is_up)| utils::is_shift(vk) && is_up);
        let alt_up_sent = sent_4.iter().any(|&(vk, is_up)| utils::is_alt(vk) && is_up);
        assert!(!ctrl_up_sent, "Ctrl Up must NOT be sent while physical Ctrl is still held! Sent: {:?}", sent_4);
        assert!(shift_up_sent, "Shift Up must be sent!");
        assert!(alt_up_sent, "Alt Up must be sent!");

        // 6. 最後に物理 LCONTROL(162) を解放
        // パススルーで OS に素通し KeyUp が届く
        let a_ctrl_up = KeyProcessor::process_key(utils::VK_LCONTROL, false, &config);
        assert_eq!(a_ctrl_up, HookAction::PassThrough);
        assert!(get_state().lock().unwrap().physically_pressed_modifiers.is_empty());
        assert!(get_state().lock().unwrap().active_layer_modifiers.is_empty());
    }

    #[test]
    fn test_lr_shift_isolation_in_process_key_and_send_key_up() {
        let _lock = state::TEST_LOCK.lock().unwrap();
        let mut config = crate::get_default_config();
        config.layers.clear();
        config.layer_order = vec!["base".to_string()];

        let mut base_bindings = std::collections::HashMap::new();
        // Aキー (65): Hold で VK_LSHIFT (160) (通常解放・SustainHold)
        base_bindings.insert(65, vec![crate::Binding {
            trigger: Trigger::Hold,
            action: Action::Remap {
                keys: vec![utils::VK_LSHIFT],
                repeat: Some(false),
                repeat_delay_ms: None,
                repeat_interval_ms: None,
            },
            timing_ms: None,
            interrupt_behavior: Some(InterruptBehavior::ForceHold),
        }]);
        // Bキー (66): Tap & Hold 両方を設定
        // - Tap: VK_LSHIFT へのリマップ
        // - Hold: base レイヤー (ダミーHold)
        // 短押し解放で WaitingForHold -> ExecuteTapAtomic -> ImmediateRelease -> send_key_up() を確実に通過させる
        base_bindings.insert(66, vec![
            crate::Binding {
                trigger: Trigger::Tap,
                action: Action::Remap {
                    keys: vec![utils::VK_LSHIFT],
                    repeat: Some(false),
                    repeat_delay_ms: None,
                    repeat_interval_ms: None,
                },
                timing_ms: None,
                interrupt_behavior: None,
            },
            crate::Binding {
                trigger: Trigger::Hold,
                action: Action::LayerMomentary { layer_id: "base".to_string() },
                timing_ms: Some(300),
                interrupt_behavior: None,
            },
        ]);
        // Cキー (67): Hold で VK_RSHIFT (161) (左右反転: 通常解放)
        base_bindings.insert(67, vec![crate::Binding {
            trigger: Trigger::Hold,
            action: Action::Remap {
                keys: vec![utils::VK_RSHIFT],
                repeat: Some(false),
                repeat_delay_ms: None,
                repeat_interval_ms: None,
            },
            timing_ms: None,
            interrupt_behavior: Some(InterruptBehavior::ForceHold),
        }]);
        // Dキー (68): Tap & Hold 両方を設定 (左右反転: 即時解放)
        // - Tap: VK_RSHIFT へのリマップ
        // - Hold: base レイヤー (ダミーHold)
        // 短押し解放で WaitingForHold -> ExecuteTapAtomic -> ImmediateRelease -> send_key_up() を通過させる
        base_bindings.insert(68, vec![
            crate::Binding {
                trigger: Trigger::Tap,
                action: Action::Remap {
                    keys: vec![utils::VK_RSHIFT],
                    repeat: Some(false),
                    repeat_delay_ms: None,
                    repeat_interval_ms: None,
                },
                timing_ms: None,
                interrupt_behavior: None,
            },
            crate::Binding {
                trigger: Trigger::Hold,
                action: Action::LayerMomentary { layer_id: "base".to_string() },
                timing_ms: Some(300),
                interrupt_behavior: None,
            },
        ]);

        config.layers.push(crate::Layer {
            id: "base".to_string(),
            bindings: base_bindings,
            default_modifiers: None,
            passthrough_trigger_key: None,
            parent_layer_id: None,
        });

        // ========================================================
        // 1. 物理右Shift保持中に左Shiftへの通常リマップ (Aキー)
        // ========================================================
        {
            {
                let mut state = get_state().lock().unwrap();
                state.active_layers = vec!["base".to_string()];
                state.key_states.clear();
                state.momentary_layers.clear();
                state.pressed_vks.clear();
                state.suppressed_modifiers_for_key.clear();
                state.physically_pressed_modifiers.clear();
                state.active_layer_modifiers.clear();
                utils::TEST_SENT_KEYS.lock().unwrap().clear();
            }

            // (1) 物理右Shift (VK_RSHIFT) を押下 (素通し)
            let action_rshift_down = KeyProcessor::process_key(utils::VK_RSHIFT, true, &config);
            assert_eq!(action_rshift_down, HookAction::PassThrough);
            assert!(get_state().lock().unwrap().physically_pressed_modifiers.contains(&utils::VK_RSHIFT));

            utils::TEST_SENT_KEYS.lock().unwrap().clear();

            // (2) Aキー (65) を押下 -> ダミーキー(999)でHold確定 -> LShift Down が送信され、pressed_vks に保持される
            let _ = KeyProcessor::process_key(65, true, &config);
            let _ = KeyProcessor::process_key(999, true, &config);
            let sent_a_down = utils::TEST_SENT_KEYS.lock().unwrap().clone();
            assert!(
                sent_a_down.iter().any(|&(vk, is_up)| vk == utils::VK_LSHIFT && !is_up),
                "VK_LSHIFT KeyDown should be sent"
            );
            assert!(get_state().lock().unwrap().pressed_vks.contains_key(&65));

            utils::TEST_SENT_KEYS.lock().unwrap().clear();

            // (3) Aキー (65) を解放 (通常解放)
            // 右Shiftが透過中であっても、左ShiftのKeyUpが省略されずに確実に送信されること！
            let _ = KeyProcessor::process_key(65, false, &config);
            let sent_a_up = utils::TEST_SENT_KEYS.lock().unwrap().clone();
            assert!(
                sent_a_up.iter().any(|&(vk, is_up)| vk == utils::VK_LSHIFT && is_up),
                "VK_LSHIFT KeyUp MUST be sent when A is released, even if VK_RSHIFT is physically held! Sent: {:?}",
                sent_a_up
            );
            assert!(!get_state().lock().unwrap().pressed_vks.contains_key(&65));

            // (4) 物理右Shift (VK_RSHIFT) を解放
            let action_rshift_up = KeyProcessor::process_key(utils::VK_RSHIFT, false, &config);
            assert_eq!(action_rshift_up, HookAction::PassThrough);

            // 合成キーの残存チェック
            let state = get_state().lock().unwrap();
            assert!(state.pressed_vks.is_empty(), "pressed_vks must be empty");
            assert!(state.active_layer_modifiers.is_empty(), "active_layer_modifiers must be empty");
            assert!(state.physically_pressed_modifiers.is_empty(), "physically_pressed_modifiers must be empty");
        }

        // ========================================================
        // 2. 左右反転: 物理左Shift保持中に右Shiftへの通常リマップ (Cキー)
        // ========================================================
        {
            {
                let mut state = get_state().lock().unwrap();
                state.active_layers = vec!["base".to_string()];
                state.key_states.clear();
                state.momentary_layers.clear();
                state.pressed_vks.clear();
                state.suppressed_modifiers_for_key.clear();
                state.physically_pressed_modifiers.clear();
                state.active_layer_modifiers.clear();
                utils::TEST_SENT_KEYS.lock().unwrap().clear();
            }

            // (1) 物理左Shift (VK_LSHIFT) を押下 (素通し)
            let action_lshift_down = KeyProcessor::process_key(utils::VK_LSHIFT, true, &config);
            assert_eq!(action_lshift_down, HookAction::PassThrough);

            utils::TEST_SENT_KEYS.lock().unwrap().clear();

            // (2) Cキー (67) を押下 -> ダミーキー(999)でHold確定 -> RShift Down が送信される
            let _ = KeyProcessor::process_key(67, true, &config);
            let _ = KeyProcessor::process_key(999, true, &config);
            let sent_c_down = utils::TEST_SENT_KEYS.lock().unwrap().clone();
            assert!(
                sent_c_down.iter().any(|&(vk, is_up)| vk == utils::VK_RSHIFT && !is_up),
                "VK_RSHIFT KeyDown should be sent"
            );

            utils::TEST_SENT_KEYS.lock().unwrap().clear();

            // (3) Cキー (67) を解放 (通常解放)
            // 左Shiftが透過中であっても、右ShiftのKeyUpが確実に送信されること！
            let _ = KeyProcessor::process_key(67, false, &config);
            let sent_c_up = utils::TEST_SENT_KEYS.lock().unwrap().clone();
            assert!(
                sent_c_up.iter().any(|&(vk, is_up)| vk == utils::VK_RSHIFT && is_up),
                "VK_RSHIFT KeyUp MUST be sent when C is released, even if VK_LSHIFT is physically held! Sent: {:?}",
                sent_c_up
            );

            // (4) 物理左Shift (VK_LSHIFT) を解放
            let action_lshift_up = KeyProcessor::process_key(utils::VK_LSHIFT, false, &config);
            assert_eq!(action_lshift_up, HookAction::PassThrough);

            let state = get_state().lock().unwrap();
            assert!(state.pressed_vks.is_empty());
            assert!(state.active_layer_modifiers.is_empty());
            assert!(state.physically_pressed_modifiers.is_empty());
        }

        // ========================================================
        // 3. 物理右Shift保持中に左Shiftへの即時解放リマップ (Bキー: TapAtomic -> ImmediateRelease -> send_key_up)
        // ========================================================
        {
            {
                let mut state = get_state().lock().unwrap();
                state.active_layers = vec!["base".to_string()];
                state.key_states.clear();
                state.momentary_layers.clear();
                state.pressed_vks.clear();
                state.suppressed_modifiers_for_key.clear();
                state.physically_pressed_modifiers.clear();
                state.active_layer_modifiers.clear();
                utils::TEST_SENT_KEYS.lock().unwrap().clear();
            }

            // (1) 物理右Shift (VK_RSHIFT) を押下 (素通し)
            let _ = KeyProcessor::process_key(utils::VK_RSHIFT, true, &config);
            utils::TEST_SENT_KEYS.lock().unwrap().clear();

            // (2) Bキー (66) を押下 (WaitingForHold に遷移するため、押下直後はキー出力なし)
            let _ = KeyProcessor::process_key(66, true, &config);
            assert!(
                utils::TEST_SENT_KEYS.lock().unwrap().is_empty(),
                "No key output should be emitted upon press for TapAndHold key"
            );

            // (3) Bキー (66) を短押し解放 -> ExecuteTapAtomic -> ImmediateRelease -> send_key_up
            let _ = KeyProcessor::process_key(66, false, &config);

            let sent_b = utils::TEST_SENT_KEYS.lock().unwrap().clone();
            // send_key_down と send_key_up がアトミックに連続実行され、VK_LSHIFT の Down と Up が揃っていること！
            assert_eq!(
                sent_b,
                vec![(utils::VK_LSHIFT, false), (utils::VK_LSHIFT, true)],
                "VK_LSHIFT Down and Up MUST be emitted in sequence via send_key_up! Sent: {:?}",
                sent_b
            );

            // (4) 物理右Shift (VK_RSHIFT) を解放
            let _ = KeyProcessor::process_key(utils::VK_RSHIFT, false, &config);

            let state = get_state().lock().unwrap();
            assert!(state.pressed_vks.is_empty(), "pressed_vks must be empty");
            assert!(state.active_layer_modifiers.is_empty(), "active_layer_modifiers must be empty");
            assert!(state.physically_pressed_modifiers.is_empty(), "physically_pressed_modifiers must be empty");
        }

        // ========================================================
        // 4. 左右反転: 物理左Shift保持中に右Shiftへの即時解放リマップ (Dキー: TapAtomic -> ImmediateRelease -> send_key_up)
        // ========================================================
        {
            {
                let mut state = get_state().lock().unwrap();
                state.active_layers = vec!["base".to_string()];
                state.key_states.clear();
                state.momentary_layers.clear();
                state.pressed_vks.clear();
                state.suppressed_modifiers_for_key.clear();
                state.physically_pressed_modifiers.clear();
                state.active_layer_modifiers.clear();
                utils::TEST_SENT_KEYS.lock().unwrap().clear();
            }

            // (1) 物理左Shift (VK_LSHIFT) を押下 (素通し)
            let _ = KeyProcessor::process_key(utils::VK_LSHIFT, true, &config);
            utils::TEST_SENT_KEYS.lock().unwrap().clear();

            // (2) Dキー (68) を押下 (WaitingForHold に遷移するため押下直後は出力なし)
            let _ = KeyProcessor::process_key(68, true, &config);
            assert!(
                utils::TEST_SENT_KEYS.lock().unwrap().is_empty(),
                "No key output should be emitted upon press for TapAndHold key"
            );

            // (3) Dキー (68) を短押し解放 -> ExecuteTapAtomic -> ImmediateRelease -> send_key_up
            let _ = KeyProcessor::process_key(68, false, &config);

            let sent_d = utils::TEST_SENT_KEYS.lock().unwrap().clone();
            // send_key_down と send_key_up がアトミックに連続実行され、VK_RSHIFT の Down と Up が揃っていること！
            assert_eq!(
                sent_d,
                vec![(utils::VK_RSHIFT, false), (utils::VK_RSHIFT, true)],
                "VK_RSHIFT Down and Up MUST be emitted in sequence via send_key_up! Sent: {:?}",
                sent_d
            );

            // (4) 物理左Shift (VK_LSHIFT) を解放
            let _ = KeyProcessor::process_key(utils::VK_LSHIFT, false, &config);

            let state = get_state().lock().unwrap();
            assert!(state.pressed_vks.is_empty(), "pressed_vks must be empty");
            assert!(state.active_layer_modifiers.is_empty(), "active_layer_modifiers must be empty");
            assert!(state.physically_pressed_modifiers.is_empty(), "physically_pressed_modifiers must be empty");
        }
    }
}
