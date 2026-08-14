use crate::Config;
use std::thread;
use std::time::Duration;
use crate::key_processor::utils::{send_key_down, send_key_up};

fn execute_macro_sync(macro_id: &str, config: &Config, depth: u32) {
    if depth > 10 {
        log::warn!("Macro execution depth exceeded limit (10). Aborting nested macro: {}", macro_id);
        return;
    }

    if let Some(macro_def) = config.macros.iter().find(|m| m.get("id").and_then(|v| v.as_str()) == Some(macro_id)) {
        if let Some(actions) = macro_def.get("actions").and_then(|v| v.as_array()) {
            for step in actions {
                if let Some(action_type) = step.get("type").and_then(|v| v.as_str()) {
                    match action_type {
                        "remap" => {
                            if let Some(keys) = step.get("keys").and_then(|v| v.as_array()) {
                                let mut vks = Vec::new();
                                for k in keys {
                                    if let Some(vk) = k.as_u64() {
                                        vks.push(vk as u16);
                                    }
                                }
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
                                thread::sleep(Duration::from_millis(delay_ms));
                            }
                        }
                        "mouseMove" => {
                            let x = step.get("x").and_then(|v| v.as_i64()).unwrap_or(0) as i32;
                            let y = step.get("y").and_then(|v| v.as_i64()).unwrap_or(0) as i32;
                            crate::key_processor::utils::send_mouse_move(x, y);
                        }
                        "mouseClick" => {
                            let button = step.get("button").and_then(|v| v.as_str()).unwrap_or("left");
                            let click_count = step.get("clickCount").and_then(|v| v.as_u64()).unwrap_or(1) as u32;
                            crate::key_processor::utils::send_mouse_click(button, click_count);
                        }
                        "macro" => {
                            if let Some(nested_macro_id) = step.get("macroId").and_then(|v| v.as_str()) {
                                execute_macro_sync(nested_macro_id, config, depth + 1);
                            }
                        }
                        _ => {
                            // Other actions in macros
                        }
                    }
                }
            }
        }
    }
}

pub fn apply(action: &serde_json::Value, config: &Config) {
    if let Some(macro_id) = action.get("macroId").and_then(|v| v.as_str()) {
        let macro_id = macro_id.to_string();
        let config_clone = config.clone();

        thread::spawn(move || {
            execute_macro_sync(&macro_id, &config_clone, 1);
        });
    }
}
