use crate::{cascade_api, chat_server, focus, global_rules, launchagent, license, ram_disk, sentinel};
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
    eprintln!("[Commands] send_chat_response 开始:");
    eprintln!("  - request_id: {}", request_id);
    eprintln!("  - action: {}", action);
    eprintln!("  - text length: {}", text.len());
    eprintln!("  - text 前50字符: {}", &text[..50.min(text.len())]);
    
    if let Some(ref imgs) = images {
        eprintln!("  - images count: {}", imgs.len());
        eprintln!("  - images: {:?}", imgs);
        for (i, img_path) in imgs.iter().enumerate() {
            eprintln!("    - image[{}]: {}", i, img_path);
            // 检查文件是否存在
            match std::fs::metadata(img_path) {
                Ok(metadata) => {
                    eprintln!("      - 文件存在，大小: {} 字节", metadata.len());
                    eprintln!("      - 文件修改时间: {:?}", metadata.modified());
                }
                Err(e) => {
                    eprintln!("      - 文件检查失败: {}", e);
                }
            }
        }
    } else {
        eprintln!("  - images: None");
    }
    
    let response = chat_server::ChatResponse {
        action,
        text,
        images: images.unwrap_or_default(),
        error: None,
    };
    
    eprintln!("[Commands] 构造 ChatResponse 完成:");
    eprintln!("  - action: {}", response.action);
    eprintln!("  - text length: {}", response.text.len());
    eprintln!("  - images count: {}", response.images.len());
    
    eprintln!("[Commands] 调用 chat_server::send_response");
    match chat_server::send_response(state.inner().clone(), &request_id, response) {
        Ok(()) => {
            eprintln!("[Commands] send_chat_response 成功");
            Ok(())
        }
        Err(e) => {
            eprintln!("[Commands] send_chat_response 失败: {}", e);
            Err(e)
        }
    }
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
    eprintln!("[Backend] save_feedback_image 开始");
    eprintln!("[Backend] 文件名: {}", filename);
    eprintln!("[Backend] image_data 长度: {}", image_data.len());
    eprintln!("[Backend] image_data 前50字符: {}", &image_data[..50.min(image_data.len())]);
    
    let workspaces = chat_server::get_workspace_paths(state.inner().clone());
    eprintln!("[Backend] 获取到 {} 个工作空间", workspaces.len());
    
    let ws = workspaces.first().cloned()
        .ok_or("No workspace configured. Please initialize a workspace first.")?;
    eprintln!("[Backend] 使用工作空间: {}", ws.display());

    tokio::task::spawn_blocking(move || {
        eprintln!("[Backend] 进入阻塞任务");
        
        let images_dir = match select_images_dir(&ws) {
            Ok(dir) => {
                eprintln!("[Backend] 图片目录: {}", dir.display());
                dir
            }
            Err(e) => {
                eprintln!("[Backend] 选择图片目录失败: {}", e);
                return Err(e);
            }
        };
        
        match std::fs::create_dir_all(&images_dir) {
            Ok(()) => eprintln!("[Backend] 图片目录创建成功"),
            Err(e) => {
                eprintln!("[Backend] 图片目录创建失败: {}", e);
                return Err(format!("Failed to create images directory: {}", e));
            }
        }

        let base64_data = if let Some(idx) = image_data.find(",") {
            eprintln!("[Backend] 找到 base64 前缀分隔符，位置: {}", idx);
            &image_data[idx + 1..]
        } else {
            eprintln!("[Backend] 没有找到 base64 前缀分隔符，使用全部数据");
            &image_data
        };
        
        eprintln!("[Backend] 处理后的 base64 数据长度: {}", base64_data.len());
        eprintln!("[Backend] 处理后的 base64 前50字符: {}", &base64_data[..50.min(base64_data.len())]);

        use base64::Engine;
        let bytes = match base64::engine::general_purpose::STANDARD.decode(base64_data) {
            Ok(bytes) => {
                eprintln!("[Backend] base64 解码成功，解码后字节数: {}", bytes.len());
                bytes
            }
            Err(e) => {
                eprintln!("[Backend] base64 解码失败: {}", e);
                return Err(format!("Invalid base64: {}", e));
            }
        };

        let file_path = images_dir.join(&filename);
        eprintln!("[Backend] 目标文件路径: {}", file_path.display());
        
        match std::fs::write(&file_path, &bytes) {
            Ok(()) => {
                eprintln!("[Backend] 文件写入成功");
                let path_str = file_path.to_string_lossy().to_string();
                eprintln!("[Backend] 返回路径: {}", path_str);
                Ok(path_str)
            }
            Err(e) => {
                eprintln!("[Backend] 文件写入失败: {}", e);
                Err(format!("Failed to write image: {}", e))
            }
        }
    }).await.map_err(|e| {
        eprintln!("[Backend] 阻塞任务执行失败: {}", e);
        e.to_string()
    })?
}

fn select_images_dir(_workspace_path: &std::path::Path) -> Result<std::path::PathBuf, String> {
    if !crate::ram_disk::is_mounted() {
        return Err("RAM disk is not mounted. Please initialize the RAM disk first.".to_string());
    }
    Ok(crate::ram_disk::ram_disk_path().join("feedback_images"))
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

        // 3. Write sentinel file
        sentinel::write()?;

        // 4. Install LaunchAgent
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
pub async fn install_global_rules() -> Result<(), String> {
    tokio::task::spawn_blocking(|| {
        global_rules::install_global_rules()
    }).await.map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn remove_injection() -> Result<(), String> {
    tokio::task::spawn_blocking(|| {
        global_rules::remove_global_rules()
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

// ===== License =====

#[tauri::command]
pub fn get_machine_id() -> String {
    license::get_machine_id()
}

#[tauri::command]
pub async fn activate_license(key: String) -> Result<license::LicenseStatus, String> {
    tokio::task::spawn_blocking(move || license::activate_license(&key))
        .await
        .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn verify_license() -> Result<license::LicenseStatus, String> {
    tokio::task::spawn_blocking(|| license::verify_license())
        .await
        .map_err(|e| e.to_string())?
}

#[tauri::command]
pub fn clear_license() {
    license::clear_license();
}
