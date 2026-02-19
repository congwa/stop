use std::process::Command;

#[derive(Debug, Clone, serde::Serialize)]
pub struct LanguageServerInfo {
    pub port: u16,
    pub csrf_token: String,
    pub pid: u32,
}

pub fn discover_language_server() -> Result<LanguageServerInfo, String> {
    let output = Command::new("pgrep")
        .args(["-f", "language_server_macos"])
        .output()
        .map_err(|e| format!("pgrep failed: {}", e))?;

    let pids_str = String::from_utf8_lossy(&output.stdout);
    let pids: Vec<&str> = pids_str.lines().collect();

    if pids.is_empty() {
        return Err("Windsurf language server is not running.".to_string());
    }

    for pid_str in &pids {
        let pid_str = pid_str.trim();
        if pid_str.is_empty() {
            continue;
        }

        let ps_output = Command::new("ps")
            .args(["-eww", "-p", pid_str, "-o", "args="])
            .output()
            .map_err(|e| format!("ps failed: {}", e))?;

        let args = String::from_utf8_lossy(&ps_output.stdout).to_string();

        if !args.contains("--run_child") {
            continue;
        }

        let csrf = extract_arg(&args, "--csrf_token");
        if csrf.is_none() {
            continue;
        }
        let csrf_token = csrf.unwrap();
        let pid: u32 = pid_str.parse().unwrap_or(0);

        if let Some(port_str) = extract_arg(&args, "--server_port") {
            if let Ok(port) = port_str.parse::<u16>() {
                return Ok(LanguageServerInfo { port, csrf_token, pid });
            }
        }

        // Try lsof fallback
        let lsof = Command::new("lsof")
            .args(["-p", pid_str, "-a", "-i", "TCP", "-sTCP:LISTEN"])
            .output();

        if let Ok(lsof_out) = lsof {
            let lsof_str = String::from_utf8_lossy(&lsof_out.stdout);
            for line in lsof_str.lines() {
                if let Some(port) = parse_listen_port(line) {
                    return Ok(LanguageServerInfo { port, csrf_token, pid });
                }
            }
        }
    }

    Err("Could not find language server port".to_string())
}

fn extract_arg(args: &str, key: &str) -> Option<String> {
    let prefix = format!("{}=", key);
    if let Some(pos) = args.find(&prefix) {
        let rest = &args[pos + prefix.len()..];
        let end = rest.find(|c: char| c == ' ' || c == '\n').unwrap_or(rest.len());
        return Some(rest[..end].to_string());
    }
    let spaced = format!("{} ", key);
    if let Some(pos) = args.find(&spaced) {
        let rest = &args[pos + spaced.len()..];
        let end = rest.find(|c: char| c == ' ' || c == '\n').unwrap_or(rest.len());
        return Some(rest[..end].to_string());
    }
    None
}

fn parse_listen_port(line: &str) -> Option<u16> {
    if let Some(pos) = line.rfind(':') {
        let port_str = &line[pos + 1..];
        let port_str = port_str.split_whitespace().next()?;
        return port_str.parse::<u16>().ok();
    }
    None
}

/// Get auto execution policy from Windsurf language server
pub fn get_auto_mode(info: &LanguageServerInfo) -> Result<(String, bool), String> {
    let url = format!(
        "http://127.0.0.1:{}/exa.language_server_pb.LanguageServerService/GetUserSettings",
        info.port
    );

    let client = reqwest::blocking::Client::builder()
        .timeout(std::time::Duration::from_secs(5))
        .build()
        .map_err(|e| format!("HTTP client error: {}", e))?;

    let resp = client
        .post(&url)
        .header("Content-Type", "application/json")
        .header("x-codeium-csrf-token", &info.csrf_token)
        .body("{}")
        .send()
        .map_err(|e| format!("GetUserSettings failed: {}", e))?;

    let raw_text = resp.text().map_err(|e| format!("Read body failed: {}", e))?;
    let body: serde_json::Value = serde_json::from_str(&raw_text)
        .map_err(|e| format!("JSON parse failed: {}", e))?;

    let settings = body.get("userSettings").ok_or("Missing userSettings")?;

    let auto_policy = settings
        .get("cascadeAutoExecutionPolicy")
        .and_then(|v| v.as_str())
        .unwrap_or("UNKNOWN")
        .to_string();

    let auto_continue = settings
        .get("autoContinueOnMaxGeneratorInvocations")
        .and_then(|v| v.as_str())
        .map(|v| v.contains("ENABLED"))
        .unwrap_or(false);

    Ok((auto_policy, auto_continue))
}
