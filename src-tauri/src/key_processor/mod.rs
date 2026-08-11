pub mod state;
pub mod utils;
pub mod actions;

use crate::Config;
use crate::state_machine::{transition, ActionCommand, KeyState, TriggerEvent};
use std::time::Instant;
use state::get_state;
use utils::{send_key_down, send_key_up, send_key_raw, is_modifier, apply_layer_modifiers};
use actions::apply_action;

#[derive(Debug, PartialEq, Eq)]
pub enum HookAction {
    Block,
    PassThrough,
}

pub struct KeyProcessor;

impl KeyProcessor {
    fn get_bindings<'a>(
        vk: u16,
        config: &'a Config,
        active_layers: &[String],
    ) -> Option<&'a Vec<crate::Binding>> {
        for layer_id in config.layer_order.iter().rev() {
            if active_layers.contains(layer_id) || layer_id == "base" {
                if let Some(layer) = config.layers.iter().find(|l| &l.id == layer_id) {
                    if let Some(bindings) = layer.bindings.get(&vk.to_string()) {
                        if !bindings.is_empty() {
                            return Some(bindings);
                        }
                    }
                }
            }
        }
        None
    }

    fn has_triggers(vk: u16, config: &Config, active_layers: &[String]) -> (bool, bool) {
        if let Some(bindings) = Self::get_bindings(vk, config, active_layers) {
            let has_hold = bindings.iter().any(|b| b.trigger == "hold");
            let has_double_tap = bindings.iter().any(|b| b.trigger == "doubleTap");
            (has_hold, has_double_tap)
        } else {
            (false, false)
        }
    }

    fn get_action<'a>(vk: u16, trigger: &str, config: &'a Config, active_layers: &[String]) -> Option<&'a serde_json::Value> {
        if let Some(bindings) = Self::get_bindings(vk, config, active_layers) {
            if let Some(binding) = bindings.iter().find(|b| b.trigger == trigger) {
                return Some(&binding.action);
            }
        }
        None
    }

    fn get_timing(vk: u16, trigger: &str, config: &Config, active_layers: &[String]) -> Option<u32> {
        Self::get_bindings(vk, config, active_layers)
            .and_then(|b| b.iter().find(|x| x.trigger == trigger))
            .and_then(|b| b.timing_ms)
    }

    fn get_repeat_interval(vk: u16, trigger: &str, config: &Config, active_layers: &[String]) -> Option<u32> {
        if let Some(action) = Self::get_action(vk, trigger, config, active_layers) {
            if action.get("type").and_then(|v| v.as_str()) == Some("remap") {
                if action.get("repeat").and_then(|v| v.as_bool()).unwrap_or(false) {
                    if let Some(interval) = action.get("repeatIntervalMs").and_then(|v| v.as_u64()) {
                        return Some(interval as u32);
                    }
                }
            }
        }
        None
    }

    fn execute_action(cmd: ActionCommand, vk: u16, config: &Config) {
        let active_layers = get_state().lock().unwrap().active_layers.clone();

        match cmd {
            ActionCommand::None => {}
            ActionCommand::ExecuteTap => {
                if let Some(action) = Self::get_action(vk, "tap", config, &active_layers) {
                    apply_action(vk, action, false, config);
                } else {
                    send_key_down(vk, vk);
                    send_key_up(vk, vk);
                }
            }
            ActionCommand::ExecuteTapAtomic => {
                if let Some(action) = Self::get_action(vk, "tap", config, &active_layers) {
                    apply_action(vk, action, true, config);
                } else {
                    send_key_down(vk, vk);
                    send_key_up(vk, vk);
                }
            }
            ActionCommand::ExecuteHold => {
                if let Some(action) = Self::get_action(vk, "hold", config, &active_layers) {
                    apply_action(vk, action, false, config);
                }
            }
            ActionCommand::ExecuteHoldRepeat => {
                if let Some(action) = Self::get_action(vk, "hold", config, &active_layers) {
                    if action.get("type").and_then(|v| v.as_str()) == Some("remap") {
                        if action.get("repeat").and_then(|v| v.as_bool()).unwrap_or(false) {
                            if let Some(keys) = action.get("keys").and_then(|v| v.as_array()) {
                                let mut target_vks = Vec::new();
                                for k in keys {
                                    if let Some(k_vk) = k.as_u64() {
                                        target_vks.push(k_vk as u16);
                                    }
                                }

                                for &target_vk in &target_vks {
                                    if !is_modifier(target_vk) {
                                        send_key_down(vk, target_vk);
                                        send_key_up(vk, target_vk);
                                    }
                                }
                            }
                        }
                    }
                }
            }
            ActionCommand::ExecuteDoubleTap => {
                if let Some(action) = Self::get_action(vk, "doubleTap", config, &active_layers) {
                    apply_action(vk, action, false, config);
                }
            }
            ActionCommand::ReleaseTap | ActionCommand::ReleaseHold | ActionCommand::ReleaseDoubleTap => {
                let mut state = get_state().lock().unwrap();
                let vks = state.pressed_vks.remove(&vk).unwrap_or_default();
                for target in vks {
                    send_key_raw(target, true);
                }
                if let Some(layer_id) = state.momentary_layers.remove(&vk) {
                    let old_layers = state.active_layers.clone();
                    state.active_layers.retain(|l| l != &layer_id);
                    let new_layers = state.active_layers.clone();
                    drop(state);
                    apply_layer_modifiers(&old_layers, &new_layers, config);
                    return;
                }
            }
        }
    }

    pub fn process_key(vk_code: u16, is_down: bool, config: &Config) -> HookAction {
        let mut state_guard = get_state().lock().unwrap();

        if is_down {
            let mut other_cmds = Vec::new();
            let active_layers = state_guard.active_layers.clone();
            for (&other_vk, other_state) in state_guard.key_states.iter_mut() {
                if other_vk != vk_code {
                    let (has_hold, has_double_tap) = Self::has_triggers(other_vk, config, &active_layers);
                    let (new_state, cmd) = transition(
                        *other_state,
                        TriggerEvent::OtherKeyPressed,
                        has_hold,
                        has_double_tap,
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

        // 2. Check if THIS key has bindings OR is currently being tracked
        let is_tracked = state_guard.key_states.contains_key(&vk_code);
        let has_any_binding = Self::get_bindings(vk_code, config, &state_guard.active_layers)
            .map(|b| !b.is_empty())
            .unwrap_or(false);

        if !has_any_binding && !is_tracked {
            // No bindings for this key, let OS handle it
            return HookAction::PassThrough;
        }

        // 3. Process THIS key
        let (has_hold, has_double_tap) = Self::has_triggers(vk_code, config, &state_guard.active_layers);
        let current_state = state_guard
            .key_states
            .get(&vk_code)
            .copied()
            .unwrap_or(KeyState::Idle);

        if is_down {
            match current_state {
                KeyState::HoldActive { .. } => {
                    if Self::get_repeat_interval(vk_code, "hold", config, &state_guard.active_layers).is_some() {
                        return HookAction::Block;
                    }
                }
                KeyState::TapActive { .. } => {
                    if Self::get_repeat_interval(vk_code, "tap", config, &state_guard.active_layers).is_some() {
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

        let (new_state, cmd) = transition(current_state, event, has_hold, has_double_tap, Instant::now());
        log::debug!("DEBUG[transition]: vk={} event={:?} state {:?} -> {:?} (cmd: {:?})", vk_code, event, current_state, new_state, cmd);

        if new_state == KeyState::Idle {
            state_guard.key_states.remove(&vk_code);
        } else {
            state_guard.key_states.insert(vk_code, new_state);
        }
        drop(state_guard);

        Self::execute_action(cmd, vk_code, config);

        HookAction::Block
    }

    pub fn start_timeout_worker(app: tauri::AppHandle) {
        use tauri::Manager;
        std::thread::spawn(move || loop {
            std::thread::sleep(std::time::Duration::from_millis(10));

            if !crate::hook::REMAP_ENABLED.load(std::sync::atomic::Ordering::SeqCst) {
                continue;
            }

            let state = app.state::<crate::ConfigState>();
            let config = state.config.load();

            let mut state_guard = get_state().lock().unwrap();
            let now = Instant::now();
            let mut cmds = Vec::new();
            let active_layers = state_guard.active_layers.clone();

            for (&vk, key_state) in state_guard.key_states.iter_mut() {
                let is_timeout = match key_state {
                    KeyState::WaitingForHold { pressed_at } => {
                        let timing = Self::get_timing(vk, "hold", &config, &active_layers).unwrap_or(200);
                        let elapsed = now.duration_since(*pressed_at).as_millis();
                        elapsed >= timing as u128
                    }
                    KeyState::WaitingForDoubleTap { first_released_at } => {
                        let timing = Self::get_timing(vk, "doubleTap", &config, &active_layers).unwrap_or(200);
                        let elapsed = now.duration_since(*first_released_at).as_millis();
                        elapsed >= timing as u128
                    }
                    _ => false,
                };

                if is_timeout {
                    let (has_hold, has_double_tap) = Self::has_triggers(vk, &config, &active_layers);
                    let (new_state, cmd) = transition(
                        *key_state,
                        TriggerEvent::Timeout,
                        has_hold,
                        has_double_tap,
                        now,
                    );
                    log::debug!("DEBUG[timeout]: vk={} state {:?} -> {:?} (cmd: {:?})", vk, key_state, new_state, cmd);
                    *key_state = new_state;
                    cmds.push((vk, cmd));
                } else {
                    let custom_repeat_interval = match key_state {
                        KeyState::HoldActive { last_repeated_at, .. } => {
                            Self::get_repeat_interval(vk, "hold", &config, &active_layers).and_then(|interval| {
                                if now.duration_since(*last_repeated_at).as_millis() >= interval as u128 {
                                    Some(interval)
                                } else {
                                    None
                                }
                            })
                        }
                        KeyState::TapActive { last_repeated_at, .. } => {
                            Self::get_repeat_interval(vk, "tap", &config, &active_layers).and_then(|interval| {
                                if now.duration_since(*last_repeated_at).as_millis() >= interval as u128 {
                                    Some(interval)
                                } else {
                                    None
                                }
                            })
                        }
                        _ => None,
                    };

                    if custom_repeat_interval.is_some() {
                        let (has_hold, has_double_tap) = Self::has_triggers(vk, &config, &active_layers);
                        let (new_state, cmd) = transition(
                            *key_state,
                            TriggerEvent::CustomRepeat,
                            has_hold,
                            has_double_tap,
                            now,
                        );
                        log::debug!("DEBUG[custom_repeat]: vk={} state {:?} -> {:?} (cmd: {:?})", vk, key_state, new_state, cmd);
                        *key_state = new_state;
                        cmds.push((vk, cmd));
                    }
                }
            }

            state_guard.key_states.retain(|_, s| *s != KeyState::Idle);
            drop(state_guard);

            for (vk, cmd) in cmds {
                Self::execute_action(cmd, vk, &config);
            }
        });
    }
}
