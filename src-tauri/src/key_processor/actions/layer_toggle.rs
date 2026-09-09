use crate::Config;
use crate::key_processor::state::get_state;
use crate::key_processor::utils::apply_layer_modifiers;

pub fn apply(layer_id: &str, config: &Config) {
    let (old_layers, new_layers) = {
        let mut state = get_state().lock().unwrap();
        let old_layers = state.active_layers.clone();
        if state.active_layers.first().map(|s| s.as_str()) == Some(layer_id) {
            if let Some(first) = state.active_layers.first_mut() {
                *first = "base".to_string();
            }
        } else if let Some(first) = state.active_layers.first_mut() {
            *first = layer_id.to_string();
        } else {
            state.active_layers.push(layer_id.to_string());
        }
        (old_layers, state.active_layers.clone())
    };
    apply_layer_modifiers(&old_layers, &new_layers, config);
    #[cfg(windows)]
    crate::hook::emit_layer_stack_changed(&new_layers);
}
