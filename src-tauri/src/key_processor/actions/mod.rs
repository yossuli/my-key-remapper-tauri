pub mod remap;
pub mod layer_toggle;
pub mod layer_momentary;
pub mod macro_action;

use crate::Config;

pub fn apply_action(physical_vk: u16, action: &serde_json::Value, is_atomic: bool, config: &Config) {
    let action_type = action.get("type").and_then(|v| v.as_str()).unwrap_or("none");
    log::info!("apply_action: vk={}, type={}, action={:?}", physical_vk, action_type, action);
    match action_type {
        "remap" => remap::apply(physical_vk, action, is_atomic),
        "layerToggle" => layer_toggle::apply(action, config),
        "layerMomentary" => layer_momentary::apply(physical_vk, action, config),
        "macro" => macro_action::apply(action, config),
        "mouseMove" => {
            let x = action.get("x").and_then(|v| v.as_i64()).unwrap_or(0) as i32;
            let y = action.get("y").and_then(|v| v.as_i64()).unwrap_or(0) as i32;
            crate::key_processor::utils::send_mouse_move(x, y);
        }
        "mouseClick" => {
            let button = action.get("button").and_then(|v| v.as_str()).unwrap_or("left");
            let click_count = action.get("clickCount").and_then(|v| v.as_u64()).unwrap_or(1) as u32;
            crate::key_processor::utils::send_mouse_click(button, click_count);
        }
        "cursorSave" => {
            let pos = crate::key_processor::utils::get_mouse_pos();
            crate::key_processor::state::get_state().lock().unwrap().saved_mouse_pos = Some(pos);
            log::info!("cursorSave: saved pos ({}, {})", pos.0, pos.1);
        }
        "cursorRestore" => {
            if let Some(pos) = crate::key_processor::state::get_state().lock().unwrap().saved_mouse_pos {
                crate::key_processor::utils::send_mouse_move(pos.0, pos.1);
                log::info!("cursorRestore: restored to ({}, {})", pos.0, pos.1);
            } else {
                log::warn!("cursorRestore called but no position was saved");
            }
        }
        _ => {
            log::warn!("Unhandled action type: {}", action_type);
        }
    }
}
