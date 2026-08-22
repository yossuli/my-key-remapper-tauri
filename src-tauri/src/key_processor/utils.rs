use crate::Config;
use std::collections::HashSet;
use windows::Win32::UI::Input::KeyboardAndMouse::{
    SendInput, INPUT, INPUT_0, INPUT_KEYBOARD, KEYBDINPUT, KEYEVENTF_KEYUP,
    INPUT_MOUSE, MOUSEINPUT, MOUSEEVENTF_MOVE, MOUSEEVENTF_ABSOLUTE,
    MOUSEEVENTF_LEFTDOWN, MOUSEEVENTF_LEFTUP, MOUSEEVENTF_RIGHTDOWN, MOUSEEVENTF_RIGHTUP, MOUSEEVENTF_MIDDLEDOWN, MOUSEEVENTF_MIDDLEUP
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

pub fn send_key_down(physical_vk: u16, virtual_vk: u16) {
    get_state().lock().unwrap().pressed_vks.entry(physical_vk).or_default().push(virtual_vk);
    send_key_raw(virtual_vk, false);
}

pub fn send_key_up(physical_vk: u16, virtual_vk: u16) {
    if let Some(vks) = get_state().lock().unwrap().pressed_vks.get_mut(&physical_vk) {
        vks.retain(|&v| v != virtual_vk);
    }
    send_key_raw(virtual_vk, true);
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

use windows::Win32::UI::WindowsAndMessaging::{SetCursorPos, GetCursorPos};
use windows::Win32::Foundation::POINT;

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
