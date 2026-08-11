use crate::key_processor::utils::{is_modifier, send_key_down, send_key_up};

pub fn apply(physical_vk: u16, action: &serde_json::Value, is_atomic: bool) {
    if let Some(keys) = action.get("keys").and_then(|v| v.as_array()) {
        if !keys.is_empty() {
            let mut target_vks = Vec::new();
            for k in keys {
                if let Some(vk) = k.as_u64() {
                    target_vks.push(vk as u16);
                }
            }

            for &target_vk in &target_vks {
                send_key_down(physical_vk, target_vk);
            }
            
            let repeat = action.get("repeat").and_then(|v| v.as_bool()).unwrap_or(false);
            let has_non_modifier = target_vks.iter().any(|&vk| !is_modifier(vk));
            
            if is_atomic || (!repeat && has_non_modifier) {
                for &target_vk in target_vks.iter().rev() {
                    send_key_up(physical_vk, target_vk);
                }
            }
        }
    }
}
