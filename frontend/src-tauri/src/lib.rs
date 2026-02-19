pub mod cascade_api;
pub mod chat_server;
pub mod chat_workspace;
pub mod commands;
pub mod focus;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let server_state = chat_server::create_shared_state();

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(server_state.clone())
        .setup(move |app| {
            // Auto-start the chat server on launch
            let app_handle = app.handle().clone();
            let state = server_state.clone();
            std::thread::spawn(move || {
                match chat_server::start_server(state, app_handle) {
                    Ok(port) => eprintln!("[Stop] Chat server started on port {}", port),
                    Err(e) => eprintln!("[Stop] Failed to start chat server: {}", e),
                }
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::get_auto_mode_info,
            commands::start_chat_server,
            commands::stop_chat_server,
            commands::get_chat_server_status,
            commands::send_chat_response,
            commands::get_pending_prompts,
            commands::dismiss_chat_request,
            commands::save_feedback_image,
            commands::setup_chat_workspace,
            commands::focus_windsurf,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
