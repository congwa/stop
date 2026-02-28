pub mod cascade_api;
pub mod chat_server;
pub mod commands;
pub mod focus;
pub mod global_rules;
pub mod launchagent;
pub mod license;
pub mod ram_disk;
pub mod sentinel;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let server_state = chat_server::create_shared_state();

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(server_state.clone())
        .setup(move |app| {
            let app_handle = app.handle().clone();
            let state = server_state.clone();

            std::thread::spawn(move || {
                // 0. Clean up old feedback images (from previous sessions)
                if let Err(e) = commands::cleanup_feedback_images() {
                    eprintln!("[Stop] Failed to cleanup feedback images: {}", e);
                }

                // 1. Start chat server
                let port = match chat_server::start_server(state.clone(), app_handle) {
                    Ok(p) => { eprintln!("[Stop] Chat server started on port {}", p); p }
                    Err(e) => { eprintln!("[Stop] Failed to start chat server: {}", e); return; }
                };

                // 2. Mount RAM disk and set up global rules
                match ram_disk::mount() {
                    Ok(_) => {
                        eprintln!("[Stop] RAM disk mounted at {}", ram_disk::ram_disk_path().display());

                        // Write port to RAM disk
                        let _ = ram_disk::write_port(port);

                        // Install windsurf_chat binary
                        if let Some(src) = ram_disk::find_app_binary() {
                            match ram_disk::install_binary(&src) {
                                Ok(p) => eprintln!("[Stop] Binary installed at {}", p.display()),
                                Err(e) => eprintln!("[Stop] Binary install failed: {}", e),
                            }
                        } else {
                            eprintln!("[Stop] windsurf_chat binary not found");
                        }

                    }
                    Err(e) => eprintln!("[Stop] RAM disk mount failed: {}", e),
                }

                // 3. Write sentinel file
                let _ = sentinel::write();

                // 4. Install LaunchAgent (for cleanup on force-quit)
                if !launchagent::is_installed() {
                    match launchagent::install() {
                        Ok(_) => eprintln!("[Stop] LaunchAgent installed"),
                        Err(e) => eprintln!("[Stop] LaunchAgent install failed: {}", e),
                    }
                }

                // 5. Write port files to known workspace paths
                chat_server::write_port_files(state);
            });

            Ok(())
        })
        .on_window_event(|_window, event| {
            if let tauri::WindowEvent::Destroyed = event {
                // Clean up on window close
                eprintln!("[Stop] Window destroyed, cleaning up...");
                let _ = sentinel::remove();
                let _ = global_rules::remove_global_rules();
                let _ = ram_disk::eject();
            }
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
            commands::focus_windsurf,
            commands::get_ram_disk_status,
            commands::init_ram_disk,
            commands::install_global_rules,
            commands::remove_injection,
            commands::cleanup_ram_disk,
            commands::get_machine_id,
            commands::activate_license,
            commands::verify_license,
            commands::clear_license,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
