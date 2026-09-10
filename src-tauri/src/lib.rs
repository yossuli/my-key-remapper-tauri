use serde_json::Value;

#[cfg(windows)]
mod hook;
#[cfg(windows)]
pub mod raw_input;
#[cfg(windows)]
pub mod key_processor;
pub mod state_machine;
pub mod profile;
pub mod model;

pub use model::*;

use std::collections::HashMap;
use arc_swap::ArcSwap;
use std::sync::{Arc, Mutex};
use tauri::{Manager, State};

pub struct ConfigState {
    pub config: ArcSwap<Config>,
    pub active_profile: Mutex<String>,
}

#[tauri::command(rename = "get-mappings")]
fn get_mappings(state: State<'_, ConfigState>) -> Config {
    (**state.config.load()).clone()
}

pub fn get_default_config() -> Config {
    Config {
        version: 1,
        layers: vec![
            Layer {
                id: "base".to_string(),
                bindings: HashMap::from([
                    (
                        160,
                        vec![Binding {
                            trigger: Trigger::Hold,
                            action: Action::LayerMomentary {
                                layer_id: "shift".to_string(),
                            },
                            timing_ms: None,
                            interrupt_behavior: None,
                        }],
                    ),
                    (
                        161,
                        vec![Binding {
                            trigger: Trigger::Hold,
                            action: Action::LayerMomentary {
                                layer_id: "shift".to_string(),
                            },
                            timing_ms: None,
                            interrupt_behavior: None,
                        }],
                    ),
                ]),
                default_modifiers: None,
                passthrough_trigger_key: None,
                parent_layer_id: None,
            },
            Layer {
                id: "shift".to_string(),
                bindings: HashMap::new(),
                default_modifiers: Some(ModifierOutput::new().with_shift(true)),
                passthrough_trigger_key: Some(true),
                parent_layer_id: None,
            },
        ],
        layer_order: vec!["base".to_string(), "shift".to_string()],
        global_settings: serde_json::json!({
            "defaultHoldThresholdMs": 200,
            "defaultTapIntervalMs": 300
        }),
        macros: vec![MacroDef {
            id: "cursor-return-macro".to_string(),
            name: "カーソル位置を記憶して復帰".to_string(),
            actions: vec![
                Action::CursorSave,
                Action::Delay { delay_ms: 50 },
                Action::CursorRestore,
            ],
        }],
    }
}

fn save_current_config(config: &Config, state: &State<'_, ConfigState>) {
    let active_profile = state.active_profile.lock().unwrap().clone();
    profile::save_config_to_disk(config, &active_profile);
}

#[tauri::command(rename = "update-global-settings")]
fn update_global_settings(settings: Value, state: State<'_, ConfigState>) {
    log::info!("Update global settings: {:?}", settings);
    let mut config = (**state.config.load()).clone();
    if let Some(settings_obj) = settings.get("settings") {
        config.global_settings = settings_obj.clone();
        save_current_config(&config, &state);
        state.config.store(Arc::new(config));
    }
}

#[tauri::command(rename = "get-layer-stack")]
fn get_layer_stack() -> Vec<String> {
    #[cfg(windows)]
    {
        crate::key_processor::state::get_state_wrapper().mutex.lock().unwrap().active_layers.clone()
    }
    #[cfg(not(windows))]
    {
        vec!["base".to_string()]
    }
}

#[tauri::command(rename = "get-pressed-keys")]
fn get_pressed_keys() -> Vec<u32> {
    #[cfg(windows)]
    {
        let state = crate::key_processor::state::get_state_wrapper().mutex.lock().unwrap();
        let mut active_keys: std::collections::HashSet<u32> = std::collections::HashSet::new();
        for (&vk, vks) in &state.pressed_vks {
            if !vks.is_empty() {
                active_keys.insert(vk as u32);
            }
        }
        for &vk in state.key_states.keys() {
            active_keys.insert(vk as u32);
        }
        active_keys.into_iter().collect()
    }
    #[cfg(not(windows))]
    {
        vec![]
    }
}

#[tauri::command(rename = "get-macros")]
fn get_macros(state: State<'_, ConfigState>) -> Vec<MacroDef> {
    let config = (**state.config.load()).clone();
    config.macros
}

#[tauri::command(rename = "save-macros")]
fn save_macros(macros: Vec<MacroDef>, state: State<'_, ConfigState>) {
    log::info!("save_macros: {:?}", macros);
    let mut config = (**state.config.load()).clone();
    config.macros = macros;
    save_current_config(&config, &state);
    state.config.store(Arc::new(config));
}

#[tauri::command(rename = "release-all-keys")]
fn release_all_keys() {
    log::info!("Release all keys invoked - releasing all tracked and virtual keys");
    #[cfg(windows)]
    {
        crate::key_processor::utils::release_all_virtual_keys();
    }
}

#[tauri::command(rename = "get-screen-size")]
fn get_screen_size() -> Value {
    let (width, height) = crate::key_processor::utils::get_screen_size();
    serde_json::json!({
        "width": width,
        "height": height
    })
}

#[tauri::command(rename = "get-cursor-position")]
fn get_cursor_position() -> Value {
    let (x, y) = crate::key_processor::utils::get_mouse_pos();
    serde_json::json!({
        "x": x,
        "y": y
    })
}

#[tauri::command(rename = "set-debug-log-enabled")]
fn set_debug_log_enabled(enabled: bool) {
    log::info!("Set debug log enabled: {}", enabled);
}

#[tauri::command(rename = "save-key-config")]
fn save_key_config(layer_id: String, from: u32, binding: Binding, state: State<'_, ConfigState>) {
    log::info!("save_key_config: layer_id={}, from={}, binding={:?}", layer_id, from, binding);
    let mut config = (**state.config.load()).clone();
    if let Some(layer) = config.layers.iter_mut().find(|l| l.id == layer_id) {
        let from_vk = from as u16;
        let bindings_arr = layer.bindings.entry(from_vk).or_default();
        bindings_arr.retain(|b| b.trigger != binding.trigger);
        bindings_arr.push(binding);
        save_current_config(&config, &state);
        state.config.store(Arc::new(config));
    }
}

#[tauri::command(rename = "set-remap-enabled")]
fn set_remap_enabled(enabled: bool) {
    log::info!("set_remap_enabled: {}", enabled);
    #[cfg(windows)]
    hook::REMAP_ENABLED.store(enabled, std::sync::atomic::Ordering::SeqCst);
}

#[tauri::command(rename = "get-remap-enabled")]
fn get_remap_enabled() -> bool {
    #[cfg(windows)]
    {
        hook::REMAP_ENABLED.load(std::sync::atomic::Ordering::SeqCst)
    }
    #[cfg(not(windows))]
    {
        true
    }
}

#[tauri::command(rename = "add-layer")]
fn add_layer(layer_id: String, state: State<'_, ConfigState>) {
    log::info!("add_layer: {}", layer_id);
    let mut config = (**state.config.load()).clone();
    if !config.layers.iter().any(|l| l.id == layer_id) {
        config.layers.push(Layer {
            id: layer_id.clone(),
            bindings: HashMap::new(),
            default_modifiers: None,
            passthrough_trigger_key: None,
            parent_layer_id: None,
        });
        config.layer_order.push(layer_id);
        save_current_config(&config, &state);
        state.config.store(Arc::new(config));
    }
}

pub fn remove_layer_internal(config: &mut Config, layer_id: &str) -> Result<(), String> {
    if layer_id == "base" {
        return Err("baseレイヤーは削除できません。".to_string());
    }
    let initial_count = config.layers.len();
    config.layers.retain(|l| l.id != layer_id);
    if config.layers.len() == initial_count {
        return Err(format!("レイヤー '{}' が見つかりません。", layer_id));
    }
    config.layer_order.retain(|id| id != layer_id);
    Ok(())
}

#[tauri::command(rename = "remove-layer")]
fn remove_layer(layer_id: String, state: State<'_, ConfigState>) -> Result<(), String> {
    log::info!("remove_layer: {}", layer_id);
    let mut config = (**state.config.load()).clone();
    remove_layer_internal(&mut config, &layer_id)?;
    save_current_config(&config, &state);
    state.config.store(Arc::new(config));
    Ok(())
}

#[tauri::command(rename = "reorder-layers")]
fn reorder_layers(new_order: Vec<String>, state: State<'_, ConfigState>) {
    log::info!("reorder_layers: {:?}", new_order);
    let mut config = (**state.config.load()).clone();
    config.layer_order = new_order;
    save_current_config(&config, &state);
    state.config.store(Arc::new(config));
}

#[tauri::command(rename = "remove-binding")]
fn remove_binding(layer_id: String, from: u32, trigger: Trigger, state: State<'_, ConfigState>) {
    log::info!("remove_binding: layer={}, from={}, trigger={:?}", layer_id, from, trigger);
    let mut config = (**state.config.load()).clone();
    if let Some(layer) = config.layers.iter_mut().find(|l| l.id == layer_id) {
        let from_vk = from as u16;
        if let Some(bindings_arr) = layer.bindings.get_mut(&from_vk) {
            bindings_arr.retain(|b| b.trigger != trigger);
            save_current_config(&config, &state);
            state.config.store(Arc::new(config));
        }
    }
}

#[tauri::command(rename = "move-key-mappings")]
fn move_key_mappings(
    from_vk: u32,
    to_vk: u32,
    layer_ids: Vec<String>,
    state: State<'_, ConfigState>,
) {
    log::info!(
        "move_key_mappings: from_vk={}, to_vk={}, layer_ids={:?}",
        from_vk,
        to_vk,
        layer_ids
    );
    let mut config = (**state.config.load()).clone();
    let src = from_vk as u16;
    let dst = to_vk as u16;
    let mut modified = false;

    for layer in config.layers.iter_mut() {
        if layer_ids.contains(&layer.id) {
            if let Some(bindings) = layer.bindings.remove(&src) {
                layer.bindings.insert(dst, bindings);
                modified = true;
            }
        }
    }

    if modified {
        save_current_config(&config, &state);
        state.config.store(Arc::new(config));
    }
}

pub fn update_layer_internal(config: &mut Config, layer_id: &str, updates: &Value) -> Result<(), String> {
    if let Some(new_id) = updates.get("id").and_then(|v| v.as_str()) {
        if layer_id == "base" && new_id != "base" {
            return Err("baseレイヤーのIDは変更できません。".to_string());
        }
        if layer_id != "base" && new_id == "base" {
            return Err("baseというIDへの変更は禁止されています。".to_string());
        }
        let trimmed_new_id = new_id.trim();
        if trimmed_new_id.is_empty() {
            return Err("レイヤーIDを空にすることはできません。".to_string());
        }
        if new_id != layer_id && config.layers.iter().any(|l| l.id == new_id) {
            return Err(format!("レイヤー '{}' は既に存在します。", new_id));
        }
    }

    let rename_info = if let Some(new_id) = updates.get("id").and_then(|v| v.as_str()) {
        if new_id != layer_id {
            Some((layer_id.to_string(), new_id.to_string()))
        } else {
            None
        }
    } else {
        None
    };

    if let Some(layer) = config.layers.iter_mut().find(|l| l.id == layer_id) {
        if let Some(default_modifiers) = updates.get("defaultModifiers") {
            if let Ok(mods) = serde_json::from_value::<ModifierOutput>(default_modifiers.clone()) {
                layer.default_modifiers = Some(mods);
            }
        }
        if let Some(passthrough) = updates.get("passthroughTriggerKey").and_then(|v| v.as_bool()) {
            layer.passthrough_trigger_key = Some(passthrough);
        }
        if let Some(parent_val) = updates.get("parentLayerId") {
            if parent_val.is_null() {
                layer.parent_layer_id = None;
            } else if let Some(parent_str) = parent_val.as_str() {
                let trimmed = parent_str.trim();
                if trimmed.is_empty() || trimmed == "__none__" {
                    layer.parent_layer_id = None;
                } else {
                    layer.parent_layer_id = Some(trimmed.to_string());
                }
            }
        }
        if let Some((_, ref new_id)) = rename_info {
            layer.id = new_id.clone();
        }
    } else {
        return Err(format!("レイヤー '{}' が見つかりません。", layer_id));
    }

    if let Some((ref old_id, ref new_id)) = rename_info {
        // layer_order の更新
        for id in &mut config.layer_order {
            if *id == *old_id {
                *id = new_id.clone();
            }
        }
        // 他レイヤーの parent_layer_id およびキーバインディング内アクションの参照カスケード更新
        for l in &mut config.layers {
            if l.parent_layer_id.as_deref() == Some(old_id.as_str()) {
                l.parent_layer_id = Some(new_id.clone());
            }
            for bindings_vec in l.bindings.values_mut() {
                for binding in bindings_vec.iter_mut() {
                    match &mut binding.action {
                        Action::LayerMomentary { layer_id: target_lid } if target_lid == old_id => {
                            *target_lid = new_id.clone();
                        }
                        Action::LayerToggle { layer_id: target_lid } if target_lid == old_id => {
                            *target_lid = new_id.clone();
                        }
                        _ => {}
                    }
                }
            }
        }
    }

    Ok(())
}

#[tauri::command(rename = "update-layer")]
fn update_layer(layer_id: String, updates: Value, state: State<'_, ConfigState>) -> Result<(), String> {
    log::info!("update_layer: layer={}, updates={:?}", layer_id, updates);
    let mut config = (**state.config.load()).clone();
    update_layer_internal(&mut config, &layer_id, &updates)?;
    save_current_config(&config, &state);
    state.config.store(Arc::new(config));
    Ok(())
}

#[tauri::command(rename = "reset-layer")]
fn reset_layer(layer_id: String, state: State<'_, ConfigState>) {
    log::info!("reset_layer: {}", layer_id);
    let config = (**state.config.load()).clone();
    let (old_layers, new_layers) = {
        let mut p_state = crate::key_processor::state::get_state().lock().unwrap();
        let old_layers = p_state.active_layers.clone();
        p_state.active_layers = vec![layer_id];
        p_state.momentary_layers.clear();
        (old_layers, p_state.active_layers.clone())
    };
    crate::key_processor::utils::apply_layer_modifiers(&old_layers, &new_layers, &config);
    #[cfg(windows)]
    crate::hook::emit_layer_stack_changed(&new_layers);
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app = tauri::Builder::default()
        .plugin(
            tauri_plugin_log::Builder::new()
                .level(log::LevelFilter::Info)
                .build()
        )
        .setup(|app| {
            let (config_to_use, active_profile) = profile::initialize_profiles();

            app.manage(ConfigState {
                config: ArcSwap::from(Arc::new(config_to_use)),
                active_profile: Mutex::new(active_profile),
            });

            #[cfg(windows)]
            {
                hook::setup_hook(app.handle().clone());
                raw_input::start_raw_input_listener();
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_mappings,
            update_global_settings,
            get_screen_size,
            get_cursor_position,
            set_debug_log_enabled,
            get_layer_stack,
            get_pressed_keys,
            get_macros,
            save_macros,
            release_all_keys,
            save_key_config,
            set_remap_enabled,
            get_remap_enabled,
            add_layer,
            remove_layer,
            reorder_layers,
            remove_binding,
            move_key_mappings,
            update_layer,
            reset_layer,
            profile::list_profiles,
            profile::load_profile,
            profile::copy_profile,
            profile::copy_profile_with_dialog,
            profile::import_profile_with_dialog,
            profile::export_profile_with_dialog,
            profile::create_profile,
            profile::delete_profile
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application");

    app.run(|_app_handle, event| match event {
        tauri::RunEvent::ExitRequested { .. } => {
            #[cfg(windows)]
            {
                raw_input::stop_raw_input_listener();
                hook::teardown_hook();
            }
        }
        _ => {}
    });
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashMap;

    #[test]
    fn test_move_key_mappings_logic() {
        let mut layers = vec![
            Layer {
                id: "base".to_string(),
                bindings: {
                    let mut map = HashMap::new();
                    map.insert(
                        65u16,
                        vec![Binding {
                            trigger: Trigger::Tap,
                            action: Action::None,
                            timing_ms: None,
                            interrupt_behavior: None,
                        }],
                    );
                    map
                },
                ..Default::default()
            },
            Layer {
                id: "fn".to_string(),
                bindings: {
                    let mut map = HashMap::new();
                    map.insert(
                        65u16,
                        vec![Binding {
                            trigger: Trigger::Hold,
                            action: Action::None,
                            timing_ms: None,
                            interrupt_behavior: None,
                        }],
                    );
                    map
                },
                ..Default::default()
            },
        ];

        let from_vk = 65u16;
        let to_vk = 66u16;
        let target_layer_ids = vec!["base".to_string(), "fn".to_string()];

        for layer in layers.iter_mut() {
            if target_layer_ids.contains(&layer.id) {
                if let Some(bindings) = layer.bindings.remove(&from_vk) {
                    layer.bindings.insert(to_vk, bindings);
                }
            }
        }

        assert!(!layers[0].bindings.contains_key(&65));
        assert!(layers[0].bindings.contains_key(&66));
        assert_eq!(layers[0].bindings.get(&66).unwrap()[0].trigger, Trigger::Tap);

        assert!(!layers[1].bindings.contains_key(&65));
        assert!(layers[1].bindings.contains_key(&66));
        assert_eq!(layers[1].bindings.get(&66).unwrap()[0].trigger, Trigger::Hold);
    }

    #[test]
    fn test_remove_base_layer_prohibited() {
        let mut config = crate::get_default_config();
        let result = remove_layer_internal(&mut config, "base");
        assert!(result.is_err());
        assert_eq!(result.unwrap_err(), "baseレイヤーは削除できません。");
        // base レイヤーが依然として存在することを確認
        assert!(config.layers.iter().any(|l| l.id == "base"));
    }

    #[test]
    fn test_remove_layer_success_and_not_found() {
        let mut config = crate::get_default_config();
        // 新しいレイヤーを追加
        config.layers.push(Layer {
            id: "custom".to_string(),
            bindings: HashMap::new(),
            ..Default::default()
        });
        config.layer_order.push("custom".to_string());

        // 正常削除
        assert!(remove_layer_internal(&mut config, "custom").is_ok());
        assert!(!config.layers.iter().any(|l| l.id == "custom"));
        assert!(!config.layer_order.contains(&"custom".to_string()));

        // 存在しないレイヤーの削除
        let not_found_result = remove_layer_internal(&mut config, "non_existent");
        assert!(not_found_result.is_err());
        assert_eq!(not_found_result.unwrap_err(), "レイヤー 'non_existent' が見つかりません。");
    }

    #[test]
    fn test_update_base_layer_id_prohibited() {
        let mut config = crate::get_default_config();
        
        // base レイヤーの改名試行
        let rename_base = serde_json::json!({ "id": "renamed_base" });
        let result = update_layer_internal(&mut config, "base", &rename_base);
        assert!(result.is_err());
        assert_eq!(result.unwrap_err(), "baseレイヤーのIDは変更できません。");
        assert_eq!(config.layers[0].id, "base");

        // 別レイヤーを base へ改名する試行
        config.layers.push(Layer {
            id: "custom".to_string(),
            bindings: HashMap::new(),
            ..Default::default()
        });
        config.layer_order.push("custom".to_string());

        let rename_to_base = serde_json::json!({ "id": "base" });
        let result = update_layer_internal(&mut config, "custom", &rename_to_base);
        assert!(result.is_err());
        assert_eq!(result.unwrap_err(), "baseというIDへの変更は禁止されています。");
    }

    #[test]
    fn test_update_layer_validations_and_success() {
        let mut config = crate::get_default_config();
        config.layers.push(Layer {
            id: "fn".to_string(),
            bindings: HashMap::new(),
            ..Default::default()
        });
        config.layer_order.push("fn".to_string());

        // 重複IDへの改名試行
        let duplicate_id = serde_json::json!({ "id": "fn" });
        // base を fn にしようとするのは上の base ガードで止まるが、もう一つレイヤーを用意
        config.layers.push(Layer {
            id: "layer3".to_string(),
            bindings: HashMap::new(),
            ..Default::default()
        });
        config.layer_order.push("layer3".to_string());

        let result = update_layer_internal(&mut config, "layer3", &duplicate_id);
        assert!(result.is_err());
        assert_eq!(result.unwrap_err(), "レイヤー 'fn' は既に存在します。");

        // 空IDへの改名試行
        let empty_id = serde_json::json!({ "id": "   " });
        let result = update_layer_internal(&mut config, "layer3", &empty_id);
        assert!(result.is_err());
        assert_eq!(result.unwrap_err(), "レイヤーIDを空にすることはできません。");

        // 正常な更新（ID変更と親レイヤー設定）
        let valid_update = serde_json::json!({
            "id": "fn_renamed",
            "parentLayerId": "base"
        });
        assert!(update_layer_internal(&mut config, "fn", &valid_update).is_ok());
        assert!(config.layers.iter().any(|l| l.id == "fn_renamed"));
        assert!(config.layer_order.contains(&"fn_renamed".to_string()));
        assert!(!config.layer_order.contains(&"fn".to_string()));
        let updated_layer = config.layers.iter().find(|l| l.id == "fn_renamed").unwrap();
        assert_eq!(updated_layer.parent_layer_id.as_deref(), Some("base"));
    }

    #[test]
    fn test_update_layer_cascading_references() {
        let mut config = crate::get_default_config();

        // 対象レイヤー "fn" を追加
        config.layers.push(Layer {
            id: "fn".to_string(),
            bindings: HashMap::new(),
            ..Default::default()
        });
        config.layer_order.push("fn".to_string());

        // 子レイヤー "sub_fn" を追加（親レイヤーに "fn" を指定）
        config.layers.push(Layer {
            id: "sub_fn".to_string(),
            parent_layer_id: Some("fn".to_string()),
            bindings: HashMap::new(),
            ..Default::default()
        });
        config.layer_order.push("sub_fn".to_string());

        // base レイヤーのキーバインディングに "fn" を参照するアクションを追加
        let mut bindings = HashMap::new();
        bindings.insert(
            65u16,
            vec![
                crate::Binding {
                    trigger: crate::Trigger::Hold,
                    action: Action::LayerMomentary { layer_id: "fn".to_string() },
                    timing_ms: None,
                    interrupt_behavior: None,
                },
                crate::Binding {
                    trigger: crate::Trigger::Tap,
                    action: Action::LayerToggle { layer_id: "fn".to_string() },
                    timing_ms: None,
                    interrupt_behavior: None,
                },
            ],
        );
        config.layers[0].bindings = bindings;

        // "fn" を "fn_v2" に改名
        let rename_update = serde_json::json!({ "id": "fn_v2" });
        assert!(update_layer_internal(&mut config, "fn", &rename_update).is_ok());

        // 1. レイヤー自体の ID が変更されていること
        assert!(config.layers.iter().any(|l| l.id == "fn_v2"));
        assert!(!config.layers.iter().any(|l| l.id == "fn"));

        // 2. 子レイヤーの parent_layer_id が "fn_v2" にカスケード更新されていること
        let sub_layer = config.layers.iter().find(|l| l.id == "sub_fn").unwrap();
        assert_eq!(sub_layer.parent_layer_id.as_deref(), Some("fn_v2"));

        // 3. キーバインディング内の Action::LayerMomentary と Action::LayerToggle が "fn_v2" にカスケード更新されていること
        let base_bindings = config.layers[0].bindings.get(&65).unwrap();
        match &base_bindings[0].action {
            Action::LayerMomentary { layer_id } => assert_eq!(layer_id, "fn_v2"),
            _ => panic!("Expected LayerMomentary"),
        }
        match &base_bindings[1].action {
            Action::LayerToggle { layer_id } => assert_eq!(layer_id, "fn_v2"),
            _ => panic!("Expected LayerToggle"),
        }
    }
}
