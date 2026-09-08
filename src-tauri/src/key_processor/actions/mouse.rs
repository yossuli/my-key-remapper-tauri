use crate::model::{MouseButton, ScrollAxis};

/// マウスカーソルを移動
pub fn send_move(x: Option<i32>, y: Option<i32>) {
    let x_val = x.unwrap_or(0);
    let y_val = y.unwrap_or(0);
    log::info!("mouse::send_move: ({}, {})", x_val, y_val);
    crate::key_processor::utils::send_mouse_move(x_val, y_val);
}

/// マウスクリックを実行（座標指定がある場合は移動後にクリック）
pub fn send_click(
    x: Option<i32>,
    y: Option<i32>,
    button: MouseButton,
    click_count: Option<u32>,
) {
    if let (Some(x_val), Some(y_val)) = (x, y) {
        log::info!("mouse::send_click move to: ({}, {})", x_val, y_val);
        crate::key_processor::utils::send_mouse_move(x_val, y_val);
    }
    let count = click_count.unwrap_or(1);
    log::info!("mouse::send_click: button={}, count={}", button.as_str(), count);
    crate::key_processor::utils::send_mouse_click(button.as_str(), count);
}

/// 現在のマウス座標を保存
pub fn cursor_save() {
    let pos = crate::key_processor::utils::get_mouse_pos();
    crate::key_processor::state::get_state().lock().unwrap().saved_mouse_pos = Some(pos);
    log::info!("mouse::cursor_save: saved pos ({}, {})", pos.0, pos.1);
}

/// 保存されたマウス座標へ復元
pub fn cursor_restore() {
    if let Some(pos) = crate::key_processor::state::get_state().lock().unwrap().saved_mouse_pos {
        crate::key_processor::utils::send_mouse_move(pos.0, pos.1);
        log::info!("mouse::cursor_restore: restored to ({}, {})", pos.0, pos.1);
    } else {
        log::warn!("mouse::cursor_restore called but no position was saved");
    }
}

/// スクロールモードの状態を設定
pub fn set_scroll_mode(
    sensitivity: Option<f64>,
    invert: Option<bool>,
    axis: Option<ScrollAxis>,
) {
    let sens = sensitivity.unwrap_or(1.0);
    let inv = invert.unwrap_or(false);
    let ax = axis.map_or("both", |a| a.as_str());

    #[cfg(windows)]
    crate::hook::set_scroll_mode_state(true, sens, inv, ax);

    log::info!("mouse::set_scroll_mode: sens={}, invert={}, axis={}", sens, inv, ax);
}
