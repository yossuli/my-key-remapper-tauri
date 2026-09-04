use crate::Config;
use crate::key_processor::state::get_state;
use crate::key_processor::utils::{apply_layer_modifiers, send_key_raw};

pub fn apply(physical_vk: u16, action: &serde_json::Value, config: &Config) {
    if let Some(layer_id) = action.get("layerId").and_then(|v| v.as_str()) {
        let is_passthrough = config.layers.iter()
            .find(|l| l.id == layer_id)
            .and_then(|l| l.passthrough_trigger_key)
            .unwrap_or(false);

        let (old_layers, new_layers, needs_key_down) = {
            let mut state = get_state().lock().unwrap();
            let old_layers = state.active_layers.clone();
            state.momentary_layers.insert(physical_vk, layer_id.to_string());
            let mut needs_down = false;
            if is_passthrough {
                if !state.passthrough_trigger_keys.contains(&physical_vk) {
                    state.passthrough_trigger_keys.insert(physical_vk);
                    needs_down = true;
                }
            }
            if !state.active_layers.contains(&layer_id.to_string()) {
                state.active_layers.push(layer_id.to_string());
            }
            (old_layers, state.active_layers.clone(), needs_down)
        };

        if needs_key_down {
            send_key_raw(physical_vk, false);
        }

        apply_layer_modifiers(&old_layers, &new_layers, config);
    }
}
