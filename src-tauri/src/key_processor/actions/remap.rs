use smallvec::SmallVec;
use crate::Config;
use crate::key_processor::state::get_state;
use crate::key_processor::utils::{
    is_modifier, send_key_down, send_key_up,
    suppress_active_modifiers_for_remap, restore_suppressed_modifiers,
};

#[derive(Debug, PartialEq, Eq)]
enum RemapReleasePolicy {
    ImmediateRelease,
    SustainHold,
    NoOp,
}

fn determine_release_policy(
    is_atomic: bool,
    repeat: bool,
    has_non_modifier: bool,
    has_suppressed: bool,
) -> RemapReleasePolicy {
    match (is_atomic, repeat, has_non_modifier, has_suppressed) {
        (true, _, _, _) | (_, false, true, _) => RemapReleasePolicy::ImmediateRelease,
        (_, _, _, true) => RemapReleasePolicy::SustainHold,
        _ => RemapReleasePolicy::NoOp,
    }
}

pub fn apply(
    physical_vk: u16,
    keys: &[u16],
    repeat: bool,
    is_atomic: bool,
    config: &Config,
    source_layer: Option<&str>,
) {
    if keys.is_empty() {
        return;
    }

    let target_vks: SmallVec<[u16; 16]> = SmallVec::from_slice(keys);

    let suppressed = suppress_active_modifiers_for_remap(physical_vk, &target_vks, config, source_layer);

    for &target_vk in &target_vks {
        send_key_down(physical_vk, target_vk);
    }

    let has_non_modifier = target_vks.iter().any(|&vk| !is_modifier(vk));

    match determine_release_policy(is_atomic, repeat, has_non_modifier, !suppressed.is_empty()) {
        RemapReleasePolicy::ImmediateRelease => {
            for &target_vk in target_vks.iter().rev() {
                send_key_up(physical_vk, target_vk);
            }
            restore_suppressed_modifiers(&suppressed);
        }
        RemapReleasePolicy::SustainHold => {
            let mut state = get_state().lock().unwrap();
            state.suppressed_modifiers_for_key.insert(physical_vk, suppressed);
        }
        RemapReleasePolicy::NoOp => {}
    }
}

/// リマップアクションのリピート実行 (修飾キー以外のキーをアトミックに再押下・解放)
pub fn repeat(physical_vk: u16, keys: &[u16]) {
    for &target_vk in keys {
        if !is_modifier(target_vk) {
            send_key_down(physical_vk, target_vk);
            send_key_up(physical_vk, target_vk);
        }
    }
}

