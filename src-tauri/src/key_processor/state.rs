use crate::state_machine::KeyState;
use std::collections::{HashMap, HashSet};
use std::sync::{Mutex, Condvar, OnceLock};

pub struct ProcessorState {
    pub key_states: HashMap<u16, KeyState>,
    pub active_layers: Vec<String>,
    pub pressed_vks: HashMap<u16, Vec<u16>>,
    pub momentary_layers: HashMap<u16, Vec<String>>,
    pub momentary_keys: Vec<(u16, std::time::Instant)>,
    pub ghost_keys: HashSet<u16>,
    pub saved_mouse_pos: Option<(i32, i32)>,
    pub suppressed_modifiers_for_key: HashMap<u16, Vec<u16>>,
    pub physically_pressed_modifiers: HashSet<u16>,
    pub active_layer_modifiers: HashSet<u16>,
}

impl ProcessorState {
    pub fn get_passthrough_trigger_keys(&self) -> HashSet<u16> {
        self.key_states
            .iter()
            .filter_map(|(&vk, s)| {
                if matches!(s, KeyState::PassthroughHoldActive { .. }) {
                    Some(vk)
                } else {
                    None
                }
            })
            .collect()
    }
}

pub struct StateWrapper {
    pub mutex: Mutex<ProcessorState>,
    pub cvar: Condvar,
}

static STATE: OnceLock<StateWrapper> = OnceLock::new();

pub fn get_state_wrapper() -> &'static StateWrapper {
    STATE.get_or_init(|| StateWrapper {
        mutex: Mutex::new(ProcessorState {
            key_states: HashMap::new(),
            active_layers: vec!["base".to_string()],
            pressed_vks: HashMap::new(),
            momentary_layers: HashMap::new(),
            momentary_keys: Vec::new(),
            ghost_keys: HashSet::new(),
            saved_mouse_pos: None,
            suppressed_modifiers_for_key: HashMap::new(),
            physically_pressed_modifiers: HashSet::new(),
            active_layer_modifiers: HashSet::new(),
        }),
        cvar: Condvar::new(),
    })
}

pub fn get_state() -> &'static Mutex<ProcessorState> {
    &get_state_wrapper().mutex
}

static LAST_KEY_ACTIVITY: Mutex<Option<std::time::Instant>> = Mutex::new(None);

pub fn touch_key_activity() {
    if let Ok(mut lock) = LAST_KEY_ACTIVITY.lock() {
        *lock = Some(std::time::Instant::now());
    }
}

pub fn get_last_key_activity() -> Option<std::time::Instant> {
    LAST_KEY_ACTIVITY.lock().ok().and_then(|g| *g)
}

#[cfg(test)]
pub static TEST_LOCK: Mutex<()> = Mutex::new(());

