//! Characterization of the 2026-09-20 profile, not desired IME behavior.
//! SendInput is mocked under cfg(test); these tests cannot verify IME text/mode.
use super::*;
use state::{ProcessorState, TEST_LOCK};
use utils::TEST_SENT_KEYS;

fn setup() -> Config {
    *get_state().lock().unwrap() = ProcessorState::default();
    TEST_SENT_KEYS.lock().unwrap().clear();
    serde_json::from_str(include_str!("../../tests/fixtures/ime-profile-excerpt.json")).unwrap()
}

// Include physical events that the hook passes through in the observed output.
fn event(config: &Config, vk: u16, down: bool) -> Vec<(u16, bool)> {
    TEST_SENT_KEYS.lock().unwrap().clear();
    let result = KeyProcessor::process_key(vk, down, config);
    let mut output = TEST_SENT_KEYS.lock().unwrap().clone();
    if result == HookAction::PassThrough {
        output.push((vk, !down));
    }
    println!("{vk} {} => {output:?}", if down { "down" } else { "up" });
    output
}

#[test]
fn ime_diagnostic_shift_released_then_convert_tap() {
    let _guard = TEST_LOCK.lock().unwrap();
    let config = setup();
    for shift in [160, 161] {
        event(&config, shift, true);
        assert_eq!(event(&config, 65, true), vec![(65, false)]);
        event(&config, 65, false);
        event(&config, shift, false);
        assert!(event(&config, 28, true).is_empty());
        assert_eq!(event(&config, 28, false), vec![(28, false), (28, true)]);
        assert_eq!(event(&config, 75, true), vec![(75, false)]);
        event(&config, 75, false);
        let state = get_state().lock().unwrap();
        assert!(state.physically_pressed_modifiers.is_empty());
        assert!(state.pressed_vks.is_empty());
        assert_eq!(state.active_layers, vec!["base"]);
    }
}

#[test]
fn ime_diagnostic_shift_convert_suppresses_shift_but_holds_four_keys() {
    let _guard = TEST_LOCK.lock().unwrap();
    let config = setup();
    for shift in [160, 161] {
        event(&config, shift, true);
        assert_eq!(event(&config, 28, true), vec![
            (shift, true), (29, false), (189, false), (32, false), (28, false),
        ]);
        assert_eq!(get_state().lock().unwrap().pressed_vks.get(&28), Some(&vec![29,189,32,28]));
        // Next character passes while all four outputs and Shift suppression persist.
        assert_eq!(event(&config, 65, true), vec![(65, false)]);
        event(&config, 65, false);
        assert_eq!(event(&config, 28, false), vec![
            (29, true), (189, true), (32, true), (28, true), (shift, false),
        ]);
        event(&config, shift, false);
    }
}

#[test]
fn ime_diagnostic_convert_rollover_eats_conversion_and_letter() {
    let _guard = TEST_LOCK.lock().unwrap();
    let config = setup();
    assert!(event(&config, 28, true).is_empty());
    assert_eq!(event(&config, 76, true), vec![(37, false)]);
    assert!(get_state().lock().unwrap().active_layers.contains(&"arrow".to_string()));
    event(&config, 76, false);
    assert!(event(&config, 28, false).is_empty());
}

#[test]
fn ime_diagnostic_convert_then_shift_changes_pending_action() {
    let _guard = TEST_LOCK.lock().unwrap();
    let config = setup();
    event(&config, 28, true);
    event(&config, 160, true);
    // Shift interrupted Convert into arrow before Shift's own layer activated.
    assert!(get_state().lock().unwrap().active_layers.contains(&"arrow".to_string()));
    assert!(event(&config, 28, false).iter().all(|(vk, _)| *vk != 28));
    event(&config, 160, false);
}

#[test]
fn ime_diagnostic_nonconvert_number_has_no_commit_prefix() {
    let _guard = TEST_LOCK.lock().unwrap();
    let config = setup();
    event(&config, 29, true);
    assert_eq!(event(&config, 81, true), vec![(97, false)]);
    event(&config, 81, false);
    event(&config, 29, false);
}

#[test]
fn ime_diagnostic_space_double_tap_and_enter_are_unconditional() {
    let _guard = TEST_LOCK.lock().unwrap();
    let config = setup();
    assert!(event(&config, 32, true).is_empty());
    assert!(event(&config, 32, false).is_empty());
    assert_eq!(event(&config, 32, true), vec![(13, false)]);
    event(&config, 32, false);
    assert_eq!(event(&config, 13, true), vec![(162, false), (13, false)]);
    event(&config, 13, false);
}

#[test]
fn ime_diagnostic_shift_space_release_re_resolves_binding() {
    let _guard = TEST_LOCK.lock().unwrap();
    let config = setup();
    event(&config, 160, true);
    event(&config, 32, true);
    event(&config, 32, false);
    event(&config, 160, false);
    // The second tap now resolves base's Enter instead of shift's Space.
    assert_eq!(event(&config, 32, true), vec![(13, false)]);
    event(&config, 32, false);
}
