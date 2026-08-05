use std::sync::atomic::{AtomicPtr, Ordering};
use std::sync::OnceLock;
use tauri::{AppHandle, Emitter};
use windows::Win32::Foundation::{LRESULT, WPARAM, LPARAM};
use windows::Win32::UI::WindowsAndMessaging::{
    SetWindowsHookExW, UnhookWindowsHookEx, CallNextHookEx,
    WH_KEYBOARD_LL, HHOOK, KBDLLHOOKSTRUCT
};
use tauri::Manager;
use crate::ConfigState;
use crate::key_processor::{KeyProcessor, HookAction};
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
                if !remap_enabled {
                    let handle = HOOK_HANDLE.load(Ordering::SeqCst);
                    return CallNextHookEx(HHOOK(handle as *mut _), code, wparam, lparam);
                }

                // リマップ判定
                let state = app.state::<ConfigState>();
                let config = state.config.load();

                match KeyProcessor::process_key(vk_code, is_down, &config) {
                    HookAction::Block => return windows::Win32::Foundation::LRESULT(1),
                    HookAction::PassThrough => {}
                }
            }
        }
    }

    let handle = HOOK_HANDLE.load(Ordering::SeqCst);
    CallNextHookEx(HHOOK(handle as *mut _), code, wparam, lparam)
}
