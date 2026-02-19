use std::fs;
use std::path::PathBuf;
use serde::{Deserialize, Serialize};

const SERVER_BASE: &str = if cfg!(dev) {
    "http://localhost:17771"
} else {
    "http://windsurf-stop.biomed168.com"
};
const CACHE_FILE: &str = ".stop_license";

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct LicenseCache {
    pub key: String,
    pub machine_id: String,
    pub expiry_date: Option<String>,
    pub last_verified_at: u64,
}

#[derive(Debug, Serialize, Deserialize)]
struct ActivateRequest {
    key: String,
    machine_id: String,
}

#[derive(Debug, Serialize, Deserialize)]
struct ActivateResponse {
    valid: bool,
    expiry_date: Option<String>,
    server_time: String,
    message: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct LicenseStatus {
    pub valid: bool,
    pub expiry_date: Option<String>,
    pub message: String,
    pub is_cached: bool,
}

fn cache_path() -> PathBuf {
    dirs::home_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join(CACHE_FILE)
}

fn load_cache() -> Option<LicenseCache> {
    let path = cache_path();
    let data = fs::read_to_string(&path).ok()?;
    serde_json::from_str(&data).ok()
}

fn save_cache(cache: &LicenseCache) -> Result<(), String> {
    let path = cache_path();
    let data = serde_json::to_string(cache).map_err(|e| e.to_string())?;
    fs::write(&path, data).map_err(|e| e.to_string())
}

fn clear_cache() {
    let _ = fs::remove_file(cache_path());
}

pub fn get_machine_id() -> String {
    #[cfg(target_os = "macos")]
    {
        let output = std::process::Command::new("ioreg")
            .args(["-rd1", "-c", "IOPlatformExpertDevice"])
            .output();
        if let Ok(out) = output {
            let s = String::from_utf8_lossy(&out.stdout);
            let serial = extract_ioreg_field(&s, "IOPlatformSerialNumber");
            let uuid = extract_ioreg_field(&s, "IOPlatformUUID");
            let combined = format!("{}{}", serial.unwrap_or_default(), uuid.unwrap_or_default());
            if !combined.is_empty() {
                return sha256_short(&combined);
            }
        }
    }
    // fallback: hostname
    let hostname = std::process::Command::new("hostname")
        .output()
        .map(|o| String::from_utf8_lossy(&o.stdout).trim().to_string())
        .unwrap_or_default();
    sha256_short(&format!("fallback-{}", hostname))
}

#[cfg(target_os = "macos")]
fn extract_ioreg_field(output: &str, field: &str) -> Option<String> {
    for line in output.lines() {
        if line.contains(field) {
            let parts: Vec<&str> = line.splitn(2, '=').collect();
            if parts.len() == 2 {
                let val = parts[1].trim().trim_matches('"').trim().to_string();
                if !val.is_empty() {
                    return Some(val);
                }
            }
        }
    }
    None
}

fn sha256_short(input: &str) -> String {
    use std::collections::hash_map::DefaultHasher;
    use std::hash::{Hash, Hasher};
    let mut hasher = DefaultHasher::new();
    input.hash(&mut hasher);
    let h1 = hasher.finish();
    input.chars().rev().collect::<String>().hash(&mut hasher);
    let h2 = hasher.finish();
    format!("{:016x}{:016x}", h1, h2)
}

fn server_url() -> String {
    std::env::var("STOP_LICENSE_SERVER").unwrap_or_else(|_| SERVER_BASE.to_string())
}

pub fn activate_license(key: &str) -> Result<LicenseStatus, String> {
    let machine_id = get_machine_id();
    let url = format!("{}/api/activate", server_url());

    let client = reqwest::blocking::Client::builder()
        .timeout(std::time::Duration::from_secs(10))
        .build()
        .map_err(|e| e.to_string())?;

    let body = ActivateRequest {
        key: key.to_string(),
        machine_id: machine_id.clone(),
    };

    let resp = client
        .post(&url)
        .json(&body)
        .send()
        .map_err(|e| format!("无法连接授权服务器，请检查网络: {}", e))?;

    let status_code = resp.status();
    if !status_code.is_success() {
        let err_body: serde_json::Value = resp.json().unwrap_or_default();
        let detail = err_body
            .get("detail")
            .and_then(|v| v.as_str())
            .unwrap_or("激活失败")
            .to_string();
        return Err(detail);
    }

    let data: ActivateResponse = resp.json().map_err(|e| e.to_string())?;

    let cache = LicenseCache {
        key: key.to_string(),
        machine_id,
        expiry_date: data.expiry_date.clone(),
        last_verified_at: unix_now(),
    };
    save_cache(&cache)?;

    Ok(LicenseStatus {
        valid: true,
        expiry_date: data.expiry_date,
        message: data.message,
        is_cached: false,
    })
}

pub fn verify_license() -> Result<LicenseStatus, String> {
    let cache = match load_cache() {
        Some(c) => c,
        None => {
            return Ok(LicenseStatus {
                valid: false,
                expiry_date: None,
                message: "未激活".to_string(),
                is_cached: false,
            })
        }
    };

    let url = format!("{}/api/verify", server_url());

    let client = reqwest::blocking::Client::builder()
        .timeout(std::time::Duration::from_secs(10))
        .build()
        .map_err(|e| e.to_string())?;

    let body = ActivateRequest {
        key: cache.key.clone(),
        machine_id: cache.machine_id.clone(),
    };

    let resp = client
        .post(&url)
        .json(&body)
        .send()
        .map_err(|_| "无法连接授权服务器，请检查网络连接后重试".to_string())?;

    let status_code = resp.status();
    if !status_code.is_success() {
        clear_cache();
        let err_body: serde_json::Value = resp.json().unwrap_or_default();
        let detail = err_body
            .get("detail")
            .and_then(|v| v.as_str())
            .unwrap_or("验证失败")
            .to_string();
        return Ok(LicenseStatus {
            valid: false,
            expiry_date: None,
            message: detail,
            is_cached: false,
        });
    }

    let data: ActivateResponse = resp.json().map_err(|e| e.to_string())?;

    let updated = LicenseCache {
        expiry_date: data.expiry_date.clone(),
        last_verified_at: unix_now(),
        ..cache
    };
    let _ = save_cache(&updated);

    Ok(LicenseStatus {
        valid: true,
        expiry_date: data.expiry_date,
        message: data.message,
        is_cached: false,
    })
}

fn unix_now() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs()
}
