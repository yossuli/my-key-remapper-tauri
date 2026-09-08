use crate::{Action, Config};
use std::thread;
use std::time::Duration;

fn execute_macro_sync(macro_id: &str, config: &Config, depth: u32) {
    if depth > 10 {
        log::warn!("Macro execution depth exceeded limit (10). Aborting nested macro: {}", macro_id);
        return;
    }

    log::info!("Executing macro: {} (depth: {})", macro_id, depth);

    if let Some(macro_def) = config.macros.iter().find(|m| m.id == macro_id) {
        for (i, step) in macro_def.actions.iter().enumerate() {
            log::info!("  Step {}: {:?}", i, step);
            match step {
                Action::Remap { keys, .. } => {
                    log::info!("    remap keys: {:?}", keys);
                    for &vk in keys {
                        crate::key_processor::utils::send_key_raw(vk, false);
                    }
                    for &vk in keys.iter().rev() {
                        crate::key_processor::utils::send_key_raw(vk, true);
                    }
                }
                Action::Delay { delay_ms } => {
                    log::info!("    delay: {}ms", delay_ms);
                    thread::sleep(Duration::from_millis(*delay_ms as u64));
                }
                Action::MouseMove { x, y } => {
                    let x_val = x.unwrap_or(0);
                    let y_val = y.unwrap_or(0);
                    log::info!("    mouseMove: ({}, {})", x_val, y_val);
                    crate::key_processor::utils::send_mouse_move(x_val, y_val);
                }
                Action::MouseClick { x, y, button, click_count } => {
                    if let (Some(x_val), Some(y_val)) = (*x, *y) {
                        log::info!("    mouseClick move to: ({}, {})", x_val, y_val);
                        crate::key_processor::utils::send_mouse_move(x_val, y_val);
                    }
                    let count = click_count.unwrap_or(1);
                    log::info!("    mouseClick: button={}, count={}", button.as_str(), count);
                    crate::key_processor::utils::send_mouse_click(button.as_str(), count);
                }
                Action::CursorSave => {
                    let pos = crate::key_processor::utils::get_mouse_pos();
                    crate::key_processor::state::get_state().lock().unwrap().saved_mouse_pos = Some(pos);
                    log::info!("    cursorSave: saved pos ({}, {})", pos.0, pos.1);
                }
                Action::CursorRestore => {
                    if let Some(pos) = crate::key_processor::state::get_state().lock().unwrap().saved_mouse_pos {
                        crate::key_processor::utils::send_mouse_move(pos.0, pos.1);
                        log::info!("    cursorRestore: restored to ({}, {})", pos.0, pos.1);
                    }
                }
                Action::Macro { macro_id: nested_macro_id } => {
                    log::info!("    nested macro: {}", nested_macro_id);
                    execute_macro_sync(nested_macro_id, config, depth + 1);
                }
                Action::LayerToggle { .. }
                | Action::LayerMomentary { .. }
                | Action::ScrollMode { .. }
                | Action::None => {
                    log::info!("    unsupported or ignored macro step action: {:?}", step);
                }
            }
        }
    }
}

pub fn apply(macro_id: &str, config: &Config) {
    log::info!("macro_action::apply called with macro_id: {}", macro_id);
    let macro_id = macro_id.to_string();
    let config_clone = config.clone();

    thread::spawn(move || {
        execute_macro_sync(&macro_id, &config_clone, 1);
    });
}
