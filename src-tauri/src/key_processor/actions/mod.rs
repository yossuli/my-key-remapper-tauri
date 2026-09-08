pub mod remap;
pub mod layer_toggle;
pub mod layer_momentary;
pub mod macro_action;
pub mod mouse;

use crate::{Action, Config};

/// アクション実行時の実行コンテキスト
#[derive(Debug, Clone)]
pub struct ActionContext<'a> {
    pub physical_vk: u16,
    pub is_atomic: bool,
    pub config: &'a Config,
    pub source_layer: Option<&'a str>,
}

impl<'a> ActionContext<'a> {
    pub fn new(
        physical_vk: u16,
        is_atomic: bool,
        config: &'a Config,
        source_layer: Option<&'a str>,
    ) -> Self {
        Self {
            physical_vk,
            is_atomic,
            config,
            source_layer,
        }
    }

    /// マクロステップなど物理キーを伴わない単発実行用のコンテキストを生成
    pub fn atomic(config: &'a Config) -> Self {
        Self {
            physical_vk: 0,
            is_atomic: true,
            config,
            source_layer: None,
        }
    }
}

/// 任意のアクションを指定されたコンテキストに基づいて実行する共通エントリポイント
pub fn execute_action(action: &Action, ctx: &ActionContext) {
    log::info!("execute_action: vk={}, action={:?}", ctx.physical_vk, action);
    match action {
        Action::Remap { keys, repeat, .. } => {
            remap::apply(
                ctx.physical_vk,
                keys,
                repeat.unwrap_or(false),
                ctx.is_atomic,
                ctx.config,
                ctx.source_layer,
            );
        }
        Action::LayerToggle { layer_id } => {
            layer_toggle::apply(layer_id, ctx.config);
        }
        Action::LayerMomentary { layer_id } => {
            layer_momentary::apply(ctx.physical_vk, layer_id, ctx.config);
        }
        Action::Macro { macro_id } => {
            macro_action::apply(macro_id, ctx.config);
        }
        Action::MouseMove { x, y } => {
            mouse::send_move(*x, *y);
        }
        Action::MouseClick { x, y, button, click_count } => {
            mouse::send_click(*x, *y, *button, *click_count);
        }
        Action::CursorSave => {
            mouse::cursor_save();
        }
        Action::CursorRestore => {
            mouse::cursor_restore();
        }
        Action::ScrollMode { sensitivity, invert, axis } => {
            mouse::set_scroll_mode(*sensitivity, *invert, *axis);
        }
        Action::Delay { delay_ms } => {
            std::thread::sleep(std::time::Duration::from_millis(*delay_ms as u64));
        }
        Action::None => {}
    }
}

pub fn apply_action(
    physical_vk: u16,
    action: &Action,
    is_atomic: bool,
    config: &Config,
    source_layer: Option<&str>,
) {
    let ctx = ActionContext::new(physical_vk, is_atomic, config, source_layer);
    execute_action(action, &ctx);
}

pub fn apply_repeat(physical_vk: u16, action: &Action) {
    if let Action::Remap { keys, repeat: Some(true), .. } = action {
        remap::repeat(physical_vk, keys);
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::key_processor::state::TEST_LOCK;

    #[test]
    fn test_action_context_constructors() {
        let config = crate::get_default_config();
        let ctx = ActionContext::new(65, false, &config, Some("base"));
        assert_eq!(ctx.physical_vk, 65);
        assert!(!ctx.is_atomic);
        assert_eq!(ctx.source_layer, Some("base"));

        let atomic_ctx = ActionContext::atomic(&config);
        assert_eq!(atomic_ctx.physical_vk, 0);
        assert!(atomic_ctx.is_atomic);
        assert_eq!(atomic_ctx.source_layer, None);
    }

    #[test]
    fn test_execute_action_cursor_save_and_restore() {
        let _lock = TEST_LOCK.lock().unwrap();
        let config = crate::get_default_config();
        let ctx = ActionContext::atomic(&config);

        // 1. CursorSave
        execute_action(&Action::CursorSave, &ctx);
        let saved_pos = crate::key_processor::state::get_state()
            .lock()
            .unwrap()
            .saved_mouse_pos;
        assert!(saved_pos.is_some());

        // 2. CursorRestore
        execute_action(&Action::CursorRestore, &ctx);

        // 3. None / Delay (パニックしないことを検証)
        execute_action(&Action::None, &ctx);
        execute_action(&Action::Delay { delay_ms: 1 }, &ctx);
    }

    #[test]
    fn test_execute_action_atomic_remap() {
        let _lock = TEST_LOCK.lock().unwrap();
        let config = crate::get_default_config();
        let ctx = ActionContext::atomic(&config);

        // physical_vk == 0 の場合、send_key_sequence_atomic が安全に実行される
        execute_action(
            &Action::Remap {
                keys: vec![65, 66],
                repeat: None,
                repeat_delay_ms: None,
                repeat_interval_ms: None,
            },
            &ctx,
        );
    }
}

