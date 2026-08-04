use serde_json::Value;

#[cfg(windows)]
mod hook;

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
fn get_mappings() -> Value {
    // Return empty / default config
    serde_json::json!({
        "globalSettings": {},
        "layers": [],
        "macros": [],
        "layerOrder": []
    })
}

#[tauri::command]
fn update_global_settings(settings: Value) {
    println!("Update global settings: {:?}", settings);
}

#[tauri::command]
fn get_screen_size() -> Value {
    serde_json::json!({
        "width": 1920,
        "height": 1080
    })
}

#[tauri::command]
fn get_cursor_position() -> Value {
    serde_json::json!({
        "x": 0,
        "y": 0
    })
}

#[tauri::command]
fn set_debug_log_enabled(enabled: bool) {
    println!("Set debug log enabled: {}", enabled);
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_log::Builder::new().build())
        .setup(|_app| {
            #[cfg(windows)]
            hook::setup_hook();
            
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            greet,
            get_mappings,
            update_global_settings,
            get_screen_size,
            get_cursor_position,
            set_debug_log_enabled
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
