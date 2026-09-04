use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::fs;
use std::path::PathBuf;
use std::sync::Arc;
use tauri::State;

use crate::{Config, ConfigState};

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ProfileListResponse {
    pub profiles: Vec<String>,
    pub active_profile: String,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ActiveProfileMeta {
    active_profile: String,
}

pub fn get_app_data_dir() -> PathBuf {
    let app_data = std::env::var("APPDATA").unwrap_or_else(|_| ".".to_string());
    PathBuf::from(app_data).join("my-key-remapper")
}

pub fn get_profiles_dir() -> PathBuf {
    get_app_data_dir().join("profiles")
}

pub fn get_active_profile_meta_path() -> PathBuf {
    get_app_data_dir().join("active_profile.json")
}

pub fn get_profile_path(name: &str) -> PathBuf {
    get_profiles_dir().join(format!("{}.json", name))
}

pub fn get_legacy_macros_path() -> PathBuf {
    get_app_data_dir().join("key-mapping-macros-v2.json")
}

pub fn ensure_macros_loaded(config: &mut Config) {
    if config.macros.is_empty() {
        let legacy_path = get_legacy_macros_path();
        if legacy_path.exists() {
            if let Ok(content) = fs::read_to_string(&legacy_path) {
                if let Ok(macros) = serde_json::from_str::<Vec<Value>>(&content) {
                    if !macros.is_empty() {
                        log::info!("Loaded {} legacy macros from {:?}", macros.len(), legacy_path);
                        config.macros = macros;
                    }
                }
            }
        }
    }
}

pub fn validate_profile_name(name: &str) -> Result<String, String> {
    let trimmed = name.trim();
    if trimmed.is_empty() {
        return Err("プロファイル名を入力してください。".to_string());
    }
    if trimmed.len() > 64 {
        return Err("プロファイル名は64文字以内で入力してください。".to_string());
    }
    let invalid_chars = ['\\', '/', ':', '*', '?', '"', '<', '>', '|', '\n', '\r', '\t'];
    if trimmed.chars().any(|c| invalid_chars.contains(&c)) {
        return Err("プロファイル名に使用できない文字が含まれています (\\ / : * ? \" < > |)".to_string());
    }
    if trimmed == "." || trimmed == ".." {
        return Err("無効なプロファイル名です。".to_string());
    }
    Ok(trimmed.to_string())
}

pub fn get_profile_list_internal() -> Vec<String> {
    let profiles_dir = get_profiles_dir();
    let mut names = Vec::new();
    if let Ok(entries) = fs::read_dir(&profiles_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_file() && path.extension().and_then(|s| s.to_str()) == Some("json") {
                if let Some(stem) = path.file_stem().and_then(|s| s.to_str()) {
                    names.push(stem.to_string());
                }
            }
        }
    }
    names.sort_by(|a, b| a.to_lowercase().cmp(&b.to_lowercase()));
    names
}

pub fn read_active_profile_name() -> String {
    let meta_path = get_active_profile_meta_path();
    if let Ok(content) = fs::read_to_string(&meta_path) {
        if let Ok(meta) = serde_json::from_str::<ActiveProfileMeta>(&content) {
            if !meta.active_profile.trim().is_empty() {
                return meta.active_profile;
            }
        }
    }
    "default".to_string()
}

pub fn save_active_profile_meta(name: &str) {
    let meta_path = get_active_profile_meta_path();
    let meta = ActiveProfileMeta {
        active_profile: name.to_string(),
    };
    if let Ok(json) = serde_json::to_string_pretty(&meta) {
        let _ = fs::write(&meta_path, json);
    }
}

pub fn save_config_to_disk(config: &Config, profile_name: &str) {
    let profile_path = get_profile_path(profile_name);
    if let Some(parent) = profile_path.parent() {
        let _ = fs::create_dir_all(parent);
    }
    if let Ok(json) = serde_json::to_string_pretty(config) {
        match fs::write(&profile_path, &json) {
            Ok(_) => log::info!("Saved profile to {:?}", profile_path),
            Err(e) => log::error!("Failed to save profile to {:?}: {}", profile_path, e),
        }
    }
}

pub fn initialize_profiles() -> (Config, String) {
    let profiles_dir = get_profiles_dir();
    let _ = fs::create_dir_all(&profiles_dir);

    let mut list = get_profile_list_internal();

    if list.is_empty() {
        let default_config = crate::get_default_config();
        let default_profile_path = get_profile_path("default");
        if let Ok(pretty) = serde_json::to_string_pretty(&default_config) {
            let _ = fs::write(&default_profile_path, pretty);
        }
        save_active_profile_meta("default");
        list = get_profile_list_internal();
    }

    let mut active = read_active_profile_name();
    if !list.contains(&active) {
        active = list.first().cloned().unwrap_or_else(|| "default".to_string());
        save_active_profile_meta(&active);
    }

    let active_path = get_profile_path(&active);
    let mut loaded_config = if let Ok(json) = fs::read_to_string(&active_path) {
        match serde_json::from_str::<Config>(&json) {
            Ok(c) => c,
            Err(e) => {
                log::error!("Failed to parse profile {}: {}", active, e);
                crate::get_default_config()
            }
        }
    } else {
        crate::get_default_config()
    };

    if loaded_config.macros.is_empty() {
        ensure_macros_loaded(&mut loaded_config);
        if !loaded_config.macros.is_empty() {
            save_config_to_disk(&loaded_config, &active);
        }
    }

    (loaded_config, active)
}

#[tauri::command(rename = "list-profiles")]
pub fn list_profiles(state: State<'_, ConfigState>) -> Result<ProfileListResponse, String> {
    let profiles = get_profile_list_internal();
    let active_profile = state.active_profile.lock().unwrap().clone();
    Ok(ProfileListResponse {
        profiles,
        active_profile,
    })
}

#[tauri::command(rename = "load-profile")]
pub fn load_profile(profile_name: String, state: State<'_, ConfigState>) -> Result<Config, String> {
    let profile_path = get_profile_path(&profile_name);
    if !profile_path.exists() {
        return Err(format!("プロファイル '{}' が見つかりません。", profile_name));
    }
    let json = fs::read_to_string(&profile_path)
        .map_err(|e| format!("プロファイルの読み込みに失敗しました: {}", e))?;
    let mut config = serde_json::from_str::<Config>(&json)
        .map_err(|e| format!("プロファイルの解析に失敗しました: {}", e))?;

    if config.macros.is_empty() {
        ensure_macros_loaded(&mut config);
        if !config.macros.is_empty() {
            save_config_to_disk(&config, &profile_name);
        }
    }

    state.config.store(Arc::new(config.clone()));
    *state.active_profile.lock().unwrap() = profile_name.clone();
    save_active_profile_meta(&profile_name);

    log::info!("Loaded profile: {}", profile_name);
    Ok(config)
}

#[tauri::command(rename = "copy-profile")]
pub fn copy_profile(
    source_name: String,
    new_name: String,
    state: State<'_, ConfigState>,
) -> Result<Config, String> {
    let valid_new_name = validate_profile_name(&new_name)?;
    let target_path = get_profile_path(&valid_new_name);
    if target_path.exists() {
        return Err(format!("プロファイル '{}' は既に存在します。", valid_new_name));
    }

    let active_name = state.active_profile.lock().unwrap().clone();
    let config_to_copy = if source_name == active_name {
        (**state.config.load()).clone()
    } else {
        let source_path = get_profile_path(&source_name);
        if !source_path.exists() {
            return Err(format!("コピー元のプロファイル '{}' が見つかりません。", source_name));
        }
        let json = fs::read_to_string(&source_path)
            .map_err(|e| format!("元プロファイルの読み込みに失敗しました: {}", e))?;
        serde_json::from_str::<Config>(&json)
            .map_err(|e| format!("元プロファイルの解析に失敗しました: {}", e))?
    };

    save_config_to_disk(&config_to_copy, &valid_new_name);

    state.config.store(Arc::new(config_to_copy.clone()));
    *state.active_profile.lock().unwrap() = valid_new_name.clone();
    save_active_profile_meta(&valid_new_name);

    log::info!("Copied profile from {} to {}", source_name, valid_new_name);
    Ok(config_to_copy)
}

#[tauri::command(rename = "copy-profile-with-dialog")]
pub fn copy_profile_with_dialog(
    state: State<'_, ConfigState>,
) -> Result<Option<ProfileListResponse>, String> {
    let active_name = state.active_profile.lock().unwrap().clone();
    let default_file_name = format!("{}-copy.json", active_name);
    let profiles_dir = get_profiles_dir();

    let file_path = rfd::FileDialog::new()
        .set_title("プロファイルの保存場所とファイル名を選択")
        .add_filter("JSON 設定ファイル (*.json)", &["json"])
        .set_directory(&profiles_dir)
        .set_file_name(&default_file_name)
        .save_file();

    let target_path = match file_path {
        Some(p) => p,
        None => return Ok(None),
    };

    let config_to_copy = (**state.config.load()).clone();
    let json = serde_json::to_string_pretty(&config_to_copy)
        .map_err(|e| format!("JSONのシリアライズに失敗しました: {}", e))?;

    fs::write(&target_path, &json)
        .map_err(|e| format!("ファイルの保存に失敗しました: {}", e))?;

    let mut new_active_name = active_name;
    if let Some(stem) = target_path.file_stem().and_then(|s| s.to_str()) {
        if let Ok(name) = validate_profile_name(stem) {
            let internal_path = get_profile_path(&name);
            if internal_path != target_path {
                let _ = fs::write(&internal_path, &json);
            }
            new_active_name = name.clone();
            *state.active_profile.lock().unwrap() = name.clone();
            save_active_profile_meta(&name);
        }
    }

    let profiles = get_profile_list_internal();
    Ok(Some(ProfileListResponse {
        profiles,
        active_profile: new_active_name,
    }))
}

#[tauri::command(rename = "import-profile-with-dialog")]
pub fn import_profile_with_dialog(
    state: State<'_, ConfigState>,
) -> Result<Option<ProfileListResponse>, String> {
    let file_path = rfd::FileDialog::new()
        .set_title("読み込む設定ファイル (*.json) を選択")
        .add_filter("JSON 設定ファイル (*.json)", &["json"])
        .pick_file();

    let source_path = match file_path {
        Some(p) => p,
        None => return Ok(None),
    };

    let json = fs::read_to_string(&source_path)
        .map_err(|e| format!("ファイルの読み込みに失敗しました: {}", e))?;

    let parsed_config = serde_json::from_str::<Config>(&json)
        .map_err(|e| format!("有効なキー設定ファイルではありません: {}", e))?;

    let stem = source_path
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("imported");
    let base_name = validate_profile_name(stem).unwrap_or_else(|_| "imported".to_string());

    let existing_list = get_profile_list_internal();
    let mut unique_name = base_name.clone();
    let mut counter = 2;
    while existing_list.contains(&unique_name) {
        unique_name = format!("{}-{}", base_name, counter);
        counter += 1;
    }

    save_config_to_disk(&parsed_config, &unique_name);

    state.config.store(Arc::new(parsed_config));
    *state.active_profile.lock().unwrap() = unique_name.clone();
    save_active_profile_meta(&unique_name);

    let profiles = get_profile_list_internal();
    Ok(Some(ProfileListResponse {
        profiles,
        active_profile: unique_name,
    }))
}

#[tauri::command(rename = "export-profile-with-dialog")]
pub fn export_profile_with_dialog(
    profile_name: String,
    state: State<'_, ConfigState>,
) -> Result<Option<String>, String> {
    let profile_path = get_profile_path(&profile_name);
    let config_to_export = if profile_name == *state.active_profile.lock().unwrap() {
        (**state.config.load()).clone()
    } else if profile_path.exists() {
        let json = fs::read_to_string(&profile_path)
            .map_err(|e| format!("プロファイルの読み込みに失敗しました: {}", e))?;
        serde_json::from_str::<Config>(&json)
            .map_err(|e| format!("プロファイルの解析に失敗しました: {}", e))?
    } else {
        return Err(format!("プロファイル '{}' が見つかりません。", profile_name));
    };

    let default_file_name = format!("{}.json", profile_name);
    let file_path = rfd::FileDialog::new()
        .set_title("プロファイルのエクスポート先を選択")
        .add_filter("JSON 設定ファイル (*.json)", &["json"])
        .set_file_name(&default_file_name)
        .save_file();

    let target_path = match file_path {
        Some(p) => p,
        None => return Ok(None),
    };

    let json = serde_json::to_string_pretty(&config_to_export)
        .map_err(|e| format!("JSONのシリアライズに失敗しました: {}", e))?;

    fs::write(&target_path, &json)
        .map_err(|e| format!("ファイルの書き出しに失敗しました: {}", e))?;

    Ok(Some(target_path.to_string_lossy().to_string()))
}

#[tauri::command(rename = "create-profile")]
pub fn create_profile(profile_name: String, state: State<'_, ConfigState>) -> Result<Config, String> {
    let valid_name = validate_profile_name(&profile_name)?;
    let target_path = get_profile_path(&valid_name);
    if target_path.exists() {
        return Err(format!("プロファイル '{}' は既に存在します。", valid_name));
    }

    let mut new_config = crate::get_default_config();
    new_config.macros = state.config.load().macros.clone();

    save_config_to_disk(&new_config, &valid_name);

    state.config.store(Arc::new(new_config.clone()));
    *state.active_profile.lock().unwrap() = valid_name.clone();
    save_active_profile_meta(&valid_name);

    log::info!("Created new profile: {}", valid_name);
    Ok(new_config)
}

#[tauri::command(rename = "delete-profile")]
pub fn delete_profile(
    profile_name: String,
    state: State<'_, ConfigState>,
) -> Result<ProfileListResponse, String> {
    let list = get_profile_list_internal();
    if list.len() <= 1 {
        return Err("プロファイルが1つしかないため削除できません。".to_string());
    }

    let target_path = get_profile_path(&profile_name);
    if !target_path.exists() {
        return Err(format!("プロファイル '{}' が見つかりません。", profile_name));
    }

    fs::remove_file(&target_path)
        .map_err(|e| format!("プロファイルの削除に失敗しました: {}", e))?;

    let remaining_list = get_profile_list_internal();
    let current_active = state.active_profile.lock().unwrap().clone();

    let new_active = if current_active == profile_name {
        let fallback = remaining_list.first().cloned().unwrap_or_else(|| "default".to_string());
        let _ = load_profile(fallback.clone(), state);
        fallback
    } else {
        current_active
    };

    Ok(ProfileListResponse {
        profiles: remaining_list,
        active_profile: new_active,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_validate_profile_name_valid() {
        assert_eq!(validate_profile_name("default").unwrap(), "default");
        assert_eq!(validate_profile_name("game-1").unwrap(), "game-1");
        assert_eq!(validate_profile_name("my profile").unwrap(), "my profile");
        assert_eq!(validate_profile_name("  trimmed  ").unwrap(), "trimmed");
    }

    #[test]
    fn test_validate_profile_name_invalid() {
        assert!(validate_profile_name("").is_err());
        assert!(validate_profile_name("   ").is_err());
        assert!(validate_profile_name("profile/test").is_err());
        assert!(validate_profile_name("profile\\test").is_err());
        assert!(validate_profile_name("test:1").is_err());
        assert!(validate_profile_name("test*").is_err());
        assert!(validate_profile_name("test?").is_err());
        assert!(validate_profile_name("test\"").is_err());
        assert!(validate_profile_name("test<").is_err());
        assert!(validate_profile_name("test>").is_err());
        assert!(validate_profile_name("test|").is_err());
        assert!(validate_profile_name(".").is_err());
        assert!(validate_profile_name("..").is_err());
        let too_long = "a".repeat(65);
        assert!(validate_profile_name(&too_long).is_err());
    }
}
