use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashMap;
use ts_rs::TS;

/// マウスクリックボタン種別
#[derive(TS, Debug, Serialize, Deserialize, Clone, Copy, PartialEq, Eq, Default)]
#[ts(export)]
#[serde(rename_all = "camelCase")]
pub enum MouseButton {
    #[default]
    Left,
    Right,
    Middle,
}

impl MouseButton {
    pub fn as_str(&self) -> &'static str {
        match self {
            MouseButton::Left => "left",
            MouseButton::Right => "right",
            MouseButton::Middle => "middle",
        }
    }
}

/// スクロール軸種別
#[derive(TS, Debug, Serialize, Deserialize, Clone, Copy, PartialEq, Eq, Default)]
#[ts(export)]
#[serde(rename_all = "camelCase")]
pub enum ScrollAxis {
    #[default]
    Both,
    Vertical,
    Horizontal,
}

impl ScrollAxis {
    pub fn as_str(&self) -> &'static str {
        match self {
            ScrollAxis::Both => "both",
            ScrollAxis::Vertical => "vertical",
            ScrollAxis::Horizontal => "horizontal",
        }
    }
}

/// 割り込み時の挙動
#[derive(TS, Debug, Serialize, Deserialize, Clone, Copy, PartialEq, Eq)]
#[ts(export)]
#[serde(rename_all = "camelCase")]
pub enum InterruptBehavior {
    ForceTap,
    ForceHold,
    Ignore,
}

/// キーバインディングのトリガー種別
#[derive(TS, Debug, Serialize, Deserialize, Clone, Copy, PartialEq, Eq, Hash)]
#[ts(export)]
#[serde(rename_all = "camelCase")]
pub enum Trigger {
    Tap,
    Hold,
    DoubleTap,
}

impl Trigger {
    pub fn as_str(&self) -> &'static str {
        match self {
            Trigger::Tap => "tap",
            Trigger::Hold => "hold",
            Trigger::DoubleTap => "doubleTap",
        }
    }
}

/// 実行するアクションの列挙型 (Tagged Union)
#[derive(TS, Debug, Serialize, Deserialize, Clone, PartialEq)]
#[ts(export)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum Action {
    #[serde(rename_all = "camelCase")]
    Remap {
        keys: Vec<u16>,
        #[ts(optional)]
        #[serde(default, skip_serializing_if = "Option::is_none")]
        repeat: Option<bool>,
        #[ts(optional)]
        #[serde(default, skip_serializing_if = "Option::is_none")]
        repeat_delay_ms: Option<u32>,
        #[ts(optional)]
        #[serde(default, skip_serializing_if = "Option::is_none")]
        repeat_interval_ms: Option<u32>,
    },
    #[serde(rename_all = "camelCase")]
    LayerToggle { layer_id: String },
    #[serde(rename_all = "camelCase")]
    LayerMomentary { layer_id: String },
    #[serde(rename_all = "camelCase")]
    Macro { macro_id: String },
    #[serde(rename_all = "camelCase")]
    MouseMove {
        #[ts(optional)]
        #[serde(default, skip_serializing_if = "Option::is_none")]
        x: Option<i32>,
        #[ts(optional)]
        #[serde(default, skip_serializing_if = "Option::is_none")]
        y: Option<i32>,
    },
    #[serde(rename_all = "camelCase")]
    MouseClick {
        #[ts(optional)]
        #[serde(default, skip_serializing_if = "Option::is_none")]
        x: Option<i32>,
        #[ts(optional)]
        #[serde(default, skip_serializing_if = "Option::is_none")]
        y: Option<i32>,
        #[serde(default)]
        button: MouseButton,
        #[ts(optional)]
        #[serde(default, skip_serializing_if = "Option::is_none")]
        click_count: Option<u32>,
    },
    CursorSave,
    CursorRestore,
    #[serde(alias = "trackpadScroll", rename_all = "camelCase")]
    ScrollMode {
        #[ts(optional)]
        #[serde(default, skip_serializing_if = "Option::is_none")]
        sensitivity: Option<f64>,
        #[ts(optional)]
        #[serde(default, skip_serializing_if = "Option::is_none")]
        invert: Option<bool>,
        #[ts(optional)]
        #[serde(default, skip_serializing_if = "Option::is_none")]
        axis: Option<ScrollAxis>,
    },
    #[serde(rename_all = "camelCase")]
    Delay { delay_ms: u32 },
    None,
}

/// 単一のキーバインディング定義
#[derive(TS, Debug, Serialize, Deserialize, Clone, PartialEq)]
#[ts(export)]
#[serde(rename_all = "camelCase")]
pub struct Binding {
    pub trigger: Trigger,
    pub action: Action,
    #[ts(optional)]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub timing_ms: Option<u32>,
    #[ts(optional)]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub interrupt_behavior: Option<InterruptBehavior>,
}

/// レイヤー定義
#[derive(TS, Debug, Serialize, Deserialize, Clone, PartialEq)]
#[ts(export)]
#[serde(rename_all = "camelCase")]
pub struct Layer {
    pub id: String,
    #[serde(default)]
    pub bindings: HashMap<u16, Vec<Binding>>,
    #[ts(optional)]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub default_modifiers: Option<Value>,
    #[ts(optional)]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub passthrough_trigger_key: Option<bool>,
}

/// マクロ定義
#[derive(TS, Debug, Serialize, Deserialize, Clone, PartialEq)]
#[ts(export)]
#[serde(rename_all = "camelCase")]
pub struct MacroDef {
    pub id: String,
    pub name: String,
    #[serde(default)]
    pub actions: Vec<Action>,
}

/// アプリケーション全体の設定モデル
#[derive(TS, Debug, Serialize, Deserialize, Clone, PartialEq, Default)]
#[ts(export)]
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
    pub macros: Vec<MacroDef>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_trigger_serialization_roundtrip() {
        assert_eq!(serde_json::to_string(&Trigger::Tap).unwrap(), "\"tap\"");
        assert_eq!(serde_json::to_string(&Trigger::Hold).unwrap(), "\"hold\"");
        assert_eq!(serde_json::to_string(&Trigger::DoubleTap).unwrap(), "\"doubleTap\"");

        assert_eq!(serde_json::from_str::<Trigger>("\"tap\"").unwrap(), Trigger::Tap);
        assert_eq!(serde_json::from_str::<Trigger>("\"hold\"").unwrap(), Trigger::Hold);
        assert_eq!(serde_json::from_str::<Trigger>("\"doubleTap\"").unwrap(), Trigger::DoubleTap);
    }

    #[test]
    fn test_action_remap_serialization() {
        let action = Action::Remap {
            keys: vec![29, 56],
            repeat: Some(true),
            repeat_delay_ms: Some(200),
            repeat_interval_ms: Some(50),
        };
        let json = serde_json::to_string(&action).unwrap();
        assert!(json.contains("\"type\":\"remap\""));
        assert!(json.contains("\"keys\":[29,56]"));
        assert!(json.contains("\"repeat\":true"));
        assert!(json.contains("\"repeatDelayMs\":200"));
        assert!(json.contains("\"repeatIntervalMs\":50"));

        let deserialized: Action = serde_json::from_str(&json).unwrap();
        assert_eq!(action, deserialized);
    }

    #[test]
    fn test_action_layer_variants() {
        let toggle = Action::LayerToggle { layer_id: "num".to_string() };
        let json = serde_json::to_string(&toggle).unwrap();
        assert_eq!(json, "{\"type\":\"layerToggle\",\"layerId\":\"num\"}");
        assert_eq!(serde_json::from_str::<Action>(&json).unwrap(), toggle);

        let momentary = Action::LayerMomentary { layer_id: "fn".to_string() };
        let json = serde_json::to_string(&momentary).unwrap();
        assert_eq!(json, "{\"type\":\"layerMomentary\",\"layerId\":\"fn\"}");
        assert_eq!(serde_json::from_str::<Action>(&json).unwrap(), momentary);
    }

    #[test]
    fn test_action_mouse_and_scroll() {
        let mouse_move = Action::MouseMove { x: Some(100), y: Some(200) };
        let json = serde_json::to_string(&mouse_move).unwrap();
        assert_eq!(serde_json::from_str::<Action>(&json).unwrap(), mouse_move);

        let mouse_click = Action::MouseClick {
            x: None,
            y: None,
            button: MouseButton::Right,
            click_count: Some(2),
        };
        let json = serde_json::to_string(&mouse_click).unwrap();
        assert_eq!(serde_json::from_str::<Action>(&json).unwrap(), mouse_click);

        // ScrollMode (with alias trackpadScroll)
        let scroll = Action::ScrollMode {
            sensitivity: Some(1.5),
            invert: Some(true),
            axis: Some(ScrollAxis::Vertical),
        };
        let json = serde_json::to_string(&scroll).unwrap();
        assert_eq!(serde_json::from_str::<Action>(&json).unwrap(), scroll);

        let trackpad_json = r#"{"type":"trackpadScroll","sensitivity":2.0,"invert":false}"#;
        let from_trackpad: Action = serde_json::from_str(trackpad_json).unwrap();
        assert_eq!(
            from_trackpad,
            Action::ScrollMode {
                sensitivity: Some(2.0),
                invert: Some(false),
                axis: None,
            }
        );
    }

    #[test]
    fn test_action_cursor_and_delay_none() {
        let save = Action::CursorSave;
        assert_eq!(serde_json::to_string(&save).unwrap(), "{\"type\":\"cursorSave\"}");
        assert_eq!(serde_json::from_str::<Action>("{\"type\":\"cursorSave\"}").unwrap(), save);

        let restore = Action::CursorRestore;
        assert_eq!(serde_json::to_string(&restore).unwrap(), "{\"type\":\"cursorRestore\"}");
        assert_eq!(serde_json::from_str::<Action>("{\"type\":\"cursorRestore\"}").unwrap(), restore);

        let delay = Action::Delay { delay_ms: 100 };
        assert_eq!(serde_json::to_string(&delay).unwrap(), "{\"type\":\"delay\",\"delayMs\":100}");
        assert_eq!(serde_json::from_str::<Action>("{\"type\":\"delay\",\"delayMs\":100}").unwrap(), delay);

        let none_action = Action::None;
        assert_eq!(serde_json::to_string(&none_action).unwrap(), "{\"type\":\"none\"}");
        assert_eq!(serde_json::from_str::<Action>("{\"type\":\"none\"}").unwrap(), none_action);
    }

    #[test]
    fn test_binding_deserialization() {
        let json = r#"{
            "trigger": "hold",
            "action": { "type": "layerMomentary", "layerId": "shift" },
            "timingMs": 250,
            "interruptBehavior": "forceHold"
        }"#;
        let binding: Binding = serde_json::from_str(json).unwrap();
        assert_eq!(binding.trigger, Trigger::Hold);
        assert_eq!(binding.action, Action::LayerMomentary { layer_id: "shift".to_string() });
        assert_eq!(binding.timing_ms, Some(250));
        assert_eq!(binding.interrupt_behavior, Some(InterruptBehavior::ForceHold));
    }

    #[test]
    fn test_config_roundtrip() {
        let json = r#"{
            "version": 1,
            "layers": [
                {
                    "id": "base",
                    "bindings": {
                        "160": [{"trigger": "hold", "action": {"type": "layerMomentary", "layerId": "shift"}}]
                    }
                }
            ],
            "layerOrder": ["base"],
            "globalSettings": { "defaultHoldThresholdMs": 200 },
            "macros": [
                {
                    "id": "m1",
                    "name": "Test Macro",
                    "actions": [
                        { "type": "cursorSave" },
                        { "type": "delay", "delayMs": 50 }
                    ]
                }
            ]
        }"#;

        let config: Config = serde_json::from_str(json).unwrap();
        assert_eq!(config.version, 1);
        assert_eq!(config.layers.len(), 1);
        assert_eq!(config.macros.len(), 1);
        assert_eq!(config.macros[0].actions.len(), 2);
    }
}
