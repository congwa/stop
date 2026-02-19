use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::io::{BufRead, BufReader, Read, Write};
use std::net::TcpListener;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use std::thread;
use tauri::{AppHandle, Emitter};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatRequest {
    pub prompt: String,
    #[serde(rename = "requestId")]
    pub request_id: String,
    pub context: Option<String>,
    #[serde(rename = "workspacePath")]
    pub workspace_path: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatResponse {
    pub action: String,
    pub text: String,
    pub images: Vec<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct PendingPrompt {
    pub request_id: String,
    pub prompt: String,
    pub context: Option<String>,
    pub timestamp: u64,
    pub workspace_path: Option<String>,
    pub project_name: Option<String>,
    pub connection_state: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct ServerStatus {
    pub running: bool,
    pub port: u16,
    pub pending_count: usize,
}

enum RequestState {
    Connected { response_tx: std::sync::mpsc::Sender<ChatResponse> },
    Disconnected { disconnected_at: std::time::Instant },
    ResponseQueued { response: ChatResponse, queued_at: std::time::Instant },
    Completed { response_action: String, completed_at: std::time::Instant },
}

impl RequestState {
    fn as_str(&self) -> &'static str {
        match self {
            RequestState::Connected { .. } => "connected",
            RequestState::Disconnected { .. } => "disconnected",
            RequestState::ResponseQueued { .. } => "response_queued",
            RequestState::Completed { .. } => "completed",
        }
    }
}

struct StoredRequest {
    data: ChatRequest,
    state: RequestState,
    timestamp: u64,
    project_name: Option<String>,
}

const MAX_COMPLETED: usize = 50;

pub struct ChatServerState {
    port: u16,
    running: bool,
    pending_requests: HashMap<String, StoredRequest>,
    workspace_paths: Vec<PathBuf>,
}

pub type SharedState = Arc<Mutex<ChatServerState>>;

pub fn create_shared_state() -> SharedState {
    Arc::new(Mutex::new(ChatServerState {
        port: 0,
        running: false,
        pending_requests: HashMap::new(),
        workspace_paths: Vec::new(),
    }))
}

pub fn start_server(state: SharedState, app_handle: AppHandle) -> Result<u16, String> {
    {
        let s = state.lock().unwrap();
        if s.running { return Ok(s.port); }
    }
    restore_workspace_paths(state.clone());
    let listener = find_available_port(34600, 100)?;
    let port = listener.local_addr().map_err(|e| format!("addr error: {}", e))?.port();
    { let mut s = state.lock().unwrap(); s.port = port; s.running = true; }
    let sc = state.clone();
    let ah = app_handle.clone();
    thread::spawn(move || { run_server(listener, sc, app_handle); });
    start_cleanup_thread(state, ah);
    Ok(port)
}

pub fn stop_server(state: SharedState) {
    let mut s = state.lock().unwrap();
    s.running = false;
    let ids: Vec<String> = s.pending_requests.keys().cloned().collect();
    for id in ids {
        if let Some(req) = s.pending_requests.get_mut(&id) {
            if let RequestState::Connected { response_tx } = std::mem::replace(
                &mut req.state,
                RequestState::Completed { response_action: "stopped".to_string(), completed_at: std::time::Instant::now() },
            ) {
                let _ = response_tx.send(ChatResponse { action: "error".to_string(), text: String::new(), images: Vec::new(), error: Some("Server stopped".to_string()) });
            }
        }
    }
    for wp in &s.workspace_paths {
        let _ = std::fs::remove_file(wp.join(".wdm").join("port"));
    }
}

pub fn send_response(state: SharedState, request_id: &str, response: ChatResponse) -> Result<(), String> {
    let mut s = state.lock().unwrap();
    if let Some(req) = s.pending_requests.get_mut(request_id) {
        let action = response.action.clone();
        let old = std::mem::replace(&mut req.state, RequestState::Completed { response_action: action.clone(), completed_at: std::time::Instant::now() });
        match old {
            RequestState::Connected { response_tx } => response_tx.send(response).map_err(|_| "channel closed".to_string()),
            RequestState::Disconnected { .. } | RequestState::ResponseQueued { .. } => {
                req.state = RequestState::ResponseQueued { response, queued_at: std::time::Instant::now() };
                Ok(())
            }
            RequestState::Completed { .. } => {
                req.state = RequestState::Completed { response_action: action, completed_at: std::time::Instant::now() };
                Err(format!("already completed: {}", request_id))
            }
        }
    } else {
        Err(format!("no request: {}", request_id))
    }
}

pub fn dismiss_request(state: SharedState, request_id: &str) -> Result<(), String> {
    let mut s = state.lock().unwrap();
    if let Some(req) = s.pending_requests.remove(request_id) {
        if let RequestState::Connected { response_tx } = req.state {
            let _ = response_tx.send(ChatResponse { action: "end".to_string(), text: String::new(), images: Vec::new(), error: Some("dismissed".to_string()) });
        }
        Ok(())
    } else {
        Err(format!("no request: {}", request_id))
    }
}

pub fn get_pending_prompts(state: SharedState) -> Vec<PendingPrompt> {
    let s = state.lock().unwrap();
    let mut v: Vec<PendingPrompt> = s.pending_requests.values().map(|r| PendingPrompt {
        request_id: r.data.request_id.clone(),
        prompt: r.data.prompt.clone(),
        context: r.data.context.clone(),
        timestamp: r.timestamp,
        workspace_path: r.data.workspace_path.clone(),
        project_name: r.project_name.clone(),
        connection_state: r.state.as_str().to_string(),
    }).collect();
    v.sort_by(|a, b| b.timestamp.cmp(&a.timestamp));
    v
}

pub fn get_server_status(state: SharedState) -> ServerStatus {
    let s = state.lock().unwrap();
    ServerStatus { running: s.running, port: s.port, pending_count: s.pending_requests.len() }
}

pub fn get_workspace_paths(state: SharedState) -> Vec<PathBuf> {
    state.lock().unwrap().workspace_paths.clone()
}

pub fn set_workspace_paths(state: SharedState, paths: Vec<PathBuf>) {
    { state.lock().unwrap().workspace_paths = paths.clone(); }
    persist_workspace_paths(&paths);
}

pub fn write_port_files(state: SharedState) {
    let s = state.lock().unwrap();
    if s.port == 0 { return; }
    for wp in &s.workspace_paths {
        let dir = wp.join(".wdm");
        let _ = std::fs::create_dir_all(&dir);
        let _ = std::fs::write(dir.join("port"), s.port.to_string());
    }
}

fn registry_path() -> Option<PathBuf> {
    dirs::home_dir().map(|h| h.join(".stop_registry.json"))
}

fn persist_workspace_paths(paths: &[PathBuf]) {
    if let Some(file) = registry_path() {
        let strings: Vec<String> = paths.iter().map(|p| p.to_string_lossy().to_string()).collect();
        if let Ok(json) = serde_json::to_string(&strings) {
            let _ = std::fs::write(&file, json);
        }
    }
}

pub fn restore_workspace_paths(state: SharedState) {
    let file = match registry_path() { Some(f) if f.exists() => f, _ => return };
    let content = match std::fs::read_to_string(&file) { Ok(c) => c, Err(_) => return };
    let strings: Vec<String> = match serde_json::from_str(&content) { Ok(v) => v, Err(_) => return };
    let paths: Vec<PathBuf> = strings.into_iter().map(PathBuf::from).filter(|p| p.join(".wdm").is_dir()).collect();
    if !paths.is_empty() {
        let mut s = state.lock().unwrap();
        if s.workspace_paths.is_empty() { s.workspace_paths = paths; }
    }
}

fn start_cleanup_thread(state: SharedState, app_handle: AppHandle) {
    thread::spawn(move || loop {
        thread::sleep(std::time::Duration::from_secs(30));
        let running = { state.lock().unwrap().running };
        if !running { break; }
        let mut s = state.lock().unwrap();
        let mut completed: Vec<(String, std::time::Instant)> = s.pending_requests.iter()
            .filter_map(|(id, req)| if let RequestState::Completed { completed_at, .. } = &req.state { Some((id.clone(), *completed_at)) } else { None })
            .collect();
        if completed.len() > MAX_COMPLETED {
            completed.sort_by_key(|(_, t)| *t);
            let to_remove: Vec<String> = completed[..completed.len() - MAX_COMPLETED].iter().map(|(id, _)| id.clone()).collect();
            for id in &to_remove { s.pending_requests.remove(id); }
            if !to_remove.is_empty() { let _ = app_handle.emit("chat-stale-removed", &to_remove); }
        }
    });
}

fn find_available_port(base: u16, max: u16) -> Result<TcpListener, String> {
    for offset in 0..max {
        if let Ok(l) = TcpListener::bind(format!("127.0.0.1:{}", base + offset)) { return Ok(l); }
    }
    Err("No available port".to_string())
}

fn run_server(listener: TcpListener, state: SharedState, app_handle: AppHandle) {
    for stream in listener.incoming() {
        if !state.lock().unwrap().running { break; }
        if let Ok(stream) = stream {
            let s = state.clone(); let a = app_handle.clone();
            thread::spawn(move || { handle_connection(stream, s, a); });
        }
    }
}

fn handle_connection(mut stream: std::net::TcpStream, state: SharedState, app_handle: AppHandle) {
    let _ = stream.set_read_timeout(Some(std::time::Duration::from_secs(10)));
    let _ = stream.set_write_timeout(None);
    let mut reader = BufReader::new(stream.try_clone().unwrap());
    let mut req_line = String::new();
    if reader.read_line(&mut req_line).is_err() { return; }
    let parts: Vec<&str> = req_line.trim().split_whitespace().collect();
    if parts.len() < 2 { return; }
    let (method, path) = (parts[0], parts[1]);
    let mut content_length: usize = 0;
    loop {
        let mut line = String::new();
        if reader.read_line(&mut line).is_err() || line.trim().is_empty() { break; }
        if line.to_lowercase().starts_with("content-length:") {
            content_length = line.to_lowercase().trim_start_matches("content-length:").trim().parse().unwrap_or(0);
        }
    }
    match (method, path) {
        ("POST", "/request") => handle_request(&mut reader, &mut stream, content_length, state, app_handle),
        ("GET", "/health") => {
            let body = serde_json::json!({ "status": "ok" }).to_string();
            send_http_response(&mut stream, 200, &body);
        }
        _ => send_http_response(&mut stream, 404, "Not Found"),
    }
}

fn handle_request(reader: &mut BufReader<std::net::TcpStream>, stream: &mut std::net::TcpStream, content_length: usize, state: SharedState, app_handle: AppHandle) {
    if content_length == 0 || content_length > 10 * 1024 * 1024 {
        send_http_response(stream, 400, r#"{"error":"bad length"}"#); return;
    }
    let mut body = vec![0u8; content_length];
    if reader.read_exact(&mut body).is_err() {
        send_http_response(stream, 400, r#"{"error":"read failed"}"#); return;
    }
    let data: ChatRequest = match serde_json::from_slice(&body) {
        Ok(d) => d,
        Err(e) => { send_http_response(stream, 400, &format!("{{\"error\":\"{}\"}}", e)); return; }
    };
    let request_id = if data.request_id.is_empty() {
        std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap_or_default().as_millis().to_string()
    } else { data.request_id.clone() };

    let mut workspace_path = data.workspace_path.clone().unwrap_or_default();
    if workspace_path.is_empty() {
        let s = state.lock().unwrap();
        if let Some(wp) = s.workspace_paths.first() {
            workspace_path = wp.to_string_lossy().to_string();
        }
    }

    let project_name = if !workspace_path.is_empty() {
        workspace_path.trim_end_matches('/').split('/').filter(|s| !s.is_empty()).last().map(|s| s.to_string())
    } else { None };

    // Check for queued response
    {
        let mut s = state.lock().unwrap();
        let queued_key = s.pending_requests.iter()
            .find(|(_, req)| matches!(req.state, RequestState::ResponseQueued { .. }) && req.data.workspace_path.as_deref() == Some(&workspace_path))
            .map(|(k, _)| k.clone());
        if let Some(old_key) = queued_key {
            if let Some(old_req) = s.pending_requests.get_mut(&old_key) {
                let old_state = std::mem::replace(&mut old_req.state, RequestState::Completed { response_action: "queued_delivered".to_string(), completed_at: std::time::Instant::now() });
                if let RequestState::ResponseQueued { response, .. } = old_state {
                    drop(s);
                    let body = serde_json::to_string(&response).unwrap_or_default();
                    send_http_response(stream, 200, &body);
                    let _ = app_handle.emit("chat-request-completed", &old_key);
                    return;
                }
            }
        }
    }

    crate::focus::focus_self(&app_handle);

    let now_ts = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap_or_default().as_secs();
    let (tx, rx) = std::sync::mpsc::channel::<ChatResponse>();

    {
        let mut s = state.lock().unwrap();
        if let Some(old) = s.pending_requests.get_mut(&request_id) {
            if let RequestState::Connected { response_tx } = std::mem::replace(&mut old.state, RequestState::Completed { response_action: "superseded".to_string(), completed_at: std::time::Instant::now() }) {
                let _ = response_tx.send(ChatResponse { action: "timeout_continue".to_string(), text: String::new(), images: Vec::new(), error: None });
            }
            s.pending_requests.remove(&request_id);
        }
        s.pending_requests.insert(request_id.clone(), StoredRequest {
            data: ChatRequest { prompt: data.prompt.clone(), request_id: request_id.clone(), context: data.context.clone(), workspace_path: if workspace_path.is_empty() { None } else { Some(workspace_path.clone()) } },
            state: RequestState::Connected { response_tx: tx },
            timestamp: now_ts,
            project_name: project_name.clone(),
        });
    }

    let prompt_event = PendingPrompt {
        request_id: request_id.clone(),
        prompt: data.prompt.clone(),
        context: data.context.clone(),
        timestamp: now_ts,
        workspace_path: if workspace_path.is_empty() { None } else { Some(workspace_path.clone()) },
        project_name,
        connection_state: "connected".to_string(),
    };
    let _ = app_handle.emit("chat-request", &prompt_event);

    let peek_stream = stream.try_clone().ok();
    let check_interval = std::time::Duration::from_secs(3);
    let max_wait = std::time::Duration::from_secs(4 * 60 * 60);
    let start = std::time::Instant::now();

    let response = loop {
        match rx.recv_timeout(check_interval) {
            Ok(resp) => break Some(resp),
            Err(std::sync::mpsc::RecvTimeoutError::Timeout) => {
                if start.elapsed() > max_wait { break None; }
                if let Some(ref ps) = peek_stream {
                    if !is_tcp_alive(ps) {
                        let mut s = state.lock().unwrap();
                        if let Some(req) = s.pending_requests.get_mut(&request_id) {
                            req.state = RequestState::Disconnected { disconnected_at: std::time::Instant::now() };
                        }
                        let _ = app_handle.emit("chat-request-disconnected", &request_id);
                        return;
                    }
                }
            }
            Err(_) => break None,
        }
    };

    match response {
        Some(resp) => {
            let body = serde_json::to_string(&resp).unwrap_or_default();
            let http = format!("HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}", body.len(), body);
            let _ = stream.write_all(http.as_bytes());
            let _ = stream.flush();
        }
        None => {
            let timeout_resp = serde_json::json!({ "action": "timeout_continue", "text": "", "images": [] }).to_string();
            send_http_response(stream, 200, &timeout_resp);
            let mut s = state.lock().unwrap();
            if let Some(req) = s.pending_requests.get_mut(&request_id) {
                req.state = RequestState::Completed { response_action: "timeout".to_string(), completed_at: std::time::Instant::now() };
            }
            let _ = app_handle.emit("chat-request-completed", &request_id);
        }
    }
}

fn send_http_response(stream: &mut std::net::TcpStream, status: u16, body: &str) {
    let text = match status { 200 => "OK", 400 => "Bad Request", 404 => "Not Found", _ => "Error" };
    let resp = format!("HTTP/1.1 {} {}\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}", status, text, body.len(), body);
    let _ = stream.write_all(resp.as_bytes());
    let _ = stream.flush();
}

fn is_tcp_alive(stream: &std::net::TcpStream) -> bool {
    let check = match stream.try_clone() { Ok(s) => s, Err(_) => return false };
    let _ = check.set_nonblocking(true);
    let mut buf = [0u8; 1];
    match check.peek(&mut buf) {
        Ok(0) => false,
        Ok(_) => true,
        Err(ref e) if e.kind() == std::io::ErrorKind::WouldBlock => true,
        Err(_) => false,
    }
}
