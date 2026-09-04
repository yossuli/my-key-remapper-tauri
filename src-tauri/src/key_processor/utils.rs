use crate::Config;
use std::collections::HashSet;
use windows::Win32::UI::Input::KeyboardAndMouse::{
    SendInput, INPUT, INPUT_0, INPUT_KEYBOARD, KEYBDINPUT, KEYEVENTF_KEYUP,
    INPUT_MOUSE, MOUSEINPUT,
    MOUSEEVENTF_LEFTDOWN, MOUSEEVENTF_LEFTUP, MOUSEEVENTF_RIGHTDOWN, MOUSEEVENTF_RIGHTUP, MOUSEEVENTF_MIDDLEDOWN, MOUSEEVENTF_MIDDLEUP,
    MOUSEEVENTF_WHEEL, MOUSEEVENTF_HWHEEL
};
use super::state::get_state;

pub const VK_SHIFT: u16 = 0x10;
pub const VK_CONTROL: u16 = 0x11;
pub const VK_MENU: u16 = 0x12; // Alt
pub const VK_LWIN: u16 = 0x5B;
pub const VK_RWIN: u16 = 0x5C;
pub const VK_LSHIFT: u16 = 0xA0;
pub const VK_RSHIFT: u16 = 0xA1;
pub const VK_LCONTROL: u16 = 0xA2;
pub const VK_RCONTROL: u16 = 0xA3;
pub const VK_LMENU: u16 = 0xA4;
pub const VK_RMENU: u16 = 0xA5;

pub fn is_modifier(vk: u16) -> bool {
    matches!(vk, VK_SHIFT | VK_CONTROL | VK_MENU | VK_LWIN | VK_RWIN | VK_LSHIFT | VK_RSHIFT | VK_LCONTROL | VK_RCONTROL | VK_LMENU | VK_RMENU)
}

pub fn send_key_raw(vk: u16, is_up: bool) {
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

pub fn send_key_atomic(virtual_vk: u16) {
    send_key_raw(virtual_vk, false);
    send_key_raw(virtual_vk, true);
}

pub fn send_key_down(physical_vk: u16, virtual_vk: u16) {
    get_state().lock().unwrap().pressed_vks.entry(physical_vk).or_default().push(virtual_vk);
    send_key_raw(virtual_vk, false);
}

pub fn send_key_up(physical_vk: u16, virtual_vk: u16) {
    {
        let mut state = get_state().lock().unwrap();
        let is_empty = if let Some(vks) = state.pressed_vks.get_mut(&physical_vk) {
            vks.retain(|&v| v != virtual_vk);
            vks.is_empty()
        } else {
            false
        };
        if is_empty {
            state.pressed_vks.remove(&physical_vk);
        }
    }
    send_key_raw(virtual_vk, true);
}

pub fn release_all_virtual_keys() {
    let (targets_to_release, _active_layers) = {
        let mut state = get_state().lock().unwrap();
        let mut targets = Vec::new();
        for (_physical, vks) in state.pressed_vks.drain() {
            for vk in vks {
                targets.push(vk);
            }
        }
        state.key_states.clear();
        state.momentary_layers.clear();
        state.active_layers = vec!["base".to_string()];
        (targets, state.active_layers.clone())
    };

    for vk in targets_to_release {
        send_key_raw(vk, true);
    }

    #[cfg(windows)]
    {
        let common_modifiers = [
            windows::Win32::UI::Input::KeyboardAndMouse::VK_LSHIFT.0,
            windows::Win32::UI::Input::KeyboardAndMouse::VK_RSHIFT.0,
            windows::Win32::UI::Input::KeyboardAndMouse::VK_LCONTROL.0,
            windows::Win32::UI::Input::KeyboardAndMouse::VK_RCONTROL.0,
            windows::Win32::UI::Input::KeyboardAndMouse::VK_LMENU.0,
            windows::Win32::UI::Input::KeyboardAndMouse::VK_RMENU.0,
            windows::Win32::UI::Input::KeyboardAndMouse::VK_LWIN.0,
            windows::Win32::UI::Input::KeyboardAndMouse::VK_RWIN.0,
        ];
        for vk in common_modifiers {
            send_key_raw(vk, true);
        }
    }
}

#[cfg(windows)]
pub fn reconcile_physical_keys() {
    use windows::Win32::UI::Input::KeyboardAndMouse::GetAsyncKeyState;

    let tracked_keys: Vec<u16> = {
        let state = get_state().lock().unwrap();
        let mut keys: std::collections::HashSet<u16> = state.key_states.keys().copied().collect();
        for &k in state.pressed_vks.keys() {
            keys.insert(k);
        }
        keys.into_iter().collect()
    };

    if tracked_keys.is_empty() {
        return;
    }

    let mut released_physical_keys = Vec::new();
    for vk in tracked_keys {
        let state_val = unsafe { GetAsyncKeyState(vk as i32) };
        if (state_val as u16 & 0x8000) == 0 {
            released_physical_keys.push(vk);
        }
    }

    if released_physical_keys.is_empty() {
        return;
    }

    let targets_to_up = {
        let mut state = get_state().lock().unwrap();
        let mut targets = Vec::new();
        for vk in released_physical_keys {
            state.key_states.remove(&vk);
            if let Some(vks) = state.pressed_vks.remove(&vk) {
                targets.extend(vks);
            }
            if let Some(layer_id) = state.momentary_layers.remove(&vk) {
                state.active_layers.retain(|l| l != &layer_id);
            }
        }
        targets
    };

    for target in targets_to_up {
        send_key_raw(target, true);
    }
}


pub fn compute_active_modifiers(active_layers: &[String], config: &Config) -> HashSet<u16> {
    let mut mods = HashSet::new();
    for layer_id in active_layers {
        if let Some(layer) = config.layers.iter().find(|l| &l.id == layer_id) {
            if let Some(def_mods) = &layer.default_modifiers {
                if let Some(shift) = def_mods.get("shift").and_then(|v| v.as_bool()) {
                    if shift { mods.insert(VK_LSHIFT); }
                }
                if let Some(ctrl) = def_mods.get("ctrl").and_then(|v| v.as_bool()) {
                    if ctrl { mods.insert(VK_LCONTROL); }
                }
                if let Some(alt) = def_mods.get("alt").and_then(|v| v.as_bool()) {
                    if alt { mods.insert(VK_LMENU); }
                }
                if let Some(win) = def_mods.get("win").and_then(|v| v.as_bool()) {
                    if win { mods.insert(VK_LWIN); }
                }
            }
        }
    }
    mods
}

pub fn apply_layer_modifiers(old_layers: &[String], new_layers: &[String], config: &Config) {
    let old_mods = compute_active_modifiers(old_layers, config);
    let new_mods = compute_active_modifiers(new_layers, config);

    for &modifier in new_mods.difference(&old_mods) {
        send_key_raw(modifier, false); // Send DOWN for new modifiers
    }
    for &modifier in old_mods.difference(&new_mods) {
        send_key_raw(modifier, true);  // Send UP for removed modifiers
    }
}

use windows::Win32::UI::WindowsAndMessaging::{SetCursorPos, GetCursorPos, GetSystemMetrics, SM_CXSCREEN, SM_CYSCREEN};
use windows::Win32::Foundation::POINT;

pub fn get_screen_size() -> (i32, i32) {
    let width = unsafe { GetSystemMetrics(SM_CXSCREEN) };
    let height = unsafe { GetSystemMetrics(SM_CYSCREEN) };
    (width, height)
}

pub fn get_mouse_pos() -> (i32, i32) {
    let mut pt = POINT { x: 0, y: 0 };
    unsafe {
        let _ = GetCursorPos(&mut pt);
    }
    (pt.x, pt.y)
}

pub fn send_mouse_move(x: i32, y: i32) {
    log::info!("send_mouse_move: x={}, y={}", x, y);
    unsafe {
        let result = SetCursorPos(x, y);
        log::info!("SetCursorPos result: {:?}", result);
    }
}

pub fn send_mouse_click(button: &str, click_count: u32) {
    log::info!("send_mouse_click: button={}, count={}", button, click_count);
    let (down_flag, up_flag) = match button {
        "right" => (MOUSEEVENTF_RIGHTDOWN, MOUSEEVENTF_RIGHTUP),
        "middle" => (MOUSEEVENTF_MIDDLEDOWN, MOUSEEVENTF_MIDDLEUP),
        _ => (MOUSEEVENTF_LEFTDOWN, MOUSEEVENTF_LEFTUP),
    };

    let mut inputs = Vec::new();
    for _ in 0..click_count.max(1) {
        inputs.push(INPUT {
            r#type: INPUT_MOUSE,
            Anonymous: INPUT_0 {
                mi: MOUSEINPUT { dx: 0, dy: 0, mouseData: 0, dwFlags: down_flag, time: 0, dwExtraInfo: 0 },
            },
        });
        inputs.push(INPUT {
            r#type: INPUT_MOUSE,
            Anonymous: INPUT_0 {
                mi: MOUSEINPUT { dx: 0, dy: 0, mouseData: 0, dwFlags: up_flag, time: 0, dwExtraInfo: 0 },
            },
        });
    }

    unsafe {
        let result = SendInput(&inputs, std::mem::size_of::<INPUT>() as i32);
        log::info!("send_mouse_click result: {}", result);
    }
}

pub fn send_mouse_wheel(delta_y: i32, delta_x: i32) {
    let mut inputs = Vec::new();

    if delta_y != 0 {
        inputs.push(INPUT {
            r#type: INPUT_MOUSE,
            Anonymous: INPUT_0 {
                mi: MOUSEINPUT {
                    dx: 0,
                    dy: 0,
                    mouseData: delta_y as u32,
                    dwFlags: MOUSEEVENTF_WHEEL,
                    time: 0,
                    dwExtraInfo: 0,
                },
            },
        });
    }

    if delta_x != 0 {
        inputs.push(INPUT {
            r#type: INPUT_MOUSE,
            Anonymous: INPUT_0 {
                mi: MOUSEINPUT {
                    dx: 0,
                    dy: 0,
                    mouseData: delta_x as u32,
                    dwFlags: MOUSEEVENTF_HWHEEL,
                    time: 0,
                    dwExtraInfo: 0,
                },
            },
        });
    }

    if !inputs.is_empty() {
        unsafe {
            let _ = SendInput(&inputs, std::mem::size_of::<INPUT>() as i32);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_pressed_vks_empty_entry_removed() {
        let physical = 0x41; // 'A'
        let virtual_k = 0x42; // 'B'

        send_key_down(physical, virtual_k);
        {
            let state = get_state().lock().unwrap();
            assert!(state.pressed_vks.contains_key(&physical));
            assert_eq!(state.pressed_vks.get(&physical), Some(&vec![virtual_k]));
        }

        send_key_up(physical, virtual_k);
        {
            let state = get_state().lock().unwrap();
            // 空になったらキー自体が完全に削除されていること
            assert!(!state.pressed_vks.contains_key(&physical));
        }
    }

    #[test]
    fn test_release_all_virtual_keys() {
        send_key_down(0x50, 0x60);
        send_key_down(0x51, 0x61);

        release_all_virtual_keys();

        let state = get_state().lock().unwrap();
        assert!(state.pressed_vks.is_empty());
        assert!(state.key_states.is_empty());
        assert_eq!(state.active_layers, vec!["base".to_string()]);
    }
}

