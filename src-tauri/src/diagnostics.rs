use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::{
    fs::{self, File, OpenOptions},
    io::{BufWriter, Seek, SeekFrom, Write},
    path::PathBuf,
    sync::{
        atomic::{AtomicU64, Ordering},
        mpsc::{self, Receiver, SyncSender},
        Arc, Mutex, OnceLock,
    },
    time::{Duration, Instant, SystemTime, UNIX_EPOCH},
};
use tauri::{Emitter, Manager};
use ts_rs::TS;
static LOGGER: OnceLock<Recorder> = OnceLock::new();
static SESSION: OnceLock<String> = OnceLock::new();
static NEXT_ID: AtomicU64 = AtomicU64::new(1);
const ROTATE_BYTES: u64 = 16 * 1024 * 1024;

#[derive(Clone, Serialize, Deserialize, TS)]
#[ts(export)]
#[serde(rename_all = "camelCase")]
pub struct Incident {
    pub id: String,
    pub unix_ms: f64,
}
#[derive(Clone, Serialize, TS)]
#[ts(export)]
#[serde(rename_all = "camelCase")]
pub struct DiagnosticStatus {
    pub path: String,
    pub dropped_events: f64,
    pub error: Option<String>,
    pub pending: Option<Incident>,
}
enum Message {
    Event(Value),
    Flush(mpsc::Sender<Result<(), String>>),
    Stop(mpsc::Sender<Result<(), String>>),
}
struct Recorder {
    sender: SyncSender<Message>,
    dropped: Arc<AtomicU64>,
    error: Arc<Mutex<Option<String>>>,
    pending: Mutex<Option<Incident>>,
    path: PathBuf,
    start: Instant,
}
fn unix_ms() -> f64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as f64
}
fn envelope(kind: &str, data: Value, start: Instant) -> Value {
    json!({"schema":1,"session":SESSION.get_or_init(|| format!("{}-{}", std::process::id(), unix_ms())),"id":NEXT_ID.fetch_add(1, Ordering::Relaxed).to_string(),
        "unixMs":unix_ms(),"elapsedUs":start.elapsed().as_micros().to_string(),"kind":kind,"data":data})
}
pub fn record(kind: &str, data: Value) {
    if let Some(logger) = LOGGER.get() {
        if logger
            .sender
            .try_send(Message::Event(envelope(kind, data, logger.start)))
            .is_err()
        {
            logger.dropped.fetch_add(1, Ordering::Relaxed);
        }
    }
}
struct LogFile {
    path: PathBuf,
    writer: BufWriter<File>,
    bytes: u64,
    limit: u64,
}
impl LogFile {
    fn open(path: PathBuf, limit: u64) -> std::io::Result<Self> {
        let mut file = OpenOptions::new()
            .create(true)
            .truncate(false)
            .write(true)
            .open(&path)?;
        file.seek(SeekFrom::End(0))?;
        let bytes = file.metadata()?.len();
        Ok(Self {
            path,
            writer: BufWriter::new(file),
            bytes,
            limit,
        })
    }
    fn write(&mut self, event: &Value) -> std::io::Result<()> {
        let mut line = serde_json::to_vec(event)?;
        line.push(b'\n');
        if self.bytes > 0 && self.bytes + line.len() as u64 > self.limit {
            self.writer.flush()?;
            // Keep the active handle; explicit write access permits SetEndOfFile on Windows.
            for index in (1..=7).rev() {
                let from = if index == 1 {
                    self.path.clone()
                } else {
                    self.path.with_extension(format!("jsonl.{}", index - 1))
                };
                let to = self.path.with_extension(format!("jsonl.{index}"));
                if from.exists() {
                    fs::copy(from, to)?;
                }
            }
            self.writer.get_ref().set_len(0)?;
            self.writer.seek(SeekFrom::Start(0))?;
            self.bytes = 0;
        }
        self.writer.write_all(&line)?;
        self.bytes += line.len() as u64;
        Ok(())
    }
    fn flush(&mut self) -> std::io::Result<()> {
        self.writer.flush()
    }
}
fn writer_loop(
    mut file: LogFile,
    receiver: Receiver<Message>,
    dropped: Arc<AtomicU64>,
    error: Arc<Mutex<Option<String>>>,
) {
    let mut last_flush = Instant::now();
    let mut batch = 0;
    let mut reported_drops = 0;
    loop {
        let message = receiver.recv_timeout(Duration::from_millis(250));
        let mut reply = None;
        let mut stop = false;
        let idle = matches!(message, Err(mpsc::RecvTimeoutError::Timeout));
        // Extract control messages before I/O so failures still acknowledge and stop.
        let event = match message {
            Ok(Message::Event(event)) => Some(event),
            Ok(Message::Flush(tx)) => {
                reply = Some(tx);
                None
            }
            Ok(Message::Stop(tx)) => {
                reply = Some(tx);
                stop = true;
                None
            }
            Err(mpsc::RecvTimeoutError::Disconnected) => {
                stop = true;
                None
            }
            Err(mpsc::RecvTimeoutError::Timeout) => None,
        };
        let result = (|| -> std::io::Result<()> {
            let drops = dropped.load(Ordering::Relaxed);
            if drops != reported_drops {
                file.write(&json!({"kind":"dropped_events","unixMs":unix_ms(),"total":drops}))?;
                reported_drops = drops;
            }
            if let Some(event) = event {
                file.write(&event)?;
                batch += 1;
            }
            if batch >= 128
                || last_flush.elapsed() >= Duration::from_secs(1)
                || reply.is_some()
                || stop
                || idle
            {
                file.flush()?;
                batch = 0;
                last_flush = Instant::now();
            }
            Ok(())
        })()
        .map_err(|e| e.to_string());
        if let Err(ref message) = result {
            if let Ok(mut status) = error.lock() {
                *status = Some(message.clone());
            }
        }
        if let Some(reply) = reply {
            let sticky = error.lock().ok().and_then(|e| e.clone());
            let _ = reply.send(sticky.map_or(result, Err));
        }
        if stop {
            break;
        }
    }
}
pub fn initialize(app: &tauri::AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    let dir = app.path().app_log_dir()?.join("input-diagnostics");
    fs::create_dir_all(&dir)?;
    let path = dir.join("events.jsonl");
    let file = LogFile::open(path.clone(), ROTATE_BYTES)?;
    let (sender, receiver) = mpsc::sync_channel(16384);
    let dropped = Arc::new(AtomicU64::new(0));
    let error = Arc::new(Mutex::new(None));
    let writer_dropped = dropped.clone();
    let writer_error = error.clone();
    std::thread::Builder::new()
        .name("input-diagnostic-writer".into())
        .spawn(move || writer_loop(file, receiver, writer_dropped, writer_error))?;
    LOGGER
        .set(Recorder {
            sender,
            dropped,
            error,
            pending: Mutex::new(None),
            path,
            start: Instant::now(),
        })
        .map_err(|_| "diagnostics already initialized")?;
    record(
        "session_start",
        json!({"pid":std::process::id(),"version":env!("CARGO_PKG_VERSION")}),
    );
    Ok(())
}
#[tauri::command]
pub fn diagnostic_status() -> Result<DiagnosticStatus, String> {
    let logger = LOGGER.get().ok_or("ログが初期化されていません")?;
    Ok(DiagnosticStatus {
        path: logger.path.to_string_lossy().into_owned(),
        dropped_events: logger.dropped.load(Ordering::Relaxed) as f64,
        error: logger.error.lock().map_err(|e| e.to_string())?.clone(),
        pending: logger.pending.lock().map_err(|e| e.to_string())?.clone(),
    })
}
fn processor_snapshot() -> Value {
    #[cfg(windows)]
    {
        return match crate::key_processor::state::get_state().try_lock() {
            Ok(state) => json!({"layers":state.active_layers,"pressedVks":state.pressed_vks,
                "physicalModifiers":state.physically_pressed_modifiers}),
            Err(_) => json!({"unavailable":"busy"}),
        };
    }
    #[cfg(not(windows))]
    json!(null)
}
pub fn begin_incident(app: &tauri::AppHandle) -> Result<Incident, String> {
    let logger = LOGGER.get().ok_or("ログが初期化されていません")?;
    let mut pending = logger.pending.lock().map_err(|e| e.to_string())?;
    if let Some(incident) = pending.as_ref() {
        return Ok(incident.clone());
    }
    let incident = Incident {
        id: format!(
            "{}-{}",
            std::process::id(),
            NEXT_ID.fetch_add(1, Ordering::Relaxed)
        ),
        unix_ms: unix_ms(),
    };
    let state = app.state::<crate::ConfigState>();
    let profile = state
        .active_profile
        .lock()
        .map_err(|e| e.to_string())?
        .clone();
    let event = envelope(
        "incident_mark",
        json!({"incident":incident,"profile":profile,"config":&**state.config.load(),"processor":processor_snapshot()}),
        logger.start,
    );
    logger
        .sender
        .try_send(Message::Event(event))
        .map_err(|e| format!("時刻を記録できません: {e}"))?;
    *pending = Some(incident.clone());
    Ok(incident)
}
#[tauri::command]
pub fn diagnostic_mark(app: tauri::AppHandle) -> Result<Incident, String> {
    begin_incident(&app)
}
fn flush_logger(stop: bool) -> Result<(), String> {
    let logger = LOGGER.get().ok_or("ログが初期化されていません")?;
    let (tx, rx) = mpsc::channel();
    logger
        .sender
        .try_send(if stop {
            Message::Stop(tx)
        } else {
            Message::Flush(tx)
        })
        .map_err(|e| e.to_string())?;
    rx.recv_timeout(Duration::from_secs(5))
        .map_err(|e| e.to_string())?
}
#[tauri::command]
pub async fn diagnostic_save(id: String, note: String) -> Result<(), String> {
    if note.chars().count() > 1000 {
        return Err("メモは1000文字以内で入力してください".into());
    }
    tauri::async_runtime::spawn_blocking(move || {
        let logger = LOGGER.get().ok_or("ログが初期化されていません")?;
        let incident = logger
            .pending
            .lock()
            .map_err(|e| e.to_string())?
            .clone()
            .filter(|incident| incident.id == id)
            .ok_or("記録対象が見つかりません")?;
        logger
            .sender
            .try_send(Message::Event(envelope(
                "incident_note",
                json!({"incident":incident,"note":note}),
                logger.start,
            )))
            .map_err(|e| e.to_string())?;
        flush_logger(false)?;
        *logger.pending.lock().map_err(|e| e.to_string())? = None;
        Ok(())
    })
    .await
    .map_err(|e| e.to_string())?
}
pub fn shutdown() {
    record("session_end", json!({}));
    if let Err(error) = flush_logger(true) {
        log::error!("Diagnostic shutdown: {error}");
    }
}
pub fn setup_tray(app: &tauri::AppHandle) -> tauri::Result<()> {
    use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
    let mut builder = TrayIconBuilder::with_id("input-diagnostics")
        .tooltip("異常を記録 — クリックして時刻とメモを残す")
        .on_tray_icon_event(|tray, event| {
            if matches!(
                event,
                TrayIconEvent::Click {
                    button: MouseButton::Left,
                    button_state: MouseButtonState::Up,
                    ..
                }
            ) {
                let app = tray.app_handle();
                if let Err(error) = begin_incident(app) {
                    if let Some(logger) = LOGGER.get() {
                        if let Ok(mut status) = logger.error.lock() {
                            *status = Some(error);
                        }
                    }
                }
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.unminimize();
                    let _ = window.set_focus();
                }
                let _ = app.emit("diagnostic-incident", ());
            }
        });
    if let Some(icon) = app.default_window_icon() {
        builder = builder.icon(icon.clone());
    }
    builder.build(app)?;
    Ok(())
}
#[cfg(all(windows, not(test)))]
pub unsafe fn send_input(inputs: &[windows::Win32::UI::Input::KeyboardAndMouse::INPUT]) -> u32 {
    use windows::Win32::UI::Input::KeyboardAndMouse::{
        SendInput, INPUT, INPUT_KEYBOARD, INPUT_MOUSE,
    };
    let batch = NEXT_ID.fetch_add(1, Ordering::Relaxed).to_string();
    for (index, input) in inputs.iter().enumerate() {
        let data = if input.r#type == INPUT_KEYBOARD {
            let ki = input.Anonymous.ki;
            json!({"type":"keyboard","vk":ki.wVk.0,"scan":ki.wScan,"flags":ki.dwFlags.0,"extraInfo":ki.dwExtraInfo.to_string()})
        } else if input.r#type == INPUT_MOUSE {
            let mi = input.Anonymous.mi;
            json!({"type":"mouse","dx":mi.dx,"dy":mi.dy,"mouseData":mi.mouseData,"flags":mi.dwFlags.0,"extraInfo":mi.dwExtraInfo.to_string()})
        } else {
            json!({"type":"hardware"})
        };
        record(
            "os_send_request",
            json!({"batch":batch,"index":index,"input":data}),
        );
    }
    let count = SendInput(inputs, std::mem::size_of::<INPUT>() as i32);
    let error = if count != inputs.len() as u32 {
        Some(windows::Win32::Foundation::GetLastError().0)
    } else {
        None
    };
    record(
        "os_send_result",
        json!({"batch":batch,"requested":inputs.len(),"sent":count,"lastError":error}),
    );
    count
}
#[cfg(test)]
mod tests {
    use super::*;
    fn temp_dir() -> PathBuf {
        let dir = std::env::temp_dir().join(format!(
            "remapper-diagnostics-{}-{}",
            std::process::id(),
            NEXT_ID.fetch_add(1, Ordering::Relaxed)
        ));
        fs::create_dir_all(&dir).unwrap();
        dir
    }
    #[test]
    fn rotates_complete_json_lines_and_bounds_history() {
        let dir = temp_dir();
        let path = dir.join("events.jsonl");
        let mut file = LogFile::open(path.clone(), 40).unwrap();
        for i in 0..20 {
            file.write(&json!({"event":i,"note":"改行\nメモ"})).unwrap();
        }
        file.flush().unwrap();
        drop(file);
        assert_eq!(fs::read_dir(&dir).unwrap().count(), 8);
        let active = fs::read_to_string(&path).unwrap();
        assert_eq!(
            serde_json::from_str::<Value>(active.trim()).unwrap()["event"],
            19
        );
        for entry in fs::read_dir(&dir).unwrap() {
            for line in fs::read_to_string(entry.unwrap().path()).unwrap().lines() {
                serde_json::from_str::<Value>(line).unwrap();
            }
        }
        fs::remove_dir_all(dir).unwrap();
    }
    #[test]
    fn worker_drains_reports_loss_and_flushes_before_ack() {
        let dir = temp_dir();
        let path = dir.join("events.jsonl");
        let file = LogFile::open(path.clone(), ROTATE_BYTES).unwrap();
        let (tx, rx) = mpsc::sync_channel(8);
        let dropped = Arc::new(AtomicU64::new(3));
        let error = Arc::new(Mutex::new(None));
        let worker = std::thread::spawn(move || writer_loop(file, rx, dropped, error));
        tx.send(Message::Event(json!({"kind":"incident_mark","id":"a"})))
            .unwrap();
        tx.send(Message::Event(
            json!({"kind":"incident_note","id":"a","note":"test"}),
        ))
        .unwrap();
        let (ack, done) = mpsc::channel();
        tx.send(Message::Stop(ack)).unwrap();
        done.recv_timeout(Duration::from_secs(2)).unwrap().unwrap();
        worker.join().unwrap();
        let events: Vec<Value> = fs::read_to_string(path)
            .unwrap()
            .lines()
            .map(|line| serde_json::from_str(line).unwrap())
            .collect();
        assert_eq!(events.len(), 3);
        assert_eq!(events[0]["total"], 3);
        assert_eq!(events[1]["kind"], "incident_mark");
        assert_eq!(events[2]["note"], "test");
        fs::remove_dir_all(dir).unwrap();
    }

    #[test]
    fn idle_worker_flushes_without_an_explicit_request() {
        let dir = temp_dir();
        let path = dir.join("events.jsonl");
        let file = LogFile::open(path.clone(), ROTATE_BYTES).unwrap();
        let (tx, rx) = mpsc::sync_channel(8);
        let worker = std::thread::spawn(move || {
            writer_loop(
                file,
                rx,
                Arc::new(AtomicU64::new(0)),
                Arc::new(Mutex::new(None)),
            )
        });
        tx.send(Message::Event(json!({"kind":"keyboard_input"})))
            .unwrap();
        let deadline = Instant::now() + Duration::from_secs(3);
        while fs::metadata(&path).unwrap().len() == 0 && Instant::now() < deadline {
            std::thread::sleep(Duration::from_millis(20));
        }
        assert!(fs::read_to_string(&path)
            .unwrap()
            .contains("keyboard_input"));
        drop(tx);
        worker.join().unwrap();
        fs::remove_dir_all(dir).unwrap();
    }

    #[test]
    fn write_failure_is_visible_and_stop_still_acknowledges() {
        let dir = temp_dir();
        let path = dir.join("events.jsonl");
        fs::write(&path, "").unwrap();
        let file = LogFile {
            path: path.clone(),
            writer: BufWriter::new(File::open(&path).unwrap()),
            bytes: 0,
            limit: ROTATE_BYTES,
        };
        let (tx, rx) = mpsc::sync_channel(8);
        let error = Arc::new(Mutex::new(None));
        let worker_error = error.clone();
        let worker = std::thread::spawn(move || {
            writer_loop(file, rx, Arc::new(AtomicU64::new(0)), worker_error)
        });
        tx.send(Message::Event(json!({"kind":"incident_note"})))
            .unwrap();
        let (ack, done) = mpsc::channel();
        tx.send(Message::Stop(ack)).unwrap();
        assert!(done.recv_timeout(Duration::from_secs(2)).unwrap().is_err());
        worker.join().unwrap();
        assert!(error.lock().unwrap().is_some());
        fs::remove_dir_all(dir).unwrap();
    }
}
