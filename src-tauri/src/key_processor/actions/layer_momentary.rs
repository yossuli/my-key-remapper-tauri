use std::collections::HashSet;
use crate::Config;
use crate::key_processor::state::get_state;
use crate::key_processor::utils::apply_layer_modifiers;

pub fn get_layer_hierarchy(target_layer_id: &str, config: &Config) -> Vec<String> {
    let mut chain = Vec::new();
    let mut current_id = target_layer_id.to_string();
    let mut visited = HashSet::new();

    while visited.insert(current_id.clone()) {
        chain.push(current_id.clone());
        if let Some(layer) = config.layers.iter().find(|l| l.id == current_id) {
            if let Some(ref parent) = layer.parent_layer_id {
                let trimmed = parent.trim();
                if !trimmed.is_empty() && trimmed != "base" {
                    current_id = trimmed.to_string();
                    continue;
                }
            }
        }
        break;
    }

    chain.reverse();
    chain
}

pub fn apply(physical_vk: u16, layer_id: &str, config: &Config) {
    let layers_to_push = get_layer_hierarchy(layer_id, config);
    let (old_layers, new_layers) = {
        let mut state = get_state().lock().unwrap();
        let old_layers = state.active_layers.clone();
        for lid in &layers_to_push {
            state.active_layers.push(lid.clone());
        }
        state.momentary_layers.insert(physical_vk, layers_to_push);
        if !state.momentary_keys.iter().any(|&(k, _)| k == physical_vk) {
            state.momentary_keys.push((physical_vk, std::time::Instant::now()));
        }
        state.ghost_keys.remove(&physical_vk);
        (old_layers, state.active_layers.clone())
    };

    apply_layer_modifiers(&old_layers, &new_layers, config);
    #[cfg(windows)]
    crate::hook::emit_layer_stack_changed(&new_layers);
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::model::Layer;

    #[test]
    fn test_get_layer_hierarchy_single_and_chain() {
        let mut config = crate::get_default_config();
        config.layers.push(Layer {
            id: "num".to_string(),
            ..Default::default()
        });
        config.layers.push(Layer {
            id: "num_shift".to_string(),
            parent_layer_id: Some("num".to_string()),
            ..Default::default()
        });

        // single
        assert_eq!(get_layer_hierarchy("num", &config), vec!["num".to_string()]);

        // chain: num_shift has parent num -> ["num", "num_shift"]
        assert_eq!(
            get_layer_hierarchy("num_shift", &config),
            vec!["num".to_string(), "num_shift".to_string()]
        );
    }

    #[test]
    fn test_get_layer_hierarchy_cycle_prevention() {
        let mut config = crate::get_default_config();
        config.layers.push(Layer {
            id: "a".to_string(),
            parent_layer_id: Some("b".to_string()),
            ..Default::default()
        });
        config.layers.push(Layer {
            id: "b".to_string(),
            parent_layer_id: Some("a".to_string()),
            ..Default::default()
        });

        // Cycle should terminate safely without infinite loop
        let res = get_layer_hierarchy("a", &config);
        assert_eq!(res.len(), 2);
    }
}
