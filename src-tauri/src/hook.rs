use std::sync::atomic::{AtomicPtr, AtomicBool, AtomicU32, Ordering};
use std::sync::{Mutex, OnceLock};
use tauri::{AppHandle, Emitter};
use windows::Win32::Foundation::{LRESULT, WPARAM, LPARAM};
use windows::Win32::UI::WindowsAndMessaging::{
    SetWindowsHookExW, UnhookWindowsHookEx, CallNextHookEx,
    WH_KEYBOARD_LL, WH_MOUSE_LL, HHOOK, KBDLLHOOKSTRUCT, MSLLHOOKSTRUCT
};
use tauri::Manager;
use crate::ConfigState;
use crate::key_processor::{KeyProcessor, HookAction};

static HOOK_HANDLE: AtomicPtr<std::ffi::c_void> = AtomicPtr::new(std::ptr::null_mut());
static MOUSE_HOOK_HANDLE: AtomicPtr<std::ffi::c_void> = AtomicPtr::new(std::ptr::null_mut());
static APP_HANDLE: OnceLock<AppHandle> = OnceLock::new();
pub static REMAP_ENABLED: AtomicBool = AtomicBool::new(false);

// スクロールモード状態 (低レベルフック用・高速かつ非同期)
pub static SCROLL_MODE_ACTIVE: AtomicBool = AtomicBool::new(false);
pub static SCROLL_SENSITIVITY_PERCENT: AtomicU32 = AtomicU32::new(100);
pub static SCROLL_INVERT: AtomicBool = AtomicBool::new(false);
pub static SCROLL_AXIS_MODE: AtomicU32 = AtomicU32::new(0); // 0=both, 1=vertical, 2=horizontal

pub static SCROLL_ACCUM: Mutex<(f64, f64)> = Mutex::new((0.0, 0.0));

pub fn set_scroll_mode_state(active: bool, sensitivity: f64, invert: bool, axis: &str) {
    let sens_percent = (sensitivity * 100.0).round().max(10.0) as u32;
    let axis_code = match axis {
        "vertical" => 1,
        "horizontal" => 2,
        _ => 0,
    };
    SCROLL_SENSITIVITY_PERCENT.store(sens_percent, Ordering::Relaxed);
    SCROLL_INVERT.store(invert, Ordering::Relaxed);
    SCROLL_AXIS_MODE.store(axis_code, Ordering::Relaxed);
    SCROLL_MODE_ACTIVE.store(active, Ordering::SeqCst);

    if let Ok(mut acc) = SCROLL_ACCUM.lock() {
        *acc = (0.0, 0.0);
    }
}

fn get_pressed_keys_set() -> &'static Mutex<std::collections::HashSet<u32>> {
    static SET: OnceLock<Mutex<std::collections::HashSet<u32>>> = OnceLock::new();
    SET.get_or_init(|| Mutex::new(std::collections::HashSet::new()))
}

pub fn setup_hook(app: AppHandle) {
    let _ = APP_HANDLE.set(app.clone());
    KeyProcessor::start_timeout_worker(app);
    unsafe {
        // キーボードフック
        let kb_hook = SetWindowsHookExW(
            WH_KEYBOARD_LL,
            Some(keyboard_proc),
            None,
            0,
        ).unwrap();
        HOOK_HANDLE.store(kb_hook.0 as *mut _, Ordering::SeqCst);

        // マウスフック（スクロールモード中のカーソル移動ブロック用）
        if let Ok(ms_hook) = SetWindowsHookExW(
            WH_MOUSE_LL,
            Some(mouse_proc),
            None,
            0,
        ) {
            MOUSE_HOOK_HANDLE.store(ms_hook.0 as *mut _, Ordering::SeqCst);
        }
    }
}

pub fn teardown_hook() {
    let handle = HOOK_HANDLE.swap(std::ptr::null_mut(), Ordering::SeqCst);
    if !handle.is_null() {
        unsafe {
            let _ = UnhookWindowsHookEx(HHOOK(handle as *mut _));
        }
    }
    let ms_handle = MOUSE_HOOK_HANDLE.swap(std::ptr::null_mut(), Ordering::SeqCst);
    if !ms_handle.is_null() {
        unsafe {
            let _ = UnhookWindowsHookEx(HHOOK(ms_handle as *mut _));
        }
    }
}

unsafe extern "system" fn mouse_proc(code: i32, wparam: WPARAM, lparam: LPARAM) -> LRESULT {
    if code >= 0 && lparam.0 != 0 {
        let ms_struct = *(lparam.0 as *const MSLLHOOKSTRUCT);
        let msg = wparam.0 as u32;

        const WM_MOUSEMOVE: u32 = 0x0200;

        let is_injected = (ms_struct.flags & 0x01) != 0;

        if !is_injected {
            // スクロールモード中のカーソル移動ブロック（Raw Input で変位スクロール処理）
            let remap_enabled = REMAP_ENABLED.load(Ordering::Relaxed);
            let scroll_active = SCROLL_MODE_ACTIVE.load(Ordering::Relaxed);

            if remap_enabled && scroll_active && msg == WM_MOUSEMOVE {
                // LRESULT(1) でカーソル移動をキャンセル（その場に固定）
                return windows::Win32::Foundation::LRESULT(1);
            }
        }
    }

    let handle = MOUSE_HOOK_HANDLE.load(Ordering::SeqCst);
    CallNextHookEx(HHOOK(handle as *mut _), code, wparam, lparam)
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
            if is_down {
                get_pressed_keys_set().lock().unwrap().insert(vk_code);
            } else if is_up {
                get_pressed_keys_set().lock().unwrap().remove(&vk_code);
            }

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

                match KeyProcessor::process_key(vk_code as u16, is_down, &config) {
                    HookAction::Block => return windows::Win32::Foundation::LRESULT(1),
                    HookAction::PassThrough => {}
                }
            }
        }
    }

    let handle = HOOK_HANDLE.load(Ordering::SeqCst);
    CallNextHookEx(HHOOK(handle as *mut _), code, wparam, lparam)
}
