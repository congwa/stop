use std::process::Command;
use tauri::{AppHandle, Manager};

pub fn focus_self(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
    }

    #[cfg(target_os = "macos")]
    {
        let _ = Command::new("osascript")
            .args([
                "-e",
                r#"tell application "System Events" to set frontmost of (first process whose unix id is (do shell script "echo $PPID")) to true"#,
            ])
            .output();
    }
}

pub fn focus_windsurf() -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        let script = r#"
            try
                tell application "Windsurf" to activate
            on error
                try
                    tell application "System Events"
                        set wsProc to first process whose name contains "Windsurf"
                        set frontmost of wsProc to true
                    end tell
                end try
            end try
        "#;
        let _ = Command::new("osascript").args(["-e", script]).output();
        Ok(())
    }

    #[cfg(not(target_os = "macos"))]
    {
        Ok(())
    }
}
