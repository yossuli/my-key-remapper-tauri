use crate::Config;
use crate::state_machine::{transition, ActionCommand, KeyState, TriggerEvent};
use std::collections::HashMap;
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
}

static STATE: OnceLock<Mutex<ProcessorState>> = OnceLock::new();

fn get_state() -> &'static Mutex<ProcessorState> {
    STATE.get_or_init(|| {
        Mutex::new(ProcessorState {
            key_states: HashMap::new(),
        })
    })
}

pub struct KeyProcessor;

impl KeyProcessor {
    fn get_bindings<'a>(vk: u16, config: &'a Config) -> Option<&'a Vec<crate::Binding>> {
        config
            .layers
            .iter()
            .find(|l| l.id == "base")
            .and_then(|l| l.bindings.get(&vk.to_string()))
    }

    fn has_triggers(vk: u16, config: &Config) -> (bool, bool) {
        if let Some(bindings) = Self::get_bindings(vk, config) {
            let has_hold = bindings.iter().any(|b| b.trigger == "hold");
            let has_double_tap = bindings.iter().any(|b| b.trigger == "doubleTap");
            (has_hold, has_double_tap)
        } else {
            (false, false)
        }
    }

    fn get_target_vk(vk: u16, trigger: &str, config: &Config) -> Option<u16> {
        if let Some(bindings) = Self::get_bindings(vk, config) {
            if let Some(binding) = bindings.iter().find(|b| b.trigger == trigger) {
                if binding.action.get("type").and_then(|v| v.as_str()) == Some("remap") {
                    if let Some(keys) = binding.action.get("keys").and_then(|v| v.as_array()) {
                        if !keys.is_empty() {
                            return keys[0].as_u64().map(|v| v as u16);
                        }
                    }
                }
                // 明示的な設定があるがremap以外（または無効な設定）の場合はNoneを返す
                return None;
            }
        }
        
        // tap設定が省略されている場合、デフォルト動作として元のキーをそのまま送信する
        if trigger == "tap" {
            Some(vk)
        } else {
            None
        }
    }

    fn get_timing(vk: u16, trigger: &str, config: &Config) -> Option<u32> {
        Self::get_bindings(vk, config)
            .and_then(|b| b.iter().find(|x| x.trigger == trigger))
            .and_then(|b| b.timing_ms)
    }

    fn execute_action(cmd: ActionCommand, vk: u16, config: &Config) {
        match cmd {
            ActionCommand::None => {}
            ActionCommand::ExecuteTap => {
                if let Some(target) = Self::get_target_vk(vk, "tap", config) {
                    Self::send_key(target, false);
                }
            }
            ActionCommand::ReleaseTap => {
                if let Some(target) = Self::get_target_vk(vk, "tap", config) {
                    Self::send_key(target, true);
                }
            }
            ActionCommand::ExecuteTapAtomic => {
                if let Some(target) = Self::get_target_vk(vk, "tap", config) {
                    Self::send_key(target, false);
                    Self::send_key(target, true);
                }
            }
            ActionCommand::ExecuteHold => {
                if let Some(target) = Self::get_target_vk(vk, "hold", config) {
                    Self::send_key(target, false);
                }
            }
            ActionCommand::ReleaseHold => {
                if let Some(target) = Self::get_target_vk(vk, "hold", config) {
                    Self::send_key(target, true);
                }
            }
            ActionCommand::ExecuteDoubleTap => {
                if let Some(target) = Self::get_target_vk(vk, "doubleTap", config) {
                    Self::send_key(target, false);
                }
            }
            ActionCommand::ReleaseDoubleTap => {
                if let Some(target) = Self::get_target_vk(vk, "doubleTap", config) {
                    Self::send_key(target, true);
                }
            }
        }
    }

    pub fn process_key(vk_code: u16, is_down: bool, config: &Config) -> HookAction {
        let mut state_guard = get_state().lock().unwrap();

        // 1. Resolve OtherKeyPressed for all OTHER waiting keys
        if is_down {
            let mut other_cmds = Vec::new();
            for (&other_vk, other_state) in state_guard.key_states.iter_mut() {
                if other_vk != vk_code {
                    let (has_hold, has_double_tap) = Self::has_triggers(other_vk, config);
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
            for (other_vk, cmd) in other_cmds {
                Self::execute_action(cmd, other_vk, config);
            }
        }

        // 2. Check if THIS key has bindings
        let has_any_binding = Self::get_bindings(vk_code, config)
            .map(|b| !b.is_empty())
            .unwrap_or(false);

        if !has_any_binding {
            // No bindings for this key, let OS handle it
            return HookAction::PassThrough;
        }

        // 3. Process THIS key
        let (has_hold, has_double_tap) = Self::has_triggers(vk_code, config);
        let current_state = state_guard
            .key_states
            .get(&vk_code)
            .copied()
            .unwrap_or(KeyState::Idle);

        let event = if is_down {
            TriggerEvent::Pressed
        } else {
            TriggerEvent::Released
        };

        let (new_state, cmd) = transition(current_state, event, has_hold, has_double_tap);

        if new_state == KeyState::Idle {
            state_guard.key_states.remove(&vk_code);
        } else {
            state_guard.key_states.insert(vk_code, new_state);
        }

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

            for (&vk, key_state) in state_guard.key_states.iter_mut() {
                let is_timeout = match key_state {
                    KeyState::WaitingForHold { pressed_at } => {
                        let timing = Self::get_timing(vk, "hold", &config).unwrap_or(200);
                        now.duration_since(*pressed_at).as_millis() >= timing as u128
                    }
                    KeyState::WaitingForDoubleTap { first_released_at } => {
                        let timing = Self::get_timing(vk, "doubleTap", &config).unwrap_or(200);
                        now.duration_since(*first_released_at).as_millis() >= timing as u128
                    }
                    _ => false,
                };

                if is_timeout {
                    let (has_hold, has_double_tap) = Self::has_triggers(vk, &config);
                    let (new_state, cmd) = transition(
                        *key_state,
                        TriggerEvent::Timeout,
                        has_hold,
                        has_double_tap,
                    );
                    *key_state = new_state;
                    cmds.push((vk, cmd));
                }
            }

            state_guard.key_states.retain(|_, s| *s != KeyState::Idle);

            for (vk, cmd) in cmds {
                Self::execute_action(cmd, vk, &config);
            }
        });
    }

    fn send_key(vk: u16, is_up: bool) {
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
}
