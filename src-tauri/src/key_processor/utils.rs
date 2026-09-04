use crate::Config;
use std::collections::HashSet;
use windows::Win32::UI::Input::KeyboardAndMouse::{
    SendInput, INPUT, INPUT_0, INPUT_KEYBOARD, KEYBDINPUT, KEYEVENTF_KEYUP, KEYEVENTF_EXTENDEDKEY,
    KEYBD_EVENT_FLAGS,
    INPUT_MOUSE, MOUSEINPUT,
    MOUSEEVENTF_LEFTDOWN, MOUSEEVENTF_LEFTUP, MOUSEEVENTF_RIGHTDOWN, MOUSEEVENTF_RIGHTUP, MOUSEEVENTF_MIDDLEDOWN, MOUSEEVENTF_MIDDLEUP,
    MOUSEEVENTF_WHEEL, MOUSEEVENTF_HWHEEL
};
use super::state::get_state;

pub const VK_CANCEL: u16 = 0x03;
pub const VK_SHIFT: u16 = 0x10;
pub const VK_CONTROL: u16 = 0x11;
pub const VK_MENU: u16 = 0x12; // Alt
pub const VK_PRIOR: u16 = 0x21; // Page Up
pub const VK_NEXT: u16 = 0x22;  // Page Down
pub const VK_END: u16 = 0x23;
pub const VK_HOME: u16 = 0x24;
pub const VK_LEFT: u16 = 0x25;
pub const VK_UP: u16 = 0x26;
pub const VK_RIGHT: u16 = 0x27;
pub const VK_DOWN: u16 = 0x28;
pub const VK_SNAPSHOT: u16 = 0x2C; // Print Screen
pub const VK_INSERT: u16 = 0x2D;
pub const VK_DELETE: u16 = 0x2E;
pub const VK_LWIN: u16 = 0x5B;
pub const VK_RWIN: u16 = 0x5C;
pub const VK_APPS: u16 = 0x5D;
pub const VK_DIVIDE: u16 = 0x6F; // Numpad /
pub const VK_NUMLOCK: u16 = 0x90;
pub const VK_LSHIFT: u16 = 0xA0;
pub const VK_RSHIFT: u16 = 0xA1;
pub const VK_LCONTROL: u16 = 0xA2;
pub const VK_RCONTROL: u16 = 0xA3;
pub const VK_LMENU: u16 = 0xA4;
pub const VK_RMENU: u16 = 0xA5;

// メディア・ブラウザ・アプリ起動キー
pub const VK_BROWSER_BACK: u16 = 0xA6;
pub const VK_BROWSER_FORWARD: u16 = 0xA7;
pub const VK_BROWSER_REFRESH: u16 = 0xA8;
pub const VK_BROWSER_STOP: u16 = 0xA9;
pub const VK_BROWSER_SEARCH: u16 = 0xAA;
pub const VK_BROWSER_FAVORITES: u16 = 0xAB;
pub const VK_BROWSER_HOME: u16 = 0xAC;
pub const VK_VOLUME_MUTE: u16 = 0xAD;
pub const VK_VOLUME_DOWN: u16 = 0xAE;
pub const VK_VOLUME_UP: u16 = 0xAF;
pub const VK_MEDIA_NEXT_TRACK: u16 = 0xB0;
pub const VK_MEDIA_PREV_TRACK: u16 = 0xB1;
pub const VK_MEDIA_STOP: u16 = 0xB2;
pub const VK_MEDIA_PLAY_PAUSE: u16 = 0xB3;
pub const VK_LAUNCH_MAIL: u16 = 0xB4;
pub const VK_LAUNCH_MEDIA_SELECT: u16 = 0xB5;
pub const VK_LAUNCH_APP1: u16 = 0xB6;
pub const VK_LAUNCH_APP2: u16 = 0xB7;

/// 自プロセスが注入した入力であることを示すマジックナンバー ("TAUR")
pub const INJECTED_SIGNATURE: usize = 0x54415552;

pub fn is_modifier(vk: u16) -> bool {
    matches!(vk, VK_SHIFT | VK_CONTROL | VK_MENU | VK_LWIN | VK_RWIN | VK_LSHIFT | VK_RSHIFT | VK_LCONTROL | VK_RCONTROL | VK_LMENU | VK_RMENU)
}

/// 拡張キー（KEYEVENTF_EXTENDEDKEY フラグが必要なキー）であるかを判定
pub fn is_extended_key(vk: u16) -> bool {
    matches!(
        vk,
        VK_PRIOR
            | VK_NEXT
            | VK_END
            | VK_HOME
            | VK_LEFT
            | VK_UP
            | VK_RIGHT
            | VK_DOWN
            | VK_SNAPSHOT
            | VK_INSERT
            | VK_DELETE
            | VK_LWIN
            | VK_RWIN
            | VK_APPS
            | VK_DIVIDE
            | VK_NUMLOCK
            | VK_RCONTROL
            | VK_RMENU
            | VK_CANCEL
            | VK_BROWSER_BACK..=VK_LAUNCH_APP2
    )
}

#[cfg(windows)]
pub fn build_keybd_input(vk: u16, is_up: bool) -> KEYBDINPUT {
    let mut dw_flags = if is_up {
        KEYEVENTF_KEYUP
    } else {
        KEYBD_EVENT_FLAGS(0)
    };

    if is_extended_key(vk) {
        dw_flags |= KEYEVENTF_EXTENDEDKEY;
    }

    let scan = unsafe {
        windows::Win32::UI::Input::KeyboardAndMouse::MapVirtualKeyW(
            vk as u32,
            windows::Win32::UI::Input::KeyboardAndMouse::MAPVK_VK_TO_VSC,
        )
    } as u16;

    KEYBDINPUT {
        wVk: windows::Win32::UI::Input::KeyboardAndMouse::VIRTUAL_KEY(vk),
        wScan: scan,
        dwFlags: dw_flags,
        time: 0,
        dwExtraInfo: INJECTED_SIGNATURE,
    }
}

pub fn send_key_raw(vk: u16, is_up: bool) {
    #[cfg(windows)]
    {
        let ki = build_keybd_input(vk, is_up);
        let input = INPUT {
            r#type: INPUT_KEYBOARD,
            Anonymous: INPUT_0 { ki },
        };
        unsafe {
            SendInput(&[input], std::mem::size_of::<INPUT>() as i32);
        }
    }
    #[cfg(not(windows))]
    {
        let _ = (vk, is_up);
    }
}

pub fn send_key_atomic(virtual_vk: u16) {
    #[cfg(windows)]
    {
        let ki_down = build_keybd_input(virtual_vk, false);
        let ki_up = build_keybd_input(virtual_vk, true);
        let inputs = [
            INPUT {
                r#type: INPUT_KEYBOARD,
                Anonymous: INPUT_0 { ki: ki_down },
            },
            INPUT {
                r#type: INPUT_KEYBOARD,
                Anonymous: INPUT_0 { ki: ki_up },
            },
        ];
        unsafe {
            SendInput(&inputs, std::mem::size_of::<INPUT>() as i32);
        }
    }
    #[cfg(not(windows))]
    {
        send_key_raw(virtual_vk, false);
        send_key_raw(virtual_vk, true);
    }
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

    // 自己修復の対象は「OSにDOWNを送信したまま戻っていないキー (pressed_vks)」と
    // 「解除されなくなったモメンタリレイヤー (momentary_layers)」のみに限定する。
    // key_states (ステートマシン) は WaitingForDoubleTap など物理キーが離されているのが
    // 正常な待機状態を含むため、絶対にここから削除してはならない！
    let tracked_keys: Vec<u16> = {
        let state = get_state().lock().unwrap();
        let mut keys: std::collections::HashSet<u16> = state.pressed_vks.keys().copied().collect();
        for &k in state.momentary_layers.keys() {
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

    let passthrough_keys = {
        let state = get_state().lock().unwrap();
        state.passthrough_trigger_keys.clone()
    };

    for &modifier in new_mods.difference(&old_mods) {
        let already_physically_down = match modifier {
            VK_LSHIFT => passthrough_keys.contains(&160) || passthrough_keys.contains(&161),
            VK_LCONTROL => passthrough_keys.contains(&162) || passthrough_keys.contains(&163),
            VK_LMENU => passthrough_keys.contains(&164) || passthrough_keys.contains(&165),
            VK_LWIN => passthrough_keys.contains(&91) || passthrough_keys.contains(&92),
            _ => passthrough_keys.contains(&modifier),
        };

        if !already_physically_down {
            send_key_raw(modifier, false); // Send DOWN for new modifiers
        }
    }
    for &modifier in old_mods.difference(&new_mods) {
        send_key_raw(modifier, true);  // Send UP for removed modifiers
    }
}

/// リマップ対象のキー（target_vks）に含まれない、現在アクティブな修飾キーおよびパススルートリガーキーを取得し、一時的にUPを送信する
pub fn suppress_active_modifiers_for_remap(physical_vk: u16, target_vks: &[u16], config: &Config) -> Vec<u16> {
    let (active_layers, passthrough_keys) = {
        let state = get_state().lock().unwrap();
        (state.active_layers.clone(), state.passthrough_trigger_keys.clone())
    };

    let active_mods = compute_active_modifiers(&active_layers, config);
    let mut to_suppress = Vec::new();

    // 1. DefaultModifiers から、リマップ先キーに含まれていないものを収集
    for &m in &active_mods {
        let is_target_mod = target_vks.contains(&m)
            || (m == VK_LSHIFT && target_vks.contains(&161))
            || (m == VK_LCONTROL && target_vks.contains(&163))
            || (m == VK_LMENU && target_vks.contains(&165))
            || (m == VK_LWIN && target_vks.contains(&92));

        if !is_target_mod && !to_suppress.contains(&m) {
            to_suppress.push(m);
        }
    }

    // 2. パススルートリガーキーから、リマップ先キーに含まれていないものを収集
    for &pt_vk in &passthrough_keys {
        if pt_vk != physical_vk {
            let is_target_mod = target_vks.contains(&pt_vk)
                || (is_shift(pt_vk) && target_vks.iter().any(|&k| is_shift(k)))
                || (is_ctrl(pt_vk) && target_vks.iter().any(|&k| is_ctrl(k)))
                || (is_alt(pt_vk) && target_vks.iter().any(|&k| is_alt(k)))
                || (is_win(pt_vk) && target_vks.iter().any(|&k| is_win(k)));

            if !is_target_mod && !to_suppress.contains(&pt_vk) {
                to_suppress.push(pt_vk);
            }
        }
    }

    // 一時的に UP を送信して無効化
    for &m in &to_suppress {
        log::debug!("suppress modifier before remap: vk={}", m);
        send_key_raw(m, true);
    }

    to_suppress
}

fn is_shift(vk: u16) -> bool { vk == 16 || vk == 160 || vk == 161 }
fn is_ctrl(vk: u16) -> bool { vk == 17 || vk == 162 || vk == 163 }
fn is_alt(vk: u16) -> bool { vk == 18 || vk == 164 || vk == 165 }
fn is_win(vk: u16) -> bool { vk == 91 || vk == 92 }

/// 一時的にUPされていた修飾キー・トリガーキーを再度DOWNにして復元する
pub fn restore_suppressed_modifiers(suppressed: &[u16]) {
    for &m in suppressed {
        log::debug!("restore modifier after remap: vk={}", m);
        send_key_raw(m, false);
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
                mi: MOUSEINPUT { dx: 0, dy: 0, mouseData: 0, dwFlags: down_flag, time: 0, dwExtraInfo: INJECTED_SIGNATURE },
            },
        });
        inputs.push(INPUT {
            r#type: INPUT_MOUSE,
            Anonymous: INPUT_0 {
                mi: MOUSEINPUT { dx: 0, dy: 0, mouseData: 0, dwFlags: up_flag, time: 0, dwExtraInfo: INJECTED_SIGNATURE },
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
                    dwExtraInfo: INJECTED_SIGNATURE,
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
                    dwExtraInfo: INJECTED_SIGNATURE,
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
    use std::sync::Mutex as StdMutex;

    static TEST_LOCK: StdMutex<()> = StdMutex::new(());

    #[test]
    fn test_pressed_vks_empty_entry_removed() {
        let _lock = TEST_LOCK.lock().unwrap();
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
        let _lock = TEST_LOCK.lock().unwrap();
        send_key_down(0x50, 0x60);
        send_key_down(0x51, 0x61);

        release_all_virtual_keys();

        let state = get_state().lock().unwrap();
        assert!(state.pressed_vks.is_empty());
        assert!(state.key_states.is_empty());
        assert_eq!(state.active_layers, vec!["base".to_string()]);
    }

    #[test]
    #[cfg(windows)]
    fn test_reconcile_physical_keys_preserves_waiting_for_double_tap() {
        let _lock = TEST_LOCK.lock().unwrap();
        use crate::state_machine::KeyState;
        let dummy_vk = 0xFE; // テスト用VK (物理的に押されていないキー)
        {
            let mut state = get_state().lock().unwrap();
            state.key_states.insert(
                dummy_vk,
                KeyState::WaitingForDoubleTap {
                    first_released_at: std::time::Instant::now(),
                },
            );
        }

        reconcile_physical_keys();

        {
            let mut state = get_state().lock().unwrap();
            // key_states に WaitingForDoubleTap が誤って削除されず残っていること！
            assert!(state.key_states.contains_key(&dummy_vk));
            state.key_states.remove(&dummy_vk); // クリーンアップ
        }
    }

    #[test]
    #[cfg(windows)]
    fn test_reconcile_physical_keys_cleans_unpressed_vks() {
        let _lock = TEST_LOCK.lock().unwrap();
        let dummy_vk = 0xFE; // テスト用VK (物理的に押されていないキー)
        let virtual_vk = 0xFD;

        send_key_down(dummy_vk, virtual_vk);
        {
            let state = get_state().lock().unwrap();
            assert!(state.pressed_vks.contains_key(&dummy_vk));
        }

        reconcile_physical_keys();

        {
            let state = get_state().lock().unwrap();
            // 物理的に押されていない dummy_vk は pressed_vks から自己修復で解放されること
            assert!(!state.pressed_vks.contains_key(&dummy_vk));
        }
    }

    #[test]
    fn test_suppress_active_modifiers_for_remap() {
        let _lock = TEST_LOCK.lock().unwrap();
        let config = crate::get_default_config();

        // 1. Shiftレイヤーがアクティブな状態で、LeftArrow(0x25)へリマップ
        {
            let mut state = get_state().lock().unwrap();
            state.active_layers = vec!["base".to_string(), "shift".to_string()];
            state.passthrough_trigger_keys.insert(160); // VK_LSHIFT
        }

        let target_vks = vec![0x25]; // Left arrow (Shiftは含まない)
        let suppressed = suppress_active_modifiers_for_remap(0x48, &target_vks, &config);

        // Shift (VK_LSHIFT = 160) が抑制対象として取得されていること
        assert!(suppressed.contains(&160));

        // 2. リマップ先キーにShiftが含まれている場合は抑制対象にならないこと
        let target_vks_with_shift = vec![160, 0x25];
        let suppressed_with_shift = suppress_active_modifiers_for_remap(0x48, &target_vks_with_shift, &config);
        assert!(!suppressed_with_shift.contains(&160));

        // クリーンアップ
        {
            let mut state = get_state().lock().unwrap();
            state.active_layers = vec!["base".to_string()];
            state.passthrough_trigger_keys.clear();
        }
    }

    #[test]
    fn test_is_extended_key() {
        // 拡張キーに該当するキー
        let extended_keys = [
            VK_LEFT, VK_UP, VK_RIGHT, VK_DOWN,
            VK_PRIOR, VK_NEXT, VK_END, VK_HOME,
            VK_INSERT, VK_DELETE,
            VK_DIVIDE, VK_NUMLOCK,
            VK_RCONTROL, VK_RMENU,
            VK_LWIN, VK_RWIN, VK_APPS,
            VK_SNAPSHOT, VK_CANCEL,
            VK_VOLUME_MUTE, VK_VOLUME_UP, VK_VOLUME_DOWN,
            VK_MEDIA_PLAY_PAUSE, VK_MEDIA_NEXT_TRACK,
            VK_BROWSER_BACK, VK_BROWSER_FORWARD,
        ];
        for &vk in &extended_keys {
            assert!(is_extended_key(vk), "Key 0x{:X} should be recognized as extended key", vk);
        }

        // 拡張キーに該当しない通常キー
        let non_extended_keys = [
            0x41, // 'A'
            0x30, // '0'
            0x0D, // VK_RETURN
            0x20, // VK_SPACE
            0x08, // VK_BACK
            0x09, // VK_TAB
            VK_LSHIFT,
            VK_RSHIFT,
            VK_LCONTROL,
            VK_LMENU,
            VK_SHIFT,
            VK_CONTROL,
            VK_MENU,
        ];
        for &vk in &non_extended_keys {
            assert!(!is_extended_key(vk), "Key 0x{:X} should not be recognized as extended key", vk);
        }
    }

    #[test]
    #[cfg(windows)]
    fn test_build_keybd_input_extended_key() {
        // 1. 矢印キー（VK_LEFT: 0x25）の KeyDown
        let input_down = build_keybd_input(VK_LEFT, false);
        assert_eq!(input_down.wVk.0, VK_LEFT);
        assert_eq!(input_down.dwExtraInfo, INJECTED_SIGNATURE);
        assert_eq!(input_down.dwFlags & KEYEVENTF_EXTENDEDKEY, KEYEVENTF_EXTENDEDKEY);
        assert_eq!(input_down.dwFlags & KEYEVENTF_KEYUP, windows::Win32::UI::Input::KeyboardAndMouse::KEYBD_EVENT_FLAGS(0));

        // 2. 矢印キー（VK_LEFT: 0x25）の KeyUp
        let input_up = build_keybd_input(VK_LEFT, true);
        assert_eq!(input_up.wVk.0, VK_LEFT);
        assert_eq!(input_up.dwExtraInfo, INJECTED_SIGNATURE);
        assert_eq!(input_up.dwFlags & KEYEVENTF_EXTENDEDKEY, KEYEVENTF_EXTENDEDKEY);
        assert_eq!(input_up.dwFlags & KEYEVENTF_KEYUP, KEYEVENTF_KEYUP);

        // 3. 通常キー（'A': 0x41）の KeyDown
        let normal_down = build_keybd_input(0x41, false);
        assert_eq!(normal_down.wVk.0, 0x41);
        assert_eq!(normal_down.dwExtraInfo, INJECTED_SIGNATURE);
        assert_ne!(normal_down.dwFlags & KEYEVENTF_EXTENDEDKEY, KEYEVENTF_EXTENDEDKEY);
        assert_eq!(normal_down.dwFlags & KEYEVENTF_KEYUP, windows::Win32::UI::Input::KeyboardAndMouse::KEYBD_EVENT_FLAGS(0));

        // 4. 通常キー（'A': 0x41）の KeyUp
        let normal_up = build_keybd_input(0x41, true);
        assert_eq!(normal_up.wVk.0, 0x41);
        assert_eq!(normal_up.dwExtraInfo, INJECTED_SIGNATURE);
        assert_ne!(normal_up.dwFlags & KEYEVENTF_EXTENDEDKEY, KEYEVENTF_EXTENDEDKEY);
        assert_eq!(normal_up.dwFlags & KEYEVENTF_KEYUP, KEYEVENTF_KEYUP);
    }

    #[test]
    fn test_injected_signature_filtering_logic() {
        // 自プロセス注入: flags に 0x10 があり、dwExtraInfo == INJECTED_SIGNATURE
        let flags_injected = 0x10u32;
        let self_extra_info = INJECTED_SIGNATURE;
        let is_injected = (flags_injected & 0x10) != 0;
        let is_self_injected = is_injected && self_extra_info == INJECTED_SIGNATURE;
        assert!(is_self_injected, "Self-injected input must be recognized as self-injected");

        // 外部ツール注入: flags に 0x10 があるが、dwExtraInfo != INJECTED_SIGNATURE (例: 0 や別ツールの値)
        let ext_extra_info = 0usize;
        let is_ext_self_injected = is_injected && ext_extra_info == INJECTED_SIGNATURE;
        assert!(!is_ext_self_injected, "External tool injected input must NOT be recognized as self-injected");

        // 物理キー入力: flags に 0x10 がない
        let flags_physical = 0x00u32;
        let is_phys_injected = (flags_physical & 0x10) != 0;
        let is_phys_self_injected = is_phys_injected && ext_extra_info == INJECTED_SIGNATURE;
        assert!(!is_phys_self_injected, "Physical key input must NOT be recognized as self-injected");
    }
}

