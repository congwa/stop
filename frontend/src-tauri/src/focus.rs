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

    #[cfg(target_os = "windows")]
    {
        // Try to focus Windsurf window using PowerShell
        let script = r#"
            $windsurf = Get-Process | Where-Object { $_.ProcessName -like '*Windsurf*' -or $_.MainWindowTitle -like '*Windsurf*' } | Select-Object -First 1
            if ($windsurf -and $windsurf.MainWindowHandle -ne 0) {
                Add-Type @"
                    using System;
                    using System.Runtime.InteropServices;
                    public class Win32 {
                        [DllImport("user32.dll")]
                        public static extern bool SetForegroundWindow(IntPtr hWnd);
                        [DllImport("user32.dll")]
                        public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
                    }
"@
                [Win32]::ShowWindow($windsurf.MainWindowHandle, 9)
                [Win32]::SetForegroundWindow($windsurf.MainWindowHandle)
            }
        "#;
        let _ = Command::new("powershell")
            .args(["-NoProfile", "-Command", script])
            .output();
        Ok(())
    }

    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    {
        Ok(())
    }
}
