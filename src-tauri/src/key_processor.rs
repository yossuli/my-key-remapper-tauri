use crate::Config;
use windows::Win32::UI::Input::KeyboardAndMouse::{
    SendInput, INPUT, INPUT_0, INPUT_KEYBOARD, KEYBDINPUT, KEYEVENTF_KEYUP,
};

#[derive(Debug, PartialEq, Eq)]
pub enum HookAction {
    Block,
    PassThrough,
}

pub struct KeyProcessor;

impl KeyProcessor {
    pub fn process_key(vk_code: u16, is_down: bool, config: &Config) -> HookAction {
        let is_up = !is_down;

        // 1. Get base layer (TODO: Layer Stack management)
        let base_layer = match config.layers.iter().find(|l| l.id == "base") {
            Some(layer) => layer,
            None => return HookAction::PassThrough,
        };

        // 2. Find bindings for this key
        let key_bindings = match base_layer.bindings.get(&vk_code.to_string()) {
            Some(bindings) => bindings,
            None => return HookAction::PassThrough,
        };

        // 3. Evaluate tap trigger (TODO: Hold, double tap, etc)
        let binding = match key_bindings.iter().find(|b| b.trigger == "tap") {
            Some(b) => b,
            None => return HookAction::PassThrough,
        };

        // 4. Resolve action type
        let action_type = match binding.action.get("type").and_then(|v| v.as_str()) {
            Some(t) => t,
            None => return HookAction::PassThrough,
        };

        if action_type == "remap" {
            // 5. Extract keys
            if let Some(keys) = binding.action.get("keys").and_then(|v| v.as_array()) {
                if !keys.is_empty() {
                    let target_vk = keys[0].as_u64().unwrap_or(0) as u16;
                    if target_vk > 0 {
                        Self::send_key(target_vk, is_up);
                        return HookAction::Block;
                    }
                }
            }
        }

        HookAction::PassThrough
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
