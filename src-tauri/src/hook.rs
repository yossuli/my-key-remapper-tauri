use std::sync::atomic::{AtomicPtr, Ordering};
use windows::Win32::Foundation::{LRESULT, WPARAM, LPARAM};
use windows::Win32::UI::WindowsAndMessaging::{
    SetWindowsHookExW, UnhookWindowsHookEx, CallNextHookEx,
    WH_KEYBOARD_LL, HHOOK, KBDLLHOOKSTRUCT
};

static HOOK_HANDLE: AtomicPtr<std::ffi::c_void> = AtomicPtr::new(std::ptr::null_mut());

pub fn setup_hook() {
    unsafe {
        let hook = SetWindowsHookExW(
            WH_KEYBOARD_LL,
            Some(keyboard_proc),
            None,
            0,
        ).unwrap();
        
        // Store the hook handle for cleanup
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

        if is_down || is_up {
            // TODO: Implement Remap logic based on REMAP_SPECIFICATIONS.md
            // Return LRESULT(1) to block the input, or CallNextHookEx to pass it through
            println!("Key: {}, Down: {}", vk_code, is_down);
        }
    }
    
    let handle = HOOK_HANDLE.load(Ordering::SeqCst);
    CallNextHookEx(HHOOK(handle as *mut _), code, wparam, lparam)
}
