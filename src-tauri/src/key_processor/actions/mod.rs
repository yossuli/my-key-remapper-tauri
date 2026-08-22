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
        _ => {
            log::warn!("Unhandled action type: {}", action_type);
        }
    }
}
