use crate::Config;
use crate::key_processor::state::get_state;
use crate::key_processor::utils::apply_layer_modifiers;

pub fn apply(layer_id: &str, config: &Config) {
    let (old_layers, new_layers) = {
        let mut state = get_state().lock().unwrap();
        let old_layers = state.active_layers.clone();
        if state.active_layers.iter().any(|l| l == layer_id) {
            state.active_layers.retain(|l| l != layer_id);
        } else {
            state.active_layers.push(layer_id.to_string());
        }
        (old_layers, state.active_layers.clone())
    };
    apply_layer_modifiers(&old_layers, &new_layers, config);
    #[cfg(windows)]
    crate::hook::emit_layer_stack_changed(&new_layers);
}
