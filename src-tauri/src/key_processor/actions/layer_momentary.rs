use crate::Config;
use crate::key_processor::state::get_state;
use crate::key_processor::utils::apply_layer_modifiers;

pub fn apply(physical_vk: u16, action: &serde_json::Value, config: &Config) {
    if let Some(layer_id) = action.get("layerId").and_then(|v| v.as_str()) {
        let (old_layers, new_layers) = {
            let mut state = get_state().lock().unwrap();
            let old_layers = state.active_layers.clone();
            state.momentary_layers.insert(physical_vk, layer_id.to_string());
            if !state.active_layers.contains(&layer_id.to_string()) {
                state.active_layers.push(layer_id.to_string());
            }
            (old_layers, state.active_layers.clone())
        };
        apply_layer_modifiers(&old_layers, &new_layers, config);
    }
}
