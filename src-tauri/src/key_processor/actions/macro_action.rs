use crate::Config;
use std::thread;
use std::time::Duration;
use crate::key_processor::utils::{send_key_down, send_key_up};
use std::sync::mpsc::{channel, Sender};
use std::sync::{OnceLock, Mutex};

pub struct MacroTask {
    pub macro_id: String,
    pub config: Config,
}

pub fn get_macro_sender() -> Sender<MacroTask> {
    static SENDER: OnceLock<Mutex<Sender<MacroTask>>> = OnceLock::new();
    SENDER.get_or_init(|| {
        let (tx, rx) = channel::<MacroTask>();
        thread::spawn(move || {
            while let Ok(task) = rx.recv() {
                crate::hook::MACRO_EXECUTING.store(true, std::sync::atomic::Ordering::SeqCst);
                execute_macro_sync(&task.macro_id, &task.config, 1);
                crate::hook::MACRO_EXECUTING.store(false, std::sync::atomic::Ordering::SeqCst);
            }
        });
        Mutex::new(tx)
    }).lock().unwrap().clone()
}

fn execute_macro_sync(macro_id: &str, config: &Config, depth: u32) {
    if depth > 10 {
        log::warn!("Macro execution depth exceeded limit (10). Aborting nested macro: {}", macro_id);
        return;
    }

    log::info!("Executing macro: {} (depth: {})", macro_id, depth);

    if let Some(macro_def) = config.macros.iter().find(|m| m.get("id").and_then(|v| v.as_str()) == Some(macro_id)) {
        if let Some(actions) = macro_def.get("actions").and_then(|v| v.as_array()) {
            for (i, step) in actions.iter().enumerate() {
                if let Some(action_type) = step.get("type").and_then(|v| v.as_str()) {
                    log::info!("  Step {}: type={}", i, action_type);
                    match action_type {
                        "remap" => {
                            if let Some(keys) = step.get("keys").and_then(|v| v.as_array()) {
                                let mut vks = Vec::new();
                                for k in keys {
                                    if let Some(vk) = k.as_u64() {
                                        vks.push(vk as u16);
                                    }
                                }
                                log::info!("    remap keys: {:?}", vks);
                                for &vk in &vks {
                                    send_key_down(vk, vk);
                                }
                                for &vk in vks.iter().rev() {
                                    send_key_up(vk, vk);
                                }
                            }
                        }
                        "delay" => {
                            if let Some(delay_ms) = step.get("delayMs").and_then(|v| v.as_u64()) {
                                log::info!("    delay: {}ms", delay_ms);
                                thread::sleep(Duration::from_millis(delay_ms));
                            }
                        }
                        "mouseMove" => {
                            let x = step.get("x").and_then(|v| v.as_i64()).unwrap_or(0) as i32;
                            let y = step.get("y").and_then(|v| v.as_i64()).unwrap_or(0) as i32;
                            log::info!("    mouseMove: ({}, {})", x, y);
                            crate::key_processor::utils::send_mouse_move(x, y);
                        }
                        "mouseClick" => {
                            let button = step.get("button").and_then(|v| v.as_str()).unwrap_or("left");
                            let click_count = step.get("clickCount").and_then(|v| v.as_u64()).unwrap_or(1) as u32;
                            log::info!("    mouseClick: button={}, count={}", button, click_count);
                            crate::key_processor::utils::send_mouse_click(button, click_count);
                        }
                        "cursorSave" => {
                            let pos = crate::key_processor::utils::get_mouse_pos();
                            crate::key_processor::state::get_state().lock().unwrap().saved_mouse_pos = Some(pos);
                            log::info!("    cursorSave: saved pos ({}, {})", pos.0, pos.1);
                        }
                        "cursorRestore" => {
                            if let Some(pos) = crate::key_processor::state::get_state().lock().unwrap().saved_mouse_pos {
                                crate::key_processor::utils::send_mouse_move(pos.0, pos.1);
                                log::info!("    cursorRestore: restored to ({}, {})", pos.0, pos.1);
                            }
                        }
                        "macro" => {
                            if let Some(nested_macro_id) = step.get("macroId").and_then(|v| v.as_str()) {
                                log::info!("    nested macro: {}", nested_macro_id);
                                execute_macro_sync(nested_macro_id, config, depth + 1);
                            }
                        }
                        _ => {
                            log::info!("    unknown action type");
                        }
                    }
                }
            }
        }
    }
}

pub fn apply(action: &serde_json::Value, config: &Config) {
    log::info!("macro_action::apply called with action: {:?}", action);
    if let Some(macro_id) = action.get("macroId").and_then(|v| v.as_str()) {
        log::info!("Found macroId: {}", macro_id);
        let _ = get_macro_sender().send(MacroTask {
            macro_id: macro_id.to_string(),
            config: config.clone(),
        });
    } else {
        log::warn!("macroId not found in action: {:?}", action);
    }
}
