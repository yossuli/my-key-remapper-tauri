use serde_json::Value;

#[cfg(windows)]
mod hook;

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::RwLock;
use tauri::State;

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Binding {
    pub trigger: String,
    pub action: Value,
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

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Config {
    pub version: u32,
    pub layers: Vec<Layer>,
    pub macros: Vec<Value>,
    pub layer_order: Vec<String>,
    pub global_settings: Value,
}

pub struct ConfigState {
    pub config: RwLock<Config>,
}

#[tauri::command(rename = "get-mappings")]
fn get_mappings(state: State<'_, ConfigState>) -> Config {
    state.config.read().unwrap().clone()
}

#[tauri::command(rename = "update-global-settings")]
fn update_global_settings(settings: Value, state: State<'_, ConfigState>) {
    println!("Update global settings: {:?}", settings);
    if let Some(settings_obj) = settings.get("settings") {
        state.config.write().unwrap().global_settings = settings_obj.clone();
    }
}

#[tauri::command(rename = "get-layer-stack")]
fn get_layer_stack() -> Vec<String> {
    vec!["base".to_string()]
}

#[tauri::command(rename = "get-pressed-keys")]
fn get_pressed_keys() -> Vec<u32> {
    vec![]
}

#[tauri::command(rename = "get-macros")]
fn get_macros() -> Value {
    serde_json::json!([])
}

#[tauri::command(rename = "release-all-keys")]
fn release_all_keys() {
    println!("Release all keys");
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
    println!("Set debug log enabled: {}", enabled);
}

#[tauri::command(rename = "save-key-config")]
fn save_key_config(layer_id: String, from: u32, binding: Binding, state: State<'_, ConfigState>) {
    println!("save_key_config: layer_id={}, from={}, binding={:?}", layer_id, from, binding);
    let mut config = state.config.write().unwrap();
    if let Some(layer) = config.layers.iter_mut().find(|l| l.id == layer_id) {
        let from_str = from.to_string();
        let bindings_arr = layer.bindings.entry(from_str).or_insert_with(Vec::new);
        bindings_arr.push(binding);
    }
}

#[tauri::command(rename = "set-remap-enabled")]
fn set_remap_enabled(enabled: bool) {
    println!("set_remap_enabled: {}", enabled);
    #[cfg(windows)]
    hook::REMAP_ENABLED.store(enabled, std::sync::atomic::Ordering::SeqCst);
}

#[tauri::command(rename = "add-layer")]
fn add_layer(layer_id: String) {
    println!("add_layer: {}", layer_id);
}

#[tauri::command(rename = "remove-layer")]
fn remove_layer(layer_id: String) {
    println!("remove_layer: {}", layer_id);
}

#[tauri::command(rename = "reorder-layers")]
fn reorder_layers(new_order: Vec<String>) {
    println!("reorder_layers: {:?}", new_order);
}

#[tauri::command(rename = "remove-binding")]
fn remove_binding(layer_id: String, from: u32, trigger: String, state: State<'_, ConfigState>) {
    println!("remove_binding: layer={}, from={}, trigger={}", layer_id, from, trigger);
    let mut config = state.config.write().unwrap();
    if let Some(layer) = config.layers.iter_mut().find(|l| l.id == layer_id) {
        let from_str = from.to_string();
        if let Some(bindings_arr) = layer.bindings.get_mut(&from_str) {
            bindings_arr.retain(|b| b.trigger != trigger);
        }
    }
}

#[tauri::command(rename = "update-layer")]
fn update_layer(layer_id: String, updates: Value) {
    println!("update_layer: layer={}, updates={:?}", layer_id, updates);
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let initial_config: Config = serde_json::from_value(serde_json::json!({
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

    tauri::Builder::default()
        .manage(ConfigState { config: RwLock::new(initial_config) })
        .plugin(
            tauri_plugin_log::Builder::new()
                .level(log::LevelFilter::Info)
                .build()
        )
        .setup(|app| {
            #[cfg(windows)]
            hook::setup_hook(app.handle().clone());
            
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            greet,
            get_mappings,
            update_global_settings,
            get_screen_size,
            get_cursor_position,
            set_debug_log_enabled,
            get_layer_stack,
            get_pressed_keys,
            get_macros,
            release_all_keys,
            save_key_config,
            set_remap_enabled,
            add_layer,
            remove_layer,
            reorder_layers,
            remove_binding,
            update_layer
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
