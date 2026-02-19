use std::path::{Path, PathBuf};
use std::process::Command;

pub const RAM_DISK_NAME: &str = "StopRules";
pub const RAM_DISK_SIZE_MB: u32 = 64;

pub fn ram_disk_path() -> PathBuf {
    PathBuf::from(format!("/Volumes/{}", RAM_DISK_NAME))
}

pub fn is_mounted() -> bool {
    ram_disk_path().exists()
}

/// Create and mount the RAM disk. Returns Ok(path) on success.
pub fn mount() -> Result<PathBuf, String> {
    if is_mounted() {
        return Ok(ram_disk_path());
    }

    #[cfg(target_os = "macos")]
    {
        // Calculate sectors: 1 sector = 512 bytes, 1 MB = 2048 sectors
        let sectors = RAM_DISK_SIZE_MB as usize * 2048;

        // Allocate RAM disk device
        let attach_out = Command::new("hdiutil")
            .args(["attach", "-nomount", &format!("ram://{}", sectors)])
            .output()
            .map_err(|e| format!("hdiutil attach failed: {}", e))?;

        if !attach_out.status.success() {
            return Err(format!(
                "hdiutil attach failed: {}",
                String::from_utf8_lossy(&attach_out.stderr)
            ));
        }

        let device = String::from_utf8_lossy(&attach_out.stdout).trim().to_string();
        if device.is_empty() {
            return Err("hdiutil returned empty device".to_string());
        }

        // Format as HFS+
        let format_out = Command::new("diskutil")
            .args(["erasevolume", "HFS+", RAM_DISK_NAME, &device])
            .output()
            .map_err(|e| format!("diskutil erasevolume failed: {}", e))?;

        if !format_out.status.success() {
            // Try to detach on failure
            let _ = Command::new("hdiutil").args(["detach", &device]).output();
            return Err(format!(
                "diskutil erasevolume failed: {}",
                String::from_utf8_lossy(&format_out.stderr)
            ));
        }

        let path = ram_disk_path();
        if path.exists() {
            Ok(path)
        } else {
            Err(format!("RAM disk mounted but path {} not found", path.display()))
        }
    }

    #[cfg(not(target_os = "macos"))]
    {
        // On non-macOS: use a temp directory as fallback
        let path = std::env::temp_dir().join("StopRules");
        std::fs::create_dir_all(&path).map_err(|e| format!("mkdir failed: {}", e))?;
        Ok(path)
    }
}

/// Eject the RAM disk. All data is destroyed.
pub fn eject() -> Result<(), String> {
    if !is_mounted() {
        return Ok(());
    }

    #[cfg(target_os = "macos")]
    {
        let out = Command::new("diskutil")
            .args(["eject", RAM_DISK_NAME])
            .output()
            .map_err(|e| format!("diskutil eject failed: {}", e))?;

        if !out.status.success() {
            // Try hdiutil detach as fallback
            let path = ram_disk_path();
            let _ = Command::new("hdiutil")
                .args(["detach", &path.to_string_lossy()])
                .output();
        }
        Ok(())
    }

    #[cfg(not(target_os = "macos"))]
    {
        let path = ram_disk_path();
        if path.exists() {
            std::fs::remove_dir_all(&path).map_err(|e| format!("remove_dir_all failed: {}", e))?;
        }
        Ok(())
    }
}

/// Write a file to the RAM disk.
pub fn write_file(filename: &str, content: &[u8]) -> Result<PathBuf, String> {
    let dir = ram_disk_path();
    if !dir.exists() {
        return Err("RAM disk is not mounted".to_string());
    }
    let path = dir.join(filename);
    std::fs::write(&path, content).map_err(|e| format!("Write {} failed: {}", filename, e))?;
    Ok(path)
}

/// Write a string file to the RAM disk.
pub fn write_text(filename: &str, content: &str) -> Result<PathBuf, String> {
    write_file(filename, content.as_bytes())
}

/// Read the port file from RAM disk.
pub fn read_port() -> Option<u16> {
    let path = ram_disk_path().join("port");
    std::fs::read_to_string(&path)
        .ok()
        .and_then(|s| s.trim().parse::<u16>().ok())
}

/// Write the port file to RAM disk.
pub fn write_port(port: u16) -> Result<(), String> {
    write_text("port", &port.to_string()).map(|_| ())
}

/// Copy the windsurf_chat binary to the RAM disk.
pub fn install_binary(binary_src: &Path) -> Result<PathBuf, String> {
    let dest = ram_disk_path().join(cli_binary_name());
    std::fs::copy(binary_src, &dest)
        .map_err(|e| format!("Failed to copy binary: {}", e))?;

    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let _ = std::fs::set_permissions(&dest, std::fs::Permissions::from_mode(0o755));
    }

    Ok(dest)
}

pub fn binary_path() -> PathBuf {
    ram_disk_path().join(cli_binary_name())
}

pub fn cli_binary_name() -> &'static str {
    if cfg!(target_os = "windows") { "windsurf_chat.exe" } else { "windsurf_chat" }
}

/// Find the windsurf_chat binary shipped with this app.
/// Search order:
/// 1. Next to the main executable (covers both dev and packaged macOS bundle MacOS/ dir)
/// 2. Contents/Resources/ inside .app bundle  
/// 3. Next to exe in release target dir (fallback for direct cargo run)
pub fn find_app_binary() -> Option<PathBuf> {
    let exe = match std::env::current_exe() {
        Ok(e) => e,
        Err(_) => return None,
    };
    let exe_dir = exe.parent()?;
    let name = cli_binary_name();

    // 1. Same directory as main exe (dev build & macOS bundle Contents/MacOS/)
    let candidate1 = exe_dir.join(name);
    if candidate1.exists() { return Some(candidate1); }

    // 2. macOS .app bundle Contents/Resources/
    #[cfg(target_os = "macos")]
    {
        for ancestor in exe.ancestors() {
            if ancestor.file_name().map(|n| n == "MacOS").unwrap_or(false) {
                if let Some(contents) = ancestor.parent() {
                    let candidate = contents.join("Resources").join(name);
                    if candidate.exists() { return Some(candidate); }
                }
                break;
            }
        }
    }

    // 3. Traverse up to find target/release/ (for cargo run from workspace)
    for ancestor in exe.ancestors() {
        let candidate = ancestor.join("release").join(name);
        if candidate.exists() { return Some(candidate); }
        let candidate2 = ancestor.join(name);
        if candidate2.exists() && candidate2 != exe { return Some(candidate2); }
    }

    None
}
