use std::path::PathBuf;

/// Sentinel file path — exists only while Stop is running.
/// LaunchAgent watches this file to detect Stop exit.
pub fn sentinel_path() -> PathBuf {
    dirs::home_dir()
        .unwrap_or_else(|| PathBuf::from("/tmp"))
        .join(".stop_running")
}

/// Write the sentinel file (call on app startup).
pub fn write() -> Result<(), String> {
    let path = sentinel_path();
    let pid = std::process::id();
    std::fs::write(&path, pid.to_string())
        .map_err(|e| format!("Failed to write sentinel file: {}", e))?;
    eprintln!("[Stop] Sentinel written: {} (pid={})", path.display(), pid);
    Ok(())
}

/// Remove the sentinel file (call on clean shutdown).
pub fn remove() -> Result<(), String> {
    let path = sentinel_path();
    if path.exists() {
        std::fs::remove_file(&path)
            .map_err(|e| format!("Failed to remove sentinel file: {}", e))?;
        eprintln!("[Stop] Sentinel removed");
    }
    Ok(())
}

/// Check if sentinel file exists.
pub fn exists() -> bool {
    sentinel_path().exists()
}
