pub mod state;
pub mod utils;
pub mod actions;

use crate::Config;
use crate::state_machine::{transition, ActionCommand, KeyState, TriggerEvent};
use std::time::Instant;
use state::get_state;
use utils::{
    send_key_down, send_key_up, send_key_raw, send_key_atomic, is_modifier, apply_layer_modifiers,
    restore_suppressed_modifiers,
};
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
                    send_key_atomic(vk);
                }
            }
            ActionCommand::ExecuteTapAtomic => {
                if let Some(action) = Self::get_action(vk, "tap", config, &active_layers) {
                    apply_action(vk, action, true, config);
                } else {
                    send_key_atomic(vk);
                }
                // アトミック処理完了後、確実に物理キートラッカーから該当VKをクリーンアップ
                get_state().lock().unwrap().pressed_vks.remove(&vk);
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
                #[cfg(windows)]
                crate::hook::set_scroll_mode_state(false, 1.0, false, "both");

                let mut state = get_state().lock().unwrap();
                let vks = state.pressed_vks.remove(&vk).unwrap_or_default();
                for target in vks {
                    send_key_raw(target, true);
                }

                // リマップ送信時に一時解除されていた修飾キーがあれば復元
                if let Some(suppressed) = state.suppressed_modifiers_for_key.remove(&vk) {
                    restore_suppressed_modifiers(&suppressed);
                }

                // パススルートリガーキーがリリースされたならOS上でもUPを送信
                if state.passthrough_trigger_keys.remove(&vk) {
                    send_key_raw(vk, true);
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
    fn get_interrupt_behavior(vk_code: u16, config: &Config, active_layers: &[String]) -> crate::state_machine::InterruptBehavior {
        if let Some(bindings) = Self::get_bindings(vk_code, config, active_layers) {
            let has_tap = bindings.iter().any(|b| b.trigger == "tap");
            for b in bindings {
                if b.trigger == "hold" {
                    if let Some(behavior) = &b.interrupt_behavior {
                        if behavior == "ignore" {
                            return crate::state_machine::InterruptBehavior::Ignore;
                        } else if behavior == "forceHold" {
                            return crate::state_machine::InterruptBehavior::ForceHold;
                        }
                    } else if !has_tap {
                        // tapが設定されていないキー（Shift等）で他のキーが押された場合は自然に ForceHold にする
                        return crate::state_machine::InterruptBehavior::ForceHold;
                    }
                }
            }
        }
        crate::state_machine::InterruptBehavior::ForceTap
    }

    fn is_passthrough_momentary_key(
        vk_code: u16,
        config: &Config,
        active_layers: &[String],
    ) -> Option<String> {
        if let Some(bindings) = Self::get_bindings(vk_code, config, active_layers) {
            let has_tap = bindings.iter().any(|b| b.trigger == "tap");
            let has_double_tap = bindings.iter().any(|b| b.trigger == "doubleTap");
            if !has_tap && !has_double_tap {
                if let Some(hold_binding) = bindings.iter().find(|b| b.trigger == "hold") {
                    if hold_binding.action.get("type").and_then(|v| v.as_str()) == Some("layerMomentary") {
                        if let Some(layer_id) = hold_binding.action.get("layerId").and_then(|v| v.as_str()) {
                            if let Some(layer) = config.layers.iter().find(|l| l.id == layer_id) {
                                if layer.passthrough_trigger_key.unwrap_or(false) {
                                    return Some(layer_id.to_string());
                                }
                            }
                        }
                    }
                }
            }
        }
        None
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
                        Self::get_interrupt_behavior(other_vk, config, &active_layers),
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

        // passthrough_trigger_key の即時処理チェック (単押し/ダブルタップ設定がないモーメンタリキー)
        let passthrough_layer = Self::is_passthrough_momentary_key(vk_code, config, &state_guard.active_layers);
        if let Some(layer_id) = passthrough_layer {
            if is_down {
                let is_already_active = state_guard.momentary_layers.contains_key(&vk_code);
                if is_already_active {
                    return HookAction::PassThrough;
                }
                state_guard.passthrough_trigger_keys.insert(vk_code);
                state_guard.key_states.insert(
                    vk_code,
                    KeyState::HoldActive {
                        activated_at: Instant::now(),
                        last_repeated_at: Instant::now(),
                    },
                );
                drop(state_guard);
                let action = serde_json::json!({
                    "type": "layerMomentary",
                    "layerId": layer_id
                });
                apply_action(vk_code, &action, false, config);
                return HookAction::PassThrough;
            } else if state_guard.passthrough_trigger_keys.remove(&vk_code) {
                state_guard.key_states.remove(&vk_code);
                drop(state_guard);
                Self::execute_action(ActionCommand::ReleaseHold, vk_code, config);
                return HookAction::PassThrough;
            }
        }

        // すでに passthrough_trigger_keys に登録されているキーの離上処理
        if !is_down && state_guard.passthrough_trigger_keys.remove(&vk_code) {
            state_guard.key_states.remove(&vk_code);
            drop(state_guard);
            Self::execute_action(ActionCommand::ReleaseHold, vk_code, config);
            return HookAction::PassThrough;
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

        let interrupt_behavior = Self::get_interrupt_behavior(vk_code, config, &state_guard.active_layers);
        let (new_state, cmd) = transition(current_state, event, has_hold, has_double_tap, interrupt_behavior, Instant::now());
        log::debug!("DEBUG[transition]: vk={} event={:?} state {:?} -> {:?} (cmd: {:?})", vk_code, event, current_state, new_state, cmd);

        if new_state == KeyState::Idle {
            state_guard.key_states.remove(&vk_code);
        } else {
            state_guard.key_states.insert(vk_code, new_state);
        }
        drop(state_guard);
        crate::key_processor::state::get_state_wrapper().cvar.notify_all();

        Self::execute_action(cmd, vk_code, config);

        HookAction::Block
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
                let mut cmds = Vec::new();
                let active_layers = state_guard.active_layers.clone();
                let mut next_timeout: Option<Instant> = None;

                for (&vk, key_state) in state_guard.key_states.iter_mut() {
                    let mut target_time_opt = None;
                    let mut is_custom_repeat = false;

                    match key_state {
                        KeyState::WaitingForHold { pressed_at } => {
                            let timing = Self::get_timing(vk, "hold", &config, &active_layers).unwrap_or(200);
                            target_time_opt = Some(*pressed_at + std::time::Duration::from_millis(timing as u64));
                        }
                        KeyState::WaitingForDoubleTap { first_released_at } => {
                            let timing = Self::get_timing(vk, "doubleTap", &config, &active_layers).unwrap_or(200);
                            target_time_opt = Some(*first_released_at + std::time::Duration::from_millis(timing as u64));
                        }
                        KeyState::HoldActive { last_repeated_at, .. } => {
                            if let Some(interval) = Self::get_repeat_interval(vk, "hold", &config, &active_layers) {
                                target_time_opt = Some(*last_repeated_at + std::time::Duration::from_millis(interval as u64));
                                is_custom_repeat = true;
                            }
                        }
                        KeyState::TapActive { last_repeated_at, .. } => {
                            if let Some(interval) = Self::get_repeat_interval(vk, "tap", &config, &active_layers) {
                                target_time_opt = Some(*last_repeated_at + std::time::Duration::from_millis(interval as u64));
                                is_custom_repeat = true;
                            }
                        }
                        _ => {}
                    }

                    if let Some(target_time) = target_time_opt {
                        if now >= target_time {
                            let (has_hold, has_double_tap) = Self::has_triggers(vk, &config, &active_layers);
                            let event = if is_custom_repeat { TriggerEvent::CustomRepeat } else { TriggerEvent::Timeout };
                            let interrupt_behavior = Self::get_interrupt_behavior(vk, &config, &active_layers);
                            let (new_state, cmd) = transition(
                                *key_state,
                                event,
                                has_hold,
                                has_double_tap,
                                interrupt_behavior,
                                now,
                            );
                            if event == TriggerEvent::Timeout {
                                log::debug!("DEBUG[timeout]: vk={} state {:?} -> {:?} (cmd: {:?})", vk, key_state, new_state, cmd);
                            }
                            *key_state = new_state;
                            cmds.push((vk, cmd));
                        } else {
                            if next_timeout.map_or(true, |t| target_time < t) {
                                next_timeout = Some(target_time);
                            }
                        }
                    }
                }
                state_guard.key_states.retain(|_, s| *s != KeyState::Idle);

                // アイドル時の自己修復判定 (キー入力が完全に落ち着いている時のみ実行)
                const IDLE_RECONCILE_THRESHOLD: std::time::Duration = std::time::Duration::from_millis(1500);
                let should_reconcile = if !state_guard.pressed_vks.is_empty() || !state_guard.momentary_layers.is_empty() {
                    if let Some(last_act) = crate::key_processor::state::get_last_key_activity() {
                        let idle_target = last_act + IDLE_RECONCILE_THRESHOLD;
                        if now >= idle_target {
                            true
                        } else {
                            if next_timeout.map_or(true, |t| idle_target < t) {
                                next_timeout = Some(idle_target);
                            }
                            false
                        }
                    } else {
                        true
                    }
                } else {
                    false
                };
                
                // 一旦ロックを手放してコマンド実行
                drop(state_guard);
                for (vk, cmd) in cmds {
                    Self::execute_action(cmd, vk, &config);
                }

                // アイドルかつスタックキーがある場合のみ安全に自己修復
                if should_reconcile {
                    #[cfg(windows)]
                    crate::key_processor::utils::reconcile_physical_keys();
                }
                
                // 再びロックを取得して待機
                state_guard = crate::key_processor::state::get_state_wrapper().mutex.lock().unwrap();
                
                // 次のループのための待機
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
