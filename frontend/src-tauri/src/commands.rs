use crate::{cascade_api, chat_server, chat_workspace, focus, global_rules, launchagent, ram_disk, sentinel};
use crate::chat_server::SharedState;

// ===== Auto Mode =====

#[derive(Debug, Clone, serde::Serialize)]
pub struct AutoModeInfo {
    pub auto_execution_policy: String,
    pub auto_continue_enabled: bool,
}

#[tauri::command]
pub async fn get_auto_mode_info() -> Result<AutoModeInfo, String> {
    tokio::task::spawn_blocking(|| {
        let info = cascade_api::discover_language_server()?;
        let (policy, auto_continue) = cascade_api::get_auto_mode(&info)?;
        Ok(AutoModeInfo {
            auto_execution_policy: policy,
            auto_continue_enabled: auto_continue,
        })
    }).await.map_err(|e| e.to_string())?
}

// ===== Chat Feedback Server =====

#[tauri::command]
pub fn start_chat_server(
    state: tauri::State<'_, SharedState>,
    app_handle: tauri::AppHandle,
) -> Result<u16, String> {
    chat_server::start_server(state.inner().clone(), app_handle)
}

#[tauri::command]
pub fn stop_chat_server(state: tauri::State<'_, SharedState>) -> Result<(), String> {
    chat_server::stop_server(state.inner().clone());
    Ok(())
}

#[tauri::command]
pub fn get_chat_server_status(state: tauri::State<'_, SharedState>) -> Result<chat_server::ServerStatus, String> {
    Ok(chat_server::get_server_status(state.inner().clone()))
}

#[tauri::command]
pub fn send_chat_response(
    state: tauri::State<'_, SharedState>,
    request_id: String,
    action: String,
    text: String,
    images: Option<Vec<String>>,
) -> Result<(), String> {
    let response = chat_server::ChatResponse {
        action,
        text,
        images: images.unwrap_or_default(),
        error: None,
    };
    chat_server::send_response(state.inner().clone(), &request_id, response)
}

#[tauri::command]
pub fn get_pending_prompts(state: tauri::State<'_, SharedState>) -> Result<Vec<chat_server::PendingPrompt>, String> {
    Ok(chat_server::get_pending_prompts(state.inner().clone()))
}

#[tauri::command]
pub fn dismiss_chat_request(
    state: tauri::State<'_, SharedState>,
    request_id: String,
) -> Result<(), String> {
    chat_server::dismiss_request(state.inner().clone(), &request_id)
}

#[tauri::command]
pub async fn save_feedback_image(
    state: tauri::State<'_, SharedState>,
    image_data: String,
    filename: String,
) -> Result<String, String> {
    let workspaces = chat_server::get_workspace_paths(state.inner().clone());
    let ws = workspaces.first().cloned()
        .ok_or("No workspace configured. Please initialize a workspace first.")?;

    tokio::task::spawn_blocking(move || {
        let images_dir = ws.join(".wdm").join("images");
        std::fs::create_dir_all(&images_dir)
            .map_err(|e| format!("Failed to create images directory: {}", e))?;

        let base64_data = if let Some(idx) = image_data.find(",") {
            &image_data[idx + 1..]
        } else {
            &image_data
        };

        use base64::Engine;
        let bytes = base64::engine::general_purpose::STANDARD
            .decode(base64_data)
            .map_err(|e| format!("Invalid base64: {}", e))?;

        let file_path = images_dir.join(&filename);
        std::fs::write(&file_path, &bytes)
            .map_err(|e| format!("Failed to write image: {}", e))?;

        Ok(file_path.to_string_lossy().to_string())
    }).await.map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn setup_chat_workspace(
    state: tauri::State<'_, SharedState>,
    workspace_path: String,
) -> Result<(), String> {
    let shared = state.inner().clone();
    let wp = std::path::PathBuf::from(&workspace_path);

    let wp2 = wp.clone();
    tokio::task::spawn_blocking(move || {
        let cli_binary = std::env::current_exe()
            .ok()
            .and_then(|p| p.parent().map(|d| d.join("windsurf_chat")))
            .unwrap_or_default();
        chat_workspace::setup_workspace(&wp2, &cli_binary)
    }).await.map_err(|e| e.to_string())??;

    let mut paths = vec![wp.clone()];
    let existing = chat_server::get_workspace_paths(shared.clone());
    for p in existing {
        if p != wp { paths.push(p); }
    }
    chat_server::set_workspace_paths(shared.clone(), paths);
    chat_server::write_port_files(shared);

    Ok(())
}

// ===== RAM Disk / Global Setup =====

#[derive(Debug, Clone, serde::Serialize)]
pub struct RamDiskStatus {
    pub mounted: bool,
    pub binary_installed: bool,
    pub global_rules_installed: bool,
    pub launch_agent_installed: bool,
    pub path: String,
}

#[tauri::command]
pub fn get_ram_disk_status() -> RamDiskStatus {
    let mounted = ram_disk::is_mounted();
    RamDiskStatus {
        mounted,
        binary_installed: mounted && ram_disk::binary_path().exists(),
        global_rules_installed: global_rules::is_installed(),
        launch_agent_installed: launchagent::is_installed(),
        path: ram_disk::ram_disk_path().to_string_lossy().to_string(),
    }
}

#[tauri::command]
pub async fn init_ram_disk(
    state: tauri::State<'_, SharedState>,
) -> Result<RamDiskStatus, String> {
    let shared = state.inner().clone();
    tokio::task::spawn_blocking(move || {
        // 1. Mount RAM disk
        ram_disk::mount()?;

        // 2. Install windsurf_chat binary
        if let Some(src) = ram_disk::find_app_binary() {
            ram_disk::install_binary(&src)?;
        } else {
            eprintln!("[Stop] windsurf_chat binary not found next to app");
        }

        // 3. Write global rules
        global_rules::install_global_rules()?;

        // 4. Write sentinel file
        sentinel::write()?;

        // 5. Install LaunchAgent
        if !launchagent::is_installed() {
            launchagent::install()?;
        }

        // 6. Write port to RAM disk
        chat_server::write_port_files(shared);

        Ok(RamDiskStatus {
            mounted: true,
            binary_installed: ram_disk::binary_path().exists(),
            global_rules_installed: global_rules::is_installed(),
            launch_agent_installed: launchagent::is_installed(),
            path: ram_disk::ram_disk_path().to_string_lossy().to_string(),
        })
    }).await.map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn cleanup_ram_disk() -> Result<(), String> {
    tokio::task::spawn_blocking(|| {
        sentinel::remove()?;
        global_rules::remove_global_rules()?;
        ram_disk::eject()?;
        Ok(())
    }).await.map_err(|e| e.to_string())?
}

// ===== Focus =====

#[tauri::command]
pub fn focus_windsurf() -> Result<(), String> {
    focus::focus_windsurf()
}
