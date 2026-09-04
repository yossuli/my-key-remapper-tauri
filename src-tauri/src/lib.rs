use serde_json::Value;

#[cfg(windows)]
mod hook;
#[cfg(windows)]
pub mod raw_input;
#[cfg(windows)]
pub mod key_processor;
pub mod state_machine;
pub mod profile;

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use arc_swap::ArcSwap;
use std::sync::{Arc, Mutex};
use tauri::{Manager, State};

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Binding {
    pub trigger: String,
    pub action: Value,
    #[serde(rename = "timingMs", skip_serializing_if = "Option::is_none")]
    pub timing_ms: Option<u32>,
    #[serde(rename = "interruptBehavior", skip_serializing_if = "Option::is_none")]
    pub interrupt_behavior: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Layer {
    pub id: String,
    #[serde(default)]
    pub bindings: HashMap<String, Vec<Binding>>,
    #[serde(default)]
    pub default_modifiers: Option<Value>,
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
#[serde(rename_all = "camelCase")]
pub struct Config {
    #[serde(default)]
    pub version: u32,
    #[serde(default)]
    pub layers: Vec<Layer>,
    #[serde(default)]
    pub layer_order: Vec<String>,
    #[serde(default)]
    pub global_settings: Value,
    #[serde(default)]
    pub macros: Vec<Value>,
}

pub struct ConfigState {
    pub config: ArcSwap<Config>,
    pub active_profile: Mutex<String>,
}

#[tauri::command(rename = "get-mappings")]
fn get_mappings(state: State<'_, ConfigState>) -> Config {
    (**state.config.load()).clone()
}

pub fn get_default_config() -> Config {
    serde_json::from_value(serde_json::json!({
        "version": 1,
        "layers": [
            {
                "id": "base",
                "bindings": {
                    "160": [{"trigger": "hold", "action": {"type": "layerMomentary", "layerId": "shift"}}],
                    "161": [{"trigger": "hold", "action": {"type": "layerMomentary", "layerId": "shift"}}]
                }
            },
            {
                "id": "shift",
                "bindings": {},
                "defaultModifiers": {"shift": true}
            }
        ],
        "macros": [
            {
                "id": "cursor-return-macro",
                "name": "カーソル位置を記憶して復帰",
                "actions": [
                    { "type": "cursorSave" },
                    { "type": "delay", "delayMs": 50 },
                    { "type": "cursorRestore" }
                ]
            }
        ],
        "layerOrder": ["base", "shift"],
        "globalSettings": {
            "defaultHoldThresholdMs": 200,
            "defaultTapIntervalMs": 300
        }
    })).expect("Failed to parse initial config")
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
        crate::key_processor::utils::reconcile_physical_keys();

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
fn get_macros(state: State<'_, ConfigState>) -> Value {
    let mut config = (**state.config.load()).clone();
    if config.macros.is_empty() {
        profile::ensure_macros_loaded(&mut config);
        if !config.macros.is_empty() {
            save_current_config(&config, &state);
            state.config.store(Arc::new(config.clone()));
        }
    }
    serde_json::to_value(&config.macros).unwrap_or(serde_json::json!([]))
}

#[tauri::command(rename = "save-macros")]
fn save_macros(macros: Vec<Value>, state: State<'_, ConfigState>) {
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
        let from_str = from.to_string();
        let bindings_arr = layer.bindings.entry(from_str).or_insert_with(Vec::new);
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
        });
        config.layer_order.push(layer_id);
        save_current_config(&config, &state);
        state.config.store(Arc::new(config));
    }
}

#[tauri::command(rename = "remove-layer")]
fn remove_layer(layer_id: String, state: State<'_, ConfigState>) {
    log::info!("remove_layer: {}", layer_id);
    let mut config = (**state.config.load()).clone();
    config.layers.retain(|l| l.id != layer_id);
    config.layer_order.retain(|id| id != &layer_id);
    save_current_config(&config, &state);
    state.config.store(Arc::new(config));
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
fn remove_binding(layer_id: String, from: u32, trigger: String, state: State<'_, ConfigState>) {
    log::info!("remove_binding: layer={}, from={}, trigger={}", layer_id, from, trigger);
    let mut config = (**state.config.load()).clone();
    if let Some(layer) = config.layers.iter_mut().find(|l| l.id == layer_id) {
        let from_str = from.to_string();
        if let Some(bindings_arr) = layer.bindings.get_mut(&from_str) {
            bindings_arr.retain(|b| b.trigger != trigger);
            save_current_config(&config, &state);
            state.config.store(Arc::new(config));
        }
    }
}

#[tauri::command(rename = "update-layer")]
fn update_layer(layer_id: String, updates: Value, state: State<'_, ConfigState>) {
    log::info!("update_layer: layer={}, updates={:?}", layer_id, updates);
    let mut config = (**state.config.load()).clone();
    if let Some(layer) = config.layers.iter_mut().find(|l| l.id == layer_id) {
        if let Some(default_modifiers) = updates.get("defaultModifiers") {
            layer.default_modifiers = Some(default_modifiers.clone());
        }
        if let Some(new_id) = updates.get("id").and_then(|v| v.as_str()) {
            if new_id != layer_id {
                layer.id = new_id.to_string();
                for id in &mut config.layer_order {
                    if *id == layer_id {
                        *id = new_id.to_string();
                    }
                }
            }
        }
        save_current_config(&config, &state);
        state.config.store(Arc::new(config));
    }
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
            update_layer,
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
