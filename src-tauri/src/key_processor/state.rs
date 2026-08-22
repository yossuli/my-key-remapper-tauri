use crate::state_machine::KeyState;
use std::collections::HashMap;
use std::sync::{Mutex, OnceLock};

pub struct ProcessorState {
    pub key_states: HashMap<u16, KeyState>,
    pub active_layers: Vec<String>,
    pub pressed_vks: HashMap<u16, Vec<u16>>,
    pub momentary_layers: HashMap<u16, String>,
    pub saved_mouse_pos: Option<(i32, i32)>,
}

static STATE: OnceLock<Mutex<ProcessorState>> = OnceLock::new();

pub fn get_state() -> &'static Mutex<ProcessorState> {
    STATE.get_or_init(|| {
        Mutex::new(ProcessorState {
            key_states: HashMap::new(),
            active_layers: vec!["base".to_string()],
            pressed_vks: HashMap::new(),
            momentary_layers: HashMap::new(),
            saved_mouse_pos: None,
        })
    })
}
