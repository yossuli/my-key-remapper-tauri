pub mod remap;
pub mod layer_toggle;
pub mod layer_momentary;
pub mod macro_action;

use crate::{Action, Config};

pub fn apply_action(
    physical_vk: u16,
    action: &Action,
    is_atomic: bool,
    config: &Config,
    source_layer: Option<&str>,
) {
    log::info!("apply_action: vk={}, action={:?}", physical_vk, action);
    match action {
        Action::Remap { keys, repeat, .. } => {
            remap::apply(physical_vk, keys, repeat.unwrap_or(false), is_atomic, config, source_layer);
        }
        Action::LayerToggle { layer_id } => {
            layer_toggle::apply(layer_id, config);
        }
        Action::LayerMomentary { layer_id } => {
            layer_momentary::apply(physical_vk, layer_id, config);
        }
        Action::Macro { macro_id } => {
            macro_action::apply(macro_id, config);
        }
        Action::MouseMove { x, y } => {
            crate::key_processor::utils::send_mouse_move(x.unwrap_or(0), y.unwrap_or(0));
        }
        Action::MouseClick { x, y, button, click_count } => {
            if let (Some(x_val), Some(y_val)) = (*x, *y) {
                crate::key_processor::utils::send_mouse_move(x_val, y_val);
            }
            crate::key_processor::utils::send_mouse_click(button.as_str(), click_count.unwrap_or(1));
        }
        Action::CursorSave => {
            let pos = crate::key_processor::utils::get_mouse_pos();
            crate::key_processor::state::get_state().lock().unwrap().saved_mouse_pos = Some(pos);
            log::info!("cursorSave: saved pos ({}, {})", pos.0, pos.1);
        }
        Action::CursorRestore => {
            if let Some(pos) = crate::key_processor::state::get_state().lock().unwrap().saved_mouse_pos {
                crate::key_processor::utils::send_mouse_move(pos.0, pos.1);
                log::info!("cursorRestore: restored to ({}, {})", pos.0, pos.1);
            } else {
                log::warn!("cursorRestore called but no position was saved");
            }
        }
        Action::ScrollMode { sensitivity, invert, axis } => {
            let sens = sensitivity.unwrap_or(1.0);
            let inv = invert.unwrap_or(false);
            let ax = axis.map_or("both", |a| a.as_str());

            #[cfg(windows)]
            crate::hook::set_scroll_mode_state(true, sens, inv, ax);

            log::info!("scrollMode activated: sens={}, invert={}, axis={}", sens, inv, ax);
        }
        Action::Delay { delay_ms } => {
            std::thread::sleep(std::time::Duration::from_millis(*delay_ms as u64));
        }
        Action::None => {}
    }
}

pub fn apply_repeat(physical_vk: u16, action: &Action) {
    if let Action::Remap { keys, repeat: Some(true), .. } = action {
        remap::repeat(physical_vk, keys);
    }
}

