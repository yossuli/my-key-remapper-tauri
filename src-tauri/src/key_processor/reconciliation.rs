use std::collections::HashSet;
use smallvec::SmallVec;
use crate::{Action, Config, Trigger};
use crate::state_machine::KeyState;
use super::state::ProcessorState;
use super::utils::{
    is_modifier, is_shift, is_ctrl, is_alt, is_win,
    is_key_passed_through, send_key_raw,
    VK_LSHIFT, VK_LCONTROL, VK_LMENU, VK_LWIN,
};
use super::KeyProcessor;
use super::actions;

/// 修飾キー定義テーブル
pub struct ModifierDef {
    pub name: &'static str,
    pub representative_vk: u16,
    pub is_match: fn(u16) -> bool,
}

pub const MODIFIER_DEFS: &[ModifierDef] = &[
    ModifierDef {
        name: "shift",
        representative_vk: VK_LSHIFT,
        is_match: is_shift,
    },
    ModifierDef {
        name: "ctrl",
        representative_vk: VK_LCONTROL,
        is_match: is_ctrl,
    },
    ModifierDef {
        name: "alt",
        representative_vk: VK_LMENU,
        is_match: is_alt,
    },
    ModifierDef {
        name: "win",
        representative_vk: VK_LWIN,
        is_match: is_win,
    },
];

/// 再同期処理によって発生する副作用（OSへのキー送信リクエスト）
#[derive(Debug, Default, PartialEq, Eq, Clone)]
pub struct ReconcileEffects {
    pub keys_to_release: SmallVec<[u16; 8]>,
    pub keys_to_press: SmallVec<[u16; 8]>,
}

impl ReconcileEffects {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn is_empty(&self) -> bool {
        self.keys_to_release.is_empty() && self.keys_to_press.is_empty()
    }

    /// 副作用（キー送信）をロック外で一括実行
    pub fn execute(&self) {
        for &vk in &self.keys_to_release {
            send_key_raw(vk, true);
        }
        for &vk in &self.keys_to_press {
            send_key_raw(vk, false);
        }
    }
}

/// 現在のアクティブレイヤーおよび物理透過修飾キーから、
/// OSへ注入されているべき修飾キーの集合（Desired State）をテーブル駆動で純粋に導出
pub fn compute_desired_layer_modifiers(
    state: &ProcessorState,
    config: &Config,
) -> HashSet<u16> {
    let mut desired = HashSet::new();

    for def in MODIFIER_DEFS {
        let mut required = false;
        for layer_id in &state.active_layers {
            let Some(layer) = config.layers.iter().find(|l| &l.id == layer_id) else { continue };
            let Some(def_mods) = &layer.default_modifiers else { continue };
            if def_mods.is_enabled(def.name) {
                required = true;
                break;
            }
        }

        if required {
            let has_passthrough = state
                .physically_pressed_modifiers
                .iter()
                .any(|&k| (def.is_match)(k) && is_key_passed_through(k, state));

            if state.active_layer_modifiers.contains(&def.representative_vk) || !has_passthrough {
                desired.insert(def.representative_vk);
            }
        }
    }

    desired
}

/// レイヤー合成修飾キーの差分を計算し、状態を更新するとともに副作用（Down/Upキー）を effects に追記
pub fn reconcile_layer_modifiers_internal(
    state: &mut ProcessorState,
    config: &Config,
    effects: &mut ReconcileEffects,
) {
    let desired = compute_desired_layer_modifiers(state, config);

    for vk in state.active_layer_modifiers.difference(&desired) {
        effects.keys_to_release.push(*vk);
    }
    for vk in desired.difference(&state.active_layer_modifiers) {
        effects.keys_to_press.push(*vk);
    }

    state.active_layer_modifiers = desired;
}

/// 既存API互換のレイヤー合成修飾キーの収束関数（内部で即時送信を実行）
pub fn reconcile_layer_modifiers(
    state: &mut ProcessorState,
    config: &Config,
) {
    let mut effects = ReconcileEffects::new();
    reconcile_layer_modifiers_internal(state, config, &mut effects);
    effects.execute();
}

/// 既存API互換のレイヤー切り替え時修飾キー適用関数
pub fn apply_layer_modifiers(_old_layers: &[String], _new_layers: &[String], config: &Config) {
    let mut state = super::state::get_state().lock().unwrap();
    reconcile_layer_modifiers(&mut state, config);
}

/// モーメンタリキー解放時における、動的再同期・ゴースト化・透過キー同期・修飾キー収束の統合パイプライン
///
/// 状態の整合性（アトミック性）を担保するため、`state` のロックを保持したまま全計算と状態更新を行い、
/// OSへのキー送信が必要な副作用（ReconcileEffects）および新レイヤースタックを返す。
pub fn reconcile_momentary_on_release(
    state: &mut ProcessorState,
    config: &Config,
) -> (ReconcileEffects, Vec<String>) {
    let mut effects = ReconcileEffects::new();

    let base_layer = state.active_layers.first().cloned().unwrap_or_else(|| "base".to_string());
    let mut new_layers = vec![base_layer];
    let mut new_momentary_layers = std::collections::HashMap::new();

    // 残っているモーメンタリキーたちを、スタック追加時刻順（時系列昇順）でソート
    let mut remaining_keys: SmallVec<[(u16, std::time::Instant); 8]> = SmallVec::from_slice(&state.momentary_keys);
    remaining_keys.sort_by_key(|&(_, t)| t);

    // 再同期前に「透過中だったキー（PassthroughHoldActive）」の集合を記録
    let mut old_passthrough_keys: SmallVec<[u16; 4]> = SmallVec::new();
    for &(rem_vk, _) in &remaining_keys {
        if matches!(state.key_states.get(&rem_vk), Some(KeyState::PassthroughHoldActive { .. })) {
            old_passthrough_keys.push(rem_vk);
        }
    }

    let mut new_passthrough_keys: SmallVec<[u16; 4]> = SmallVec::new();

    for (rem_vk, _) in remaining_keys {
        if let Some((_, bindings)) = KeyProcessor::get_bindings_with_layer(rem_vk, config, &new_layers) {
            if let Some(hold_b) = bindings.iter().find(|b| b.trigger == Trigger::Hold) {
                if let Action::LayerMomentary { ref layer_id } = hold_b.action {
                    let hierarchy = actions::layer_momentary::get_layer_hierarchy(layer_id, config);
                    for lid in &hierarchy {
                        new_layers.push(lid.clone());
                    }
                    new_momentary_layers.insert(rem_vk, hierarchy);

                    // passthrough_trigger_key に応じて KeyState を双方向更新
                    let is_pt = config.layers.iter().find(|l| &l.id == layer_id)
                        .and_then(|l| l.passthrough_trigger_key)
                        .unwrap_or(false);
                    if let Some(ks) = state.key_states.get_mut(&rem_vk) {
                        match *ks {
                            KeyState::HoldActive { activated_at, last_repeated_at } if is_pt => {
                                *ks = KeyState::PassthroughHoldActive { activated_at, last_repeated_at };
                            }
                            KeyState::PassthroughHoldActive { activated_at, last_repeated_at } if !is_pt => {
                                *ks = KeyState::HoldActive { activated_at, last_repeated_at };
                            }
                            _ => {}
                        }
                    }

                    if is_pt {
                        new_passthrough_keys.push(rem_vk);
                    }
                    continue;
                }
            }
        }

        // もし親レイヤー解放等によりモーメンタリ設定を失った場合: ゴーストキーとしてマーク
        state.ghost_keys.insert(rem_vk);

        // 出力中の仮想キーがあれば解放対象へ回収
        if let Some(vks) = state.pressed_vks.remove(&rem_vk) {
            effects.keys_to_release.extend(vks);
        }

        // リピート遮断および物理修飾キー・モーメンタリ追跡の終了
        state.key_states.remove(&rem_vk);
        state.momentary_layers.remove(&rem_vk);
        if is_modifier(rem_vk) {
            state.physically_pressed_modifiers.remove(&rem_vk);
        }
    }

    // 生き残ったモーメンタリキーのみを残す（ゴースト化したキーを除外）
    state.momentary_keys.retain(|&(k, _)| new_momentary_layers.contains_key(&k));

    state.active_layers = new_layers.clone();
    state.momentary_layers = new_momentary_layers;

    let desired_injected = compute_desired_layer_modifiers(state, config);

    // 1. モーメンタリ透過キー（passthroughTriggerKey）の差分同期
    // old にあって new にないキー -> 解放
    for &pt_vk in &old_passthrough_keys {
        if !new_passthrough_keys.contains(&pt_vk) {
            if desired_injected.contains(&pt_vk) {
                // 新スタックのレイヤー合成修飾キーとして全く同一のキーコードが注入要求されているなら、
                // KeyUp を送らずにそのまま active_layer_modifiers へ引き継ぐ（完全ゼロチャタリング）
                state.active_layer_modifiers.insert(pt_vk);
            } else {
                effects.keys_to_release.push(pt_vk);
            }
        }
    }

    // new にあって old にないキー -> 押下
    for &pt_vk in &new_passthrough_keys {
        if !old_passthrough_keys.contains(&pt_vk) {
            if state.active_layer_modifiers.contains(&pt_vk) {
                // 既にレイヤー合成修飾キーとして注入されている場合は、物理透過キーへと引き継ぎ
                // レイヤー管理から除外する（OS上は既にDownされているため、追加のKeyDownもその後のKeyUpも不要）
                state.active_layer_modifiers.remove(&pt_vk);
            } else {
                effects.keys_to_press.push(pt_vk);
            }
        }
    }

    // 2. レイヤー合成修飾キーの宣言的収束 (Reconciliation)
    reconcile_layer_modifiers_internal(state, config, &mut effects);

    (effects, new_layers)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::key_processor::state::TEST_LOCK;

    #[test]
    fn test_reconcile_effects_basic() {
        let mut effects = ReconcileEffects::new();
        assert!(effects.is_empty());

        effects.keys_to_release.push(160);
        assert!(!effects.is_empty());
        assert_eq!(effects.keys_to_release.as_slice(), &[160]);

        effects.keys_to_press.push(162);
        assert_eq!(effects.keys_to_press.as_slice(), &[162]);
    }

    #[test]
    fn test_compute_desired_layer_modifiers_table_driven() {
        let _lock = TEST_LOCK.lock().unwrap();
        let mut config = crate::get_default_config();
        config.layers.clear();

        // layer_mods: shift, ctrl, alt, win を要求
        config.layers.push(crate::Layer {
            id: "layer_all_mods".to_string(),
            default_modifiers: Some(
                crate::model::ModifierOutput::new()
                    .with_shift(true)
                    .with_ctrl(true)
                    .with_alt(true)
                    .with_win(true),
            ),
            ..Default::default()
        });

        let mut state = ProcessorState::default();
        state.active_layers = vec!["base".to_string(), "layer_all_mods".to_string()];

        // 物理キーが何も押されていない場合 -> 4つの代表キーがすべて desired に含まれる
        let desired = compute_desired_layer_modifiers(&state, &config);
        assert!(desired.contains(&VK_LSHIFT));
        assert!(desired.contains(&VK_LCONTROL));
        assert!(desired.contains(&VK_LMENU));
        assert!(desired.contains(&VK_LWIN));

        // 物理キーとして VK_RSHIFT が素通し（透過）押下されている場合
        state.physically_pressed_modifiers.insert(crate::key_processor::utils::VK_RSHIFT);
        let desired_with_pt = compute_desired_layer_modifiers(&state, &config);
        // Shift は物理キーが肩代わりするため desired から除外される
        assert!(!desired_with_pt.contains(&VK_LSHIFT));
        // 他のキーは依然として desired に残る
        assert!(desired_with_pt.contains(&VK_LCONTROL));
        assert!(desired_with_pt.contains(&VK_LMENU));
        assert!(desired_with_pt.contains(&VK_LWIN));
    }
}

