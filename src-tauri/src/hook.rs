use std::sync::atomic::{AtomicPtr, Ordering};
use std::sync::OnceLock;
use tauri::{AppHandle, Emitter};
use windows::Win32::Foundation::{LRESULT, WPARAM, LPARAM};
use windows::Win32::UI::WindowsAndMessaging::{
    SetWindowsHookExW, UnhookWindowsHookEx, CallNextHookEx,
    WH_KEYBOARD_LL, HHOOK, KBDLLHOOKSTRUCT
};
use windows::Win32::UI::Input::KeyboardAndMouse::{
    SendInput, INPUT, INPUT_0, INPUT_KEYBOARD, KEYBDINPUT,
    KEYEVENTF_KEYUP
};
use tauri::Manager;
use crate::ConfigState;
use std::sync::atomic::AtomicBool;

static HOOK_HANDLE: AtomicPtr<std::ffi::c_void> = AtomicPtr::new(std::ptr::null_mut());
static APP_HANDLE: OnceLock<AppHandle> = OnceLock::new();
pub static REMAP_ENABLED: AtomicBool = AtomicBool::new(false);

pub fn setup_hook(app: AppHandle) {
    let _ = APP_HANDLE.set(app);
    unsafe {
        let hook = SetWindowsHookExW(
            WH_KEYBOARD_LL,
            Some(keyboard_proc),
            None,
            0,
        ).unwrap();

        HOOK_HANDLE.store(hook.0 as *mut _, Ordering::SeqCst);
    }
}

pub fn teardown_hook() {
    let handle = HOOK_HANDLE.swap(std::ptr::null_mut(), Ordering::SeqCst);
    if !handle.is_null() {
        unsafe {
            let _ = UnhookWindowsHookEx(HHOOK(handle as *mut _));
        }
    }
}

unsafe extern "system" fn keyboard_proc(code: i32, wparam: WPARAM, lparam: LPARAM) -> LRESULT {
    if code >= 0 {
        let kb_struct = *(lparam.0 as *const KBDLLHOOKSTRUCT);
        let vk_code = kb_struct.vkCode;

        // Window messages for keyboard
        const WM_KEYDOWN: u32 = 0x0100;
        const WM_KEYUP: u32 = 0x0101;
        const WM_SYSKEYDOWN: u32 = 0x0104;
        const WM_SYSKEYUP: u32 = 0x0105;

        let is_down = wparam.0 as u32 == WM_KEYDOWN || wparam.0 as u32 == WM_SYSKEYDOWN;
        let is_up = wparam.0 as u32 == WM_KEYUP || wparam.0 as u32 == WM_SYSKEYUP;

        let flags = kb_struct.flags.0;
        let is_injected = (flags & 0x10) != 0; // LLKHF_INJECTED

        if (is_down || is_up) && !is_injected {
            if let Some(app) = APP_HANDLE.get() {
                // FEへの通知 (非同期で実行してメインスレッドのメッセージループをブロックしないようにする)
                let app_clone = app.clone();
                tauri::async_runtime::spawn(async move {
                    let _ = app_clone.emit("key-event", serde_json::json!({
                        "vkCode": vk_code,
                        "isUp": is_up
                    }));
                });

                let remap_enabled = REMAP_ENABLED.load(Ordering::SeqCst);

                if remap_enabled {
                    println!("[Rust Hook] Key Intercepted - VK: {}, Down: {}", vk_code, is_down);
                } else {
                    let handle = HOOK_HANDLE.load(Ordering::SeqCst);
                    return CallNextHookEx(HHOOK(handle as *mut _), code, wparam, lparam);
                }

                // リマップ判定
                let state = app.state::<ConfigState>();
                let config = state.config.load();

                // TODO: Layer stack management (currently just uses base layer)
                if let Some(base_layer) = config.layers.iter().find(|l| l.id == "base") {
                    if let Some(key_bindings) = base_layer.bindings.get(&vk_code.to_string()) {
                        // Find tap trigger
                        if let Some(binding) = key_bindings.iter().find(|b| b.trigger == "tap") {
                            if binding.action.get("type").and_then(|v| v.as_str()) == Some("remap") {
                                if let Some(keys) = binding.action.get("keys").and_then(|v| v.as_array()) {
                                    if !keys.is_empty() {
                                        // リマップ先のキーを取得 (単一キーのみ対応版)
                                        let target_vk = keys[0].as_u64().unwrap_or(0) as u16;
                                        if target_vk > 0 {
                                            // SendInputの実行
                                            let input = INPUT {
                                                r#type: INPUT_KEYBOARD,
                                                Anonymous: INPUT_0 {
                                                    ki: KEYBDINPUT {
                                                        wVk: windows::Win32::UI::Input::KeyboardAndMouse::VIRTUAL_KEY(target_vk),
                                                        wScan: 0,
                                                        dwFlags: if is_up { KEYEVENTF_KEYUP } else { windows::Win32::UI::Input::KeyboardAndMouse::KEYBD_EVENT_FLAGS(0) },
                                                        time: 0,
                                                        dwExtraInfo: 0,
                                                    },
                                                },
                                            };
                                            SendInput(&[input], std::mem::size_of::<INPUT>() as i32);

                                            // 元の入力をブロック
                                            return windows::Win32::Foundation::LRESULT(1);
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    let handle = HOOK_HANDLE.load(Ordering::SeqCst);
    CallNextHookEx(HHOOK(handle as *mut _), code, wparam, lparam)
}
