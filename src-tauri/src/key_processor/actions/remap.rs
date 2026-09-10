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
    has_suppressed: bool,
) -> RemapReleasePolicy {
    if is_atomic {
        RemapReleasePolicy::ImmediateRelease
    } else if has_suppressed {
        RemapReleasePolicy::SustainHold
    } else {
        RemapReleasePolicy::NoOp
    }
}

/// キーシーケンスをアトミックに押下・解放送信する（マクロや物理キーなしのアクション用）
pub fn send_key_sequence_atomic(keys: &[u16]) {
    for &vk in keys {
        crate::key_processor::utils::send_key_raw(vk, false);
    }
    for &vk in keys.iter().rev() {
        crate::key_processor::utils::send_key_raw(vk, true);
    }
}

pub fn apply(
    physical_vk: u16,
    keys: &[u16],
    _repeat: bool,
    is_atomic: bool,
    config: &Config,
    source_layer: Option<&str>,
) {
    if keys.is_empty() {
        return;
    }
    
    if physical_vk == 0 {
        send_key_sequence_atomic(keys);
        return;
    }

    let target_vks: SmallVec<[u16; 16]> = SmallVec::from_slice(keys);

    let suppressed = suppress_active_modifiers_for_remap(physical_vk, &target_vks, config, source_layer);

    for &target_vk in &target_vks {
        send_key_down(physical_vk, target_vk);
    }

    match determine_release_policy(is_atomic, !suppressed.is_empty()) {
        RemapReleasePolicy::ImmediateRelease => {
            for &target_vk in target_vks.iter().rev() {
                send_key_up(physical_vk, target_vk, config);
            }
            let mut state = get_state().lock().unwrap();
            restore_suppressed_modifiers(&suppressed, &mut state, config);
        }
        RemapReleasePolicy::SustainHold => {
            let mut state = get_state().lock().unwrap();
            state.suppressed_modifiers_for_key.insert(physical_vk, suppressed);
        }
        RemapReleasePolicy::NoOp => {}
    }
}

/// リマップアクションのリピート実行 (修飾キー以外のキーのKeyDownを再送出)
pub fn repeat(physical_vk: u16, keys: &[u16]) {
    for &target_vk in keys {
        if !is_modifier(target_vk) {
            send_key_down(physical_vk, target_vk);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_determine_release_policy() {
        // is_atomic が true の場合は常に ImmediateRelease
        assert_eq!(
            determine_release_policy(true, false),
            RemapReleasePolicy::ImmediateRelease
        );
        assert_eq!(
            determine_release_policy(true, true),
            RemapReleasePolicy::ImmediateRelease
        );

        // 通常の物理キーリマップ (is_atomic: false)
        // サプレッション修飾キーがある場合は SustainHold
        assert_eq!(
            determine_release_policy(false, true),
            RemapReleasePolicy::SustainHold
        );

        // 通常の物理キーリマップでサプレッションなしは NoOp (物理KeyUpまで解放しない)
        assert_eq!(
            determine_release_policy(false, false),
            RemapReleasePolicy::NoOp
        );
    }

    #[test]
    fn test_remap_apply_holds_key_without_immediate_release() {
        let _guard = crate::key_processor::state::TEST_LOCK.lock().unwrap();
        crate::key_processor::utils::TEST_SENT_KEYS.lock().unwrap().clear();
        {
            let mut state = get_state().lock().unwrap();
            state.pressed_vks.clear();
            state.suppressed_modifiers_for_key.clear();
        }

        let config = Config::default();
        // 物理キー 65 ('A') を 66 ('B') にリマップ (repeat: false, is_atomic: false)
        apply(65, &[66], false, false, &config, None);

        // Downのみ送信され、Upは送信されていないことを検証！
        let sent = crate::key_processor::utils::TEST_SENT_KEYS.lock().unwrap().clone();
        assert_eq!(sent, vec![(66, false)], "Down only must be sent on physical press; Up must NOT be sent immediately!");

        // 状態に 65 -> [66] が記録されていること
        {
            let state = get_state().lock().unwrap();
            assert_eq!(state.pressed_vks.get(&65), Some(&vec![66]));
        }
    }

    #[test]
    fn test_remap_repeat_sends_keydown_only_and_no_duplicate() {
        let _guard = crate::key_processor::state::TEST_LOCK.lock().unwrap();
        crate::key_processor::utils::TEST_SENT_KEYS.lock().unwrap().clear();
        {
            let mut state = get_state().lock().unwrap();
            state.pressed_vks.clear();
            state.suppressed_modifiers_for_key.clear();
        }

        let config = Config::default();
        // 初回押下
        apply(65, &[66], false, false, &config, None);
        crate::key_processor::utils::TEST_SENT_KEYS.lock().unwrap().clear();

        // リピート実行
        repeat(65, &[66]);

        // KeyDownのみが再送出され、KeyUpは送出されていないことを検証
        let sent = crate::key_processor::utils::TEST_SENT_KEYS.lock().unwrap().clone();
        assert_eq!(sent, vec![(66, false)], "Repeat must send KeyDown only, not KeyUp!");

        // pressed_vks に [66] が重複せず1つだけ保持されていることを検証
        {
            let state = get_state().lock().unwrap();
            assert_eq!(state.pressed_vks.get(&65), Some(&vec![66]));
        }
    }
}
