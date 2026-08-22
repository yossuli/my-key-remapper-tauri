use serde_json::Value;

#[cfg(windows)]
mod hook;
#[cfg(windows)]
pub mod key_processor;
pub mod state_machine;


use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use arc_swap::ArcSwap;
use std::sync::Arc;
use tauri::{Manager, State};

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Binding {
    pub trigger: String,
    pub action: Value,
    #[serde(rename = "timingMs", skip_serializing_if = "Option::is_none")]
    pub timing_ms: Option<u32>,
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
    #[serde(skip)]
    pub macros: Vec<Value>,
}

pub struct ConfigState {
    pub config: ArcSwap<Config>,
}

#[tauri::command(rename = "get-mappings")]
fn get_mappings(state: State<'_, ConfigState>) -> Config {
    (**state.config.load()).clone()
}

fn get_config_path() -> std::path::PathBuf {
    let app_data = std::env::var("APPDATA").unwrap_or_else(|_| ".".to_string());
    std::path::PathBuf::from(app_data).join("my-key-remapper").join("key-mapping-config-v2.json")
}

fn get_macros_path() -> std::path::PathBuf {
    let app_data = std::env::var("APPDATA").unwrap_or_else(|_| ".".to_string());
    std::path::PathBuf::from(&app_data).join("my-key-remapper").join("key-mapping-macros-v2.json")
}

fn save_config_to_disk(config: &Config) {
    let config_path = get_config_path();
    if let Some(parent) = config_path.parent() {
        let _ = std::fs::create_dir_all(parent);
    }
    if let Ok(json) = serde_json::to_string_pretty(config) {
        match std::fs::write(&config_path, json) {
            Ok(_) => log::info!("Saved config to {:?}", config_path),
            Err(e) => log::error!("Failed to save config to {:?}: {}", config_path, e),
        }
    }
}

#[tauri::command(rename = "update-global-settings")]
fn update_global_settings(settings: Value, state: State<'_, ConfigState>) {
    log::info!("Update global settings: {:?}", settings);
    let mut config = (**state.config.load()).clone();
    if let Some(settings_obj) = settings.get("settings") {
        config.global_settings = settings_obj.clone();
        save_config_to_disk(&config);
        state.config.store(Arc::new(config));
    }
}

#[tauri::command(rename = "get-layer-stack")]
fn get_layer_stack() -> Vec<String> {
    // TODO: 実際の状態から取得するようにする
    vec!["base".to_string()]
}

#[tauri::command(rename = "get-pressed-keys")]
fn get_pressed_keys() -> Vec<u32> {
    vec![]
}

#[tauri::command(rename = "get-macros")]
fn get_macros(state: State<'_, ConfigState>) -> Value {
    let config = (**state.config.load()).clone();
    serde_json::to_value(&config.macros).unwrap_or(serde_json::json!([]))
}

#[tauri::command(rename = "save-macros")]
fn save_macros(macros: Vec<Value>, state: State<'_, ConfigState>) {
    log::info!("save_macros: {:?}", macros);
    let mut config = (**state.config.load()).clone();
    config.macros = macros.clone();
    
    let macros_path = get_macros_path();
    if let Some(parent) = macros_path.parent() {
        let _ = std::fs::create_dir_all(parent);
    }
    if let Ok(json) = serde_json::to_string_pretty(&macros) {
        if let Err(e) = std::fs::write(&macros_path, json) {
            log::error!("Failed to save macros to {:?}: {}", macros_path, e);
        } else {
            log::info!("Saved macros to {:?}", macros_path);
        }
    }
    
    state.config.store(Arc::new(config));
}

#[tauri::command(rename = "release-all-keys")]
fn release_all_keys() {
    log::info!("Release all keys");
}

#[tauri::command(rename = "get-screen-size")]
fn get_screen_size() -> Value {
    serde_json::json!({
        "width": 1920,
        "height": 1080
    })
}

#[tauri::command(rename = "get-cursor-position")]
fn get_cursor_position() -> Value {
    serde_json::json!({
        "x": 0,
        "y": 0
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
        save_config_to_disk(&config);
        state.config.store(Arc::new(config));
    }
}

#[tauri::command(rename = "set-remap-enabled")]
fn set_remap_enabled(enabled: bool) {
    log::info!("set_remap_enabled: {}", enabled);
    #[cfg(windows)]
    hook::REMAP_ENABLED.store(enabled, std::sync::atomic::Ordering::SeqCst);
}

#[tauri::command(rename = "add-layer")]
fn add_layer(layer_id: String) {
    // TODO: スタブ。実際には状態に反映する処理が必要
    log::info!("add_layer: {}", layer_id);
}

#[tauri::command(rename = "remove-layer")]
fn remove_layer(layer_id: String) {
    log::info!("remove_layer: {}", layer_id);
}

#[tauri::command(rename = "reorder-layers")]
fn reorder_layers(new_order: Vec<String>) {
    // TODO: スタブ。実際には状態に反映する処理が必要
    log::info!("reorder_layers: {:?}", new_order);
}

#[tauri::command(rename = "remove-binding")]
fn remove_binding(layer_id: String, from: u32, trigger: String, state: State<'_, ConfigState>) {
    log::info!("remove_binding: layer={}, from={}, trigger={}", layer_id, from, trigger);
    let mut config = (**state.config.load()).clone();
    if let Some(layer) = config.layers.iter_mut().find(|l| l.id == layer_id) {
        let from_str = from.to_string();
        if let Some(bindings_arr) = layer.bindings.get_mut(&from_str) {
            bindings_arr.retain(|b| b.trigger != trigger);
            save_config_to_disk(&config);
            state.config.store(Arc::new(config));
        }
    }
}

#[tauri::command(rename = "update-layer")]
fn update_layer(layer_id: String, updates: Value) {
    log::info!("update_layer: layer={}, updates={:?}", layer_id, updates);
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
            let mut loaded_config = None;
            let config_path = get_config_path();
            if let Ok(json) = std::fs::read_to_string(&config_path) {
                match serde_json::from_str::<Config>(&json) {
                    Ok(parsed) => {
                        loaded_config = Some(parsed);
                        log::info!("Loaded config from disk: {:?}", config_path);
                    },
                    Err(e) => {
                        log::error!("Failed to parse existing config ({:?}): {}", config_path, e);
                    }
                }
            }

            let macros_path = get_macros_path();
            let mut loaded_macros = Vec::new();
            if let Ok(json) = std::fs::read_to_string(&macros_path) {
                match serde_json::from_str::<Vec<Value>>(&json) {
                    Ok(parsed) => {
                        loaded_macros = parsed;
                        log::info!("Loaded macros from disk: {:?}", macros_path);
                    },
                    Err(e) => {
                        log::error!("Failed to parse existing macros as array ({:?}): {}. Trying as object.", macros_path, e);
                        if let Ok(parsed_obj) = serde_json::from_str::<Value>(&json) {
                            if let Some(macros_arr) = parsed_obj.get("macros").and_then(|v| v.as_array()) {
                                loaded_macros = macros_arr.clone();
                                log::info!("Loaded macros from disk (object format): {:?}", macros_path);
                            }
                        }
                    }
                }
            }

            let mut config_to_use = loaded_config.unwrap_or_else(|| {
                log::info!("Using default config");
                let config: Config = serde_json::from_value(serde_json::json!({
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
                    "macros": [],
                    "layerOrder": ["base", "shift"],
                    "globalSettings": {
                        "defaultHoldThresholdMs": 200,
                        "defaultTapIntervalMs": 300
                    }
                })).expect("Failed to parse initial config");

                // Save it right away
                save_config_to_disk(&config);

                config
            });

            config_to_use.macros = loaded_macros;

            app.manage(ConfigState { config: ArcSwap::from(Arc::new(config_to_use)) });

            #[cfg(windows)]
            hook::setup_hook(app.handle().clone());

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
            add_layer,
            remove_layer,
            reorder_layers,
            remove_binding,
            update_layer
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application");

    app.run(|_app_handle, event| match event {
        tauri::RunEvent::ExitRequested { .. } => {
            #[cfg(windows)]
            hook::teardown_hook();
        }
        _ => {}
    });
}
