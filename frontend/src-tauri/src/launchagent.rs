use std::path::PathBuf;
use crate::sentinel;

#[cfg(target_os = "macos")]
const LAUNCH_AGENT_LABEL: &str = "com.stop.cleanup";

#[cfg(target_os = "macos")]
pub fn launch_agent_path() -> Option<PathBuf> {
    dirs::home_dir().map(|h| {
        h.join("Library/LaunchAgents")
            .join(format!("{}.plist", LAUNCH_AGENT_LABEL))
    })
}

#[cfg(target_os = "macos")]
pub fn cleanup_script_path() -> Option<PathBuf> {
    dirs::home_dir().map(|h| h.join(".stop_cleanup.sh"))
}

// Windows: no external cleanup agent, rely on app exit hook
#[cfg(target_os = "windows")]
pub fn launch_agent_path() -> Option<PathBuf> {
    None
}

#[cfg(target_os = "windows")]
pub fn cleanup_script_path() -> Option<PathBuf> {
    None
}

/// Install the LaunchAgent that watches the sentinel file and cleans up on Stop exit.
/// On Windows, this is a no-op as cleanup is handled by app exit hook.
#[cfg(target_os = "macos")]
pub fn install() -> Result<(), String> {
    let agent_path = launch_agent_path().ok_or("Cannot find home directory")?;
    let script_path = cleanup_script_path().ok_or("Cannot find home directory")?;
    let sentinel = sentinel::sentinel_path();

    // Write the cleanup script
    let script_content = format!(
        r#"#!/bin/bash
# Stop cleanup script - auto-generated, do not edit
# Triggered by LaunchAgent when Stop exits

SENTINEL="{sentinel}"
RAM_DISK_NAME="StopRules"
GLOBAL_RULES="$HOME/.codeium/windsurf/memories/global_rules.md"

# Check if Stop process is still running
if [ -f "$SENTINEL" ]; then
    PID=$(cat "$SENTINEL" 2>/dev/null)
    if [ -n "$PID" ] && kill -0 "$PID" 2>/dev/null; then
        # Stop is still running, do nothing
        exit 0
    fi
fi

# Stop is not running - clean up
echo "[StopCleanup] Stop has exited, cleaning up..."

# Eject RAM disk
if [ -d "/Volumes/$RAM_DISK_NAME" ]; then
    diskutil eject "$RAM_DISK_NAME" 2>/dev/null || hdiutil detach "/Volumes/$RAM_DISK_NAME" 2>/dev/null
    echo "[StopCleanup] RAM disk ejected"
fi

# Remove global rules
if [ -f "$GLOBAL_RULES" ]; then
    rm -f "$GLOBAL_RULES"
    echo "[StopCleanup] Global rules removed"
fi

# Remove sentinel
rm -f "$SENTINEL"

echo "[StopCleanup] Done"
"#,
        sentinel = sentinel.display()
    );

    std::fs::write(&script_path, &script_content)
        .map_err(|e| format!("Failed to write cleanup script: {}", e))?;

    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let _ = std::fs::set_permissions(&script_path, std::fs::Permissions::from_mode(0o755));
    }

    // Write the LaunchAgent plist
    let plist_content = format!(
        r#"<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>{label}</string>
    <key>ProgramArguments</key>
    <array>
        <string>/bin/bash</string>
        <string>{script}</string>
    </array>
    <key>WatchPaths</key>
    <array>
        <string>{sentinel}</string>
    </array>
    <key>RunAtLoad</key>
    <false/>
    <key>StandardOutPath</key>
    <string>/tmp/stop_cleanup.log</string>
    <key>StandardErrorPath</key>
    <string>/tmp/stop_cleanup.log</string>
</dict>
</plist>
"#,
        label = LAUNCH_AGENT_LABEL,
        script = script_path.display(),
        sentinel = sentinel.display()
    );

    // Ensure LaunchAgents directory exists
    if let Some(parent) = agent_path.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create LaunchAgents dir: {}", e))?;
    }

    std::fs::write(&agent_path, &plist_content)
        .map_err(|e| format!("Failed to write LaunchAgent plist: {}", e))?;

    // Load the LaunchAgent
    let _ = std::process::Command::new("launchctl")
        .args(["load", &agent_path.to_string_lossy()])
        .output();

    eprintln!("[Stop] LaunchAgent installed: {}", agent_path.display());
    Ok(())
}

/// Unload and remove the LaunchAgent.
/// On Windows, this is a no-op.
#[cfg(target_os = "macos")]
pub fn uninstall() -> Result<(), String> {
    let agent_path = match launch_agent_path() {
        Some(p) => p,
        None => return Ok(()),
    };

    if agent_path.exists() {
        let _ = std::process::Command::new("launchctl")
            .args(["unload", &agent_path.to_string_lossy()])
            .output();
        std::fs::remove_file(&agent_path)
            .map_err(|e| format!("Failed to remove LaunchAgent plist: {}", e))?;
    }

    // Also remove the cleanup script
    if let Some(script_path) = cleanup_script_path() {
        let _ = std::fs::remove_file(script_path);
    }

    eprintln!("[Stop] LaunchAgent uninstalled");
    Ok(())
}

/// Check if LaunchAgent is installed.
#[cfg(target_os = "macos")]
pub fn is_installed() -> bool {
    launch_agent_path().map(|p| p.exists()).unwrap_or(false)
}

// ===== Windows stubs =====

#[cfg(target_os = "windows")]
pub fn install() -> Result<(), String> {
    // Windows: no LaunchAgent, cleanup handled by app exit hook
    eprintln!("[Stop] Windows: LaunchAgent not needed, using app exit hook");
    Ok(())
}

#[cfg(target_os = "windows")]
pub fn uninstall() -> Result<(), String> {
    Ok(())
}

#[cfg(target_os = "windows")]
pub fn is_installed() -> bool {
    // On Windows, always report "installed" since we use exit hook
    true
}
