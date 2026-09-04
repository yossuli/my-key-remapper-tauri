use crate::Config;
use crate::key_processor::state::get_state;
use crate::key_processor::utils::{
    is_modifier, send_key_down, send_key_up,
    suppress_active_modifiers_for_remap, restore_suppressed_modifiers,
};

pub fn apply(physical_vk: u16, action: &serde_json::Value, is_atomic: bool, config: &Config) {
    if let Some(keys) = action.get("keys").and_then(|v| v.as_array()) {
        if !keys.is_empty() {
            let mut target_vks = Vec::new();
            for k in keys {
                if let Some(vk) = k.as_u64() {
                    target_vks.push(vk as u16);
                }
            }

            // 1. リマップ送信前に、DefaultModifiers やパススルートリガーキーを一時無効化（UP送信）
            let suppressed = suppress_active_modifiers_for_remap(physical_vk, &target_vks, config);

            // 2. リマップ先のキーを送信
            for &target_vk in &target_vks {
                send_key_down(physical_vk, target_vk);
            }
            
            let repeat = action.get("repeat").and_then(|v| v.as_bool()).unwrap_or(false);
            let has_non_modifier = target_vks.iter().any(|&vk| !is_modifier(vk));
            
            if is_atomic || (!repeat && has_non_modifier) {
                for &target_vk in target_vks.iter().rev() {
                    send_key_up(physical_vk, target_vk);
                }
                // Tap完了後、無効化していた修飾キーをDOWNに復元
                restore_suppressed_modifiers(&suppressed);
            } else if !suppressed.is_empty() {
                // Hold/Repeatなどの継続押下中はキー解放時まで無効化を維持
                let mut state = get_state().lock().unwrap();
                state.suppressed_modifiers_for_key.insert(physical_vk, suppressed);
            }
        }
    }
}
