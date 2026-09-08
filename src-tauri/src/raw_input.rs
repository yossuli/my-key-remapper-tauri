use std::sync::atomic::{AtomicBool, AtomicPtr, Ordering};
use windows::core::w;
use windows::Win32::Foundation::{HWND, LPARAM, LRESULT, WPARAM};
use windows::Win32::UI::Input::{
    GetRawInputData, RegisterRawInputDevices, HRAWINPUT, RAWINPUT, RAWINPUTDEVICE,
    RAWINPUTHEADER, RIDEV_INPUTSINK, RID_INPUT,
};
use windows::Win32::UI::WindowsAndMessaging::{
    CreateWindowExW, DefWindowProcW, DestroyWindow, DispatchMessageW, GetMessageW,
    PostMessageW, RegisterClassW, TranslateMessage, CW_USEDEFAULT, HWND_MESSAGE, MSG,
    WNDCLASSW, WS_OVERLAPPED, WM_CLOSE, WM_INPUT,
};

use crate::hook::{
    SCROLL_ACCUM, SCROLL_AXIS_MODE, SCROLL_INVERT, SCROLL_MODE_ACTIVE,
    SCROLL_SENSITIVITY_PERCENT,
};

static RAW_INPUT_HWND: AtomicPtr<std::ffi::c_void> = AtomicPtr::new(std::ptr::null_mut());
static RAW_INPUT_RUNNING: AtomicBool = AtomicBool::new(false);

unsafe extern "system" fn raw_input_wnd_proc(
    hwnd: HWND,
    msg: u32,
    wparam: WPARAM,
    lparam: LPARAM,
) -> LRESULT {
    match msg {
        WM_INPUT => {
            let mut raw_size: u32 = 0;
            let header_size = std::mem::size_of::<RAWINPUTHEADER>() as u32;

            // 1. バッファサイズ取得
            let _ = GetRawInputData(
                HRAWINPUT(lparam.0 as *mut _),
                RID_INPUT,
                None,
                &mut raw_size,
                header_size,
            );

            if raw_size > 0 {
                let mut stack_buf = [0u8; 256];
                let mut heap_buf;
                let buf_ptr = if (raw_size as usize) <= stack_buf.len() {
                    stack_buf.as_mut_ptr()
                } else {
                    heap_buf = vec![0u8; raw_size as usize];
                    heap_buf.as_mut_ptr()
                };

                let bytes_read = GetRawInputData(
                    HRAWINPUT(lparam.0 as *mut _),
                    RID_INPUT,
                    Some(buf_ptr as *mut _),
                    &mut raw_size,
                    header_size,
                );

                if bytes_read != u32::MAX {
                    let raw = &*(buf_ptr as *const RAWINPUT);
                    // マウス入力かつ相対移動の場合
                    if raw.header.dwType == 0 {
                        // RIM_TYPEMOUSE = 0
                        let mouse = &raw.data.mouse;
                        let dx = mouse.lLastX;
                        let dy = mouse.lLastY;

                        let scroll_active = SCROLL_MODE_ACTIVE.load(Ordering::Relaxed);
                        let remap_enabled = crate::hook::REMAP_ENABLED.load(Ordering::Relaxed);

                        if remap_enabled && scroll_active && (dx != 0 || dy != 0) {
                            let sens = (SCROLL_SENSITIVITY_PERCENT.load(Ordering::Relaxed) as f64)
                                / 100.0;
                            let invert = SCROLL_INVERT.load(Ordering::Relaxed);
                            let axis = SCROLL_AXIS_MODE.load(Ordering::Relaxed);

                            // Raw Input の純粋な生カウント (1カウントあたり 12.0 WHEEL 単位)
                            // 下へ指を動かす (dy > 0) -> 通常は画面下スクロール (負のWHEEL値 -120)
                            let raw_wheel_y = if invert {
                                dy as f64
                            } else {
                                -(dy as f64)
                            } * sens
                                * 14.0;
                            let raw_wheel_x = (dx as f64) * sens * 14.0;

                            let (wheel_y, wheel_x) = match axis {
                                1 => (raw_wheel_y, 0.0), // vertical only
                                2 => (0.0, raw_wheel_x), // horizontal only
                                _ => (raw_wheel_y, raw_wheel_x), // both
                            };

                            let mut acc_guard = SCROLL_ACCUM.lock().unwrap();
                            acc_guard.0 += wheel_x;
                            acc_guard.1 += wheel_y;

                            let dispatch_x = acc_guard.0 as i32;
                            let dispatch_y = acc_guard.1 as i32;

                            if dispatch_x != 0 || dispatch_y != 0 {
                                acc_guard.0 -= dispatch_x as f64;
                                acc_guard.1 -= dispatch_y as f64;
                                drop(acc_guard);

                                // 非同期でホイール送信
                                tauri::async_runtime::spawn(async move {
                                    crate::key_processor::utils::send_mouse_wheel(
                                        dispatch_y, dispatch_x,
                                    );
                                });
                            }
                        }
                    }
                }
            }
            DefWindowProcW(hwnd, msg, wparam, lparam)
        }
        WM_CLOSE => {
            let _ = DestroyWindow(hwnd);
            LRESULT(0)
        }
        _ => DefWindowProcW(hwnd, msg, wparam, lparam),
    }
}

pub fn start_raw_input_listener() {
    if RAW_INPUT_RUNNING.swap(true, Ordering::SeqCst) {
        return;
    }

    std::thread::Builder::new()
        .name("raw-input-listener".to_string())
        .spawn(|| unsafe {
            let class_name = w!("RawInputMessageOnlyWindowClass");

            let wnd_class = WNDCLASSW {
                lpfnWndProc: Some(raw_input_wnd_proc),
                lpszClassName: class_name,
                ..Default::default()
            };

            let _ = RegisterClassW(&wnd_class);

            let hwnd = CreateWindowExW(
                Default::default(),
                class_name,
                w!("RawInputWindow"),
                WS_OVERLAPPED,
                CW_USEDEFAULT,
                CW_USEDEFAULT,
                CW_USEDEFAULT,
                CW_USEDEFAULT,
                HWND_MESSAGE,
                None,
                None,
                None,
            );

            if let Ok(hwnd_valid) = hwnd {
                RAW_INPUT_HWND.store(hwnd_valid.0 as *mut _, Ordering::SeqCst);

                // Raw Input デバイス登録 (Generic Desktop Mouse, RIDEV_INPUTSINK)
                let rid = [RAWINPUTDEVICE {
                    usUsagePage: 0x01, // Generic Desktop Controls
                    usUsage: 0x02,     // Mouse
                    dwFlags: RIDEV_INPUTSINK,
                    hwndTarget: hwnd_valid,
                }];

                let reg_res = RegisterRawInputDevices(
                    &rid,
                    std::mem::size_of::<RAWINPUTDEVICE>() as u32,
                );
                log::info!("RegisterRawInputDevices result: {:?}", reg_res);

                let mut msg = MSG::default();
                while GetMessageW(&mut msg, None, 0, 0).into() {
                    let _ = TranslateMessage(&msg);
                    DispatchMessageW(&msg);
                }
            }

            RAW_INPUT_RUNNING.store(false, Ordering::SeqCst);
        })
        .expect("Failed to spawn raw input thread");
}

pub fn stop_raw_input_listener() {
    let ptr = RAW_INPUT_HWND.swap(std::ptr::null_mut(), Ordering::SeqCst);
    if !ptr.is_null() {
        unsafe {
            let hwnd = HWND(ptr as *mut _);
            let _ = PostMessageW(hwnd, WM_CLOSE, WPARAM(0), LPARAM(0));
        }
    }
}
