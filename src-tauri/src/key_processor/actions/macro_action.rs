use crate::{Action, Config};
use super::{execute_action, ActionContext};
use std::thread;

fn execute_macro_sync(macro_id: &str, config: &Config, depth: u32) {
    if depth > 10 {
        log::warn!("Macro execution depth exceeded limit (10). Aborting nested macro: {}", macro_id);
        return;
    }

    log::info!("Executing macro: {} (depth: {})", macro_id, depth);

    if let Some(macro_def) = config.macros.iter().find(|m| m.id == macro_id) {
        let ctx = ActionContext::atomic(config);
        for (i, step) in macro_def.actions.iter().enumerate() {
            log::info!("  Step {}: {:?}", i, step);
            match step {
                Action::Macro { macro_id: nested_macro_id } => {
                    log::info!("    nested macro: {}", nested_macro_id);
                    execute_macro_sync(nested_macro_id, config, depth + 1);
                }
                Action::LayerMomentary { .. } => {
                    log::warn!("    unsupported macro step action (LayerMomentary requires physical key release): {:?}", step);
                }
                _ => {
                    execute_action(step, &ctx);
                }
            }
        }
    }
}

pub fn apply(macro_id: &str, config: &Config) {
    log::info!("macro_action::apply called with macro_id: {}", macro_id);
    let macro_id = macro_id.to_string();
    let config_clone = config.clone();

    thread::spawn(move || {
        execute_macro_sync(&macro_id, &config_clone, 1);
    });
}
