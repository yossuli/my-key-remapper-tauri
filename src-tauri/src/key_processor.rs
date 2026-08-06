use crate::Config;
use crate::state_machine::{transition, ActionCommand, KeyState, TriggerEvent};
use std::collections::{HashMap, HashSet};
use std::sync::{Mutex, OnceLock};
use std::time::Instant;
use windows::Win32::UI::Input::KeyboardAndMouse::{
    SendInput, INPUT, INPUT_0, INPUT_KEYBOARD, KEYBDINPUT, KEYEVENTF_KEYUP,
};

#[derive(Debug, PartialEq, Eq)]
pub enum HookAction {
    Block,
    PassThrough,
}

struct ProcessorState {
    key_states: HashMap<u16, KeyState>,
    active_layers: Vec<String>,
    pressed_vks: HashMap<u16, Vec<u16>>,
    momentary_layers: HashMap<u16, String>,
}

static STATE: OnceLock<Mutex<ProcessorState>> = OnceLock::new();

fn get_state() -> &'static Mutex<ProcessorState> {
    STATE.get_or_init(|| {
        Mutex::new(ProcessorState {
            key_states: HashMap::new(),
            active_layers: vec!["base".to_string()],
            pressed_vks: HashMap::new(),
            momentary_layers: HashMap::new(),
        })
    })
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

    fn is_modifier(vk: u16) -> bool {
        matches!(vk, 0x10 | 0x11 | 0x12 | 0x5B | 0x5C | 0xA0 | 0xA1 | 0xA2 | 0xA3 | 0xA4 | 0xA5)
    }

    fn compute_active_modifiers(active_layers: &[String], config: &Config) -> HashSet<u16> {
        let mut mods = HashSet::new();
        for layer_id in active_layers {
            if let Some(layer) = config.layers.iter().find(|l| &l.id == layer_id) {
                if let Some(def_mods) = &layer.default_modifiers {
                    if let Some(shift) = def_mods.get("shift").and_then(|v| v.as_bool()) {
                        if shift { mods.insert(160); }
                    }
                    if let Some(ctrl) = def_mods.get("ctrl").and_then(|v| v.as_bool()) {
                        if ctrl { mods.insert(162); }
                    }
                    if let Some(alt) = def_mods.get("alt").and_then(|v| v.as_bool()) {
                        if alt { mods.insert(164); }
                    }
                    if let Some(win) = def_mods.get("win").and_then(|v| v.as_bool()) {
                        if win { mods.insert(91); }
                    }
                }
            }
        }
        mods
    }

    fn apply_layer_modifiers(old_layers: &[String], new_layers: &[String], config: &Config) {
        let old_mods = Self::compute_active_modifiers(old_layers, config);
        let new_mods = Self::compute_active_modifiers(new_layers, config);

        for &modifier in new_mods.difference(&old_mods) {
            Self::send_key_raw(modifier, false); // Send DOWN for new modifiers
        }
        for &modifier in old_mods.difference(&new_mods) {
            Self::send_key_raw(modifier, true);  // Send UP for removed modifiers
        }
    }

    fn apply_action(physical_vk: u16, action: &serde_json::Value, is_atomic: bool, config: &Config) {
        let action_type = action.get("type").and_then(|v| v.as_str()).unwrap_or("none");
        match action_type {
            "remap" => {
                if let Some(keys) = action.get("keys").and_then(|v| v.as_array()) {
                    if !keys.is_empty() {
                        let mut target_vks = Vec::new();
                        for k in keys {
                            if let Some(vk) = k.as_u64() {
                                target_vks.push(vk as u16);
                            }
                        }

                        for &target_vk in &target_vks {
                            Self::send_key_down(physical_vk, target_vk);
                        }
                        
                        let repeat = action.get("repeat").and_then(|v| v.as_bool()).unwrap_or(false);
                        let has_non_modifier = target_vks.iter().any(|&vk| !Self::is_modifier(vk));
                        
                        if is_atomic || (!repeat && has_non_modifier) {
                            for &target_vk in target_vks.iter().rev() {
                                Self::send_key_up(physical_vk, target_vk);
                            }
                        }
                    }
                }
            }
            "layerToggle" => {
                if let Some(layer_id) = action.get("layerId").and_then(|v| v.as_str()) {
                    let (old_layers, new_layers) = {
                        let mut state = get_state().lock().unwrap();
                        let old_layers = state.active_layers.clone();
                        if state.active_layers.contains(&layer_id.to_string()) {
                            state.active_layers.retain(|l| l != layer_id);
                        } else {
                            state.active_layers.push(layer_id.to_string());
                        }
                        (old_layers, state.active_layers.clone())
                    };
                    Self::apply_layer_modifiers(&old_layers, &new_layers, config);
                }
            }
            "layerMomentary" => {
                if let Some(layer_id) = action.get("layerId").and_then(|v| v.as_str()) {
                    let (old_layers, new_layers) = {
                        let mut state = get_state().lock().unwrap();
                        let old_layers = state.active_layers.clone();
                        state.momentary_layers.insert(physical_vk, layer_id.to_string());
                        if !state.active_layers.contains(&layer_id.to_string()) {
                            state.active_layers.push(layer_id.to_string());
                        }
                        (old_layers, state.active_layers.clone())
                    };
                    Self::apply_layer_modifiers(&old_layers, &new_layers, config);
                }
            }
            _ => {}
        }
    }

    fn execute_action(cmd: ActionCommand, vk: u16, config: &Config) {
        let active_layers = get_state().lock().unwrap().active_layers.clone();

        match cmd {
            ActionCommand::None => {}
            ActionCommand::ExecuteTap => {
                if let Some(action) = Self::get_action(vk, "tap", config, &active_layers) {
                    Self::apply_action(vk, action, false, config);
                } else {
                    Self::send_key_down(vk, vk);
                    Self::send_key_up(vk, vk);
                }
            }
            ActionCommand::ExecuteTapAtomic => {
                if let Some(action) = Self::get_action(vk, "tap", config, &active_layers) {
                    Self::apply_action(vk, action, true, config);
                } else {
                    Self::send_key_down(vk, vk);
                    Self::send_key_up(vk, vk);
                }
            }
            ActionCommand::ExecuteHold => {
                if let Some(action) = Self::get_action(vk, "hold", config, &active_layers) {
                    Self::apply_action(vk, action, false, config);
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
                                    if !Self::is_modifier(target_vk) {
                                        Self::send_key_down(vk, target_vk);
                                        Self::send_key_up(vk, target_vk);
                                    }
                                }
                            }
                        }
                    }
                }
            }
            ActionCommand::ExecuteDoubleTap => {
                if let Some(action) = Self::get_action(vk, "doubleTap", config, &active_layers) {
                    Self::apply_action(vk, action, false, config);
                }
            }
            ActionCommand::ReleaseTap | ActionCommand::ReleaseHold | ActionCommand::ReleaseDoubleTap => {
                let mut state = get_state().lock().unwrap();
                let vks = state.pressed_vks.remove(&vk).unwrap_or_default();
                for target in vks {
                    Self::send_key_raw(target, true);
                }
                if let Some(layer_id) = state.momentary_layers.remove(&vk) {
                    let old_layers = state.active_layers.clone();
                    state.active_layers.retain(|l| l != &layer_id);
                    let new_layers = state.active_layers.clone();
                    drop(state);
                    Self::apply_layer_modifiers(&old_layers, &new_layers, config);
                    return;
                }
            }
        }
    }

    pub fn process_key(vk_code: u16, is_down: bool, config: &Config) -> HookAction {
        let mut state_guard = get_state().lock().unwrap();
        // println!("DEBUG[process_key]: vk={}, is_down={}", vk_code, is_down);

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

        let (new_state, cmd) = transition(current_state, event, has_hold, has_double_tap);
        println!("DEBUG[transition]: vk={} event={:?} state {:?} -> {:?} (cmd: {:?})", vk_code, event, current_state, new_state, cmd);

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
                        // println!("DEBUG: hold timeout check for vk {} (elapsed: {}, timing: {})", vk, elapsed, timing);
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
                    );
                    println!("DEBUG[timeout]: vk={} state {:?} -> {:?} (cmd: {:?})", vk, key_state, new_state, cmd);
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
                        );
                        println!("DEBUG[custom_repeat]: vk={} state {:?} -> {:?} (cmd: {:?})", vk, key_state, new_state, cmd);
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

    fn send_key_raw(vk: u16, is_up: bool) {
        let dw_flags = if is_up {
            KEYEVENTF_KEYUP
        } else {
            windows::Win32::UI::Input::KeyboardAndMouse::KEYBD_EVENT_FLAGS(0)
        };

        let input = INPUT {
            r#type: INPUT_KEYBOARD,
            Anonymous: INPUT_0 {
                ki: KEYBDINPUT {
                    wVk: windows::Win32::UI::Input::KeyboardAndMouse::VIRTUAL_KEY(vk),
                    wScan: 0,
                    dwFlags: dw_flags,
                    time: 0,
                    dwExtraInfo: 0,
                },
            },
        };
        unsafe {
            SendInput(&[input], std::mem::size_of::<INPUT>() as i32);
        }
    }

    fn send_key_down(physical_vk: u16, virtual_vk: u16) {
        get_state().lock().unwrap().pressed_vks.entry(physical_vk).or_default().push(virtual_vk);
        Self::send_key_raw(virtual_vk, false);
    }

    fn send_key_up(physical_vk: u16, virtual_vk: u16) {
        if let Some(vks) = get_state().lock().unwrap().pressed_vks.get_mut(&physical_vk) {
            vks.retain(|&v| v != virtual_vk);
        }
        Self::send_key_raw(virtual_vk, true);
    }
}
