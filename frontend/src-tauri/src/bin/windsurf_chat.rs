use std::env;
use std::fs;
use std::io::{Read, Write};
use std::net::TcpStream;
use std::path::Path;
use std::time::Duration;

fn main() {
    let args: Vec<String> = env::args().skip(1).collect();
    let mut prompt = String::new();
    let mut context = String::new();
    let mut i = 0;
    while i < args.len() {
        if args[i] == "--context" && i + 1 < args.len() {
            context = args[i + 1].clone();
            i += 2;
        } else {
            if !prompt.is_empty() { prompt.push(' '); }
            prompt.push_str(&args[i]);
            i += 1;
        }
    }
    if prompt.is_empty() { prompt = "等待用户反馈".to_string(); }

    let port = read_port();
    let response = make_request(port, &prompt, &context, 0);
    println!("{}", format_output(&response));
}

fn read_port() -> u16 {
    // Check candidates in priority order:
    // 1. RAM disk port (primary, written by Stop app)
    // 2. port file next to this executable
    let ram_disk_port = Path::new("/Volumes/StopRules/port");
    let script_dir = env::current_exe().ok().and_then(|p| p.parent().map(|d| d.join("port")));

    let port_file = if ram_disk_port.exists() {
        Some(ram_disk_port.to_path_buf())
    } else {
        script_dir.filter(|p| p.exists())
    };

    let port_file = match port_file {
        Some(p) => p,
        None => {
            eprintln!("[WindsurfChat] 错误: 端口文件不存在，请确保 Stop 应用已启动");
            eprintln!("[WindsurfChat] 已检查: /Volumes/StopRules/port");
            std::process::exit(1);
        }
    };
    let content = fs::read_to_string(&port_file).unwrap_or_else(|e| {
        eprintln!("[WindsurfChat] 读取端口文件失败: {}", e);
        std::process::exit(1);
    });
    content.trim().parse::<u16>().unwrap_or_else(|_| {
        eprintln!("[WindsurfChat] 无效的端口号: {}", content.trim());
        std::process::exit(1);
    })
}

fn make_request(port: u16, prompt: &str, context: &str, retry: u8) -> serde_json::Value {
    let workspace_path = env::current_dir().ok().map(|p| p.to_string_lossy().to_string()).unwrap_or_default();
    let payload = serde_json::json!({
        "prompt": prompt,
        "requestId": std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap_or_default().as_millis().to_string(),
        "context": context,
        "workspacePath": workspace_path,
    });
    let body = payload.to_string();
    let addr = format!("127.0.0.1:{}", port);
    let stream = match TcpStream::connect_timeout(&addr.parse().unwrap(), Duration::from_secs(5)) {
        Ok(s) => s,
        Err(e) => {
            if retry < 3 {
                eprintln!("[WindsurfChat] 连接失败，重试 ({}/3)...", retry + 1);
                std::thread::sleep(Duration::from_secs(2));
                return make_request(port, prompt, context, retry + 1);
            }
            return serde_json::json!({"action":"error","error":format!("连接失败: {}",e),"text":"","images":[]});
        }
    };
    let _ = stream.set_read_timeout(None);
    let _ = stream.set_write_timeout(Some(Duration::from_secs(10)));
    let mut stream = stream;
    let request = format!(
        "POST /request HTTP/1.1\r\nHost: 127.0.0.1:{}\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
        port, body.len(), body
    );
    if let Err(e) = stream.write_all(request.as_bytes()) {
        return serde_json::json!({"action":"error","error":format!("发送失败: {}",e),"text":"","images":[]});
    }
    let _ = stream.flush();
    let mut buf = Vec::new();
    if let Err(e) = stream.read_to_end(&mut buf) {
        return serde_json::json!({"action":"error","error":format!("读取失败: {}",e),"text":"","images":[]});
    }
    let s = String::from_utf8_lossy(&buf);
    let start = s.find("\r\n\r\n").map(|i| i + 4).unwrap_or(0);
    serde_json::from_str(&s[start..]).unwrap_or_else(|_| {
        serde_json::json!({"action":"error","error":"JSON解析失败","text":"","images":[]})
    })
}

fn format_output(response: &serde_json::Value) -> String {
    let action = response.get("action").and_then(|v| v.as_str()).unwrap_or("");
    let text = response.get("text").and_then(|v| v.as_str()).unwrap_or("");
    let error = response.get("error").and_then(|v| v.as_str()).unwrap_or("");
    let images = response.get("images").and_then(|v| v.as_array()).cloned().unwrap_or_default();
    match action {
        "timeout_continue" => "请继续等待用户回复\n\n重要提醒：遵循工作区规则，每次回复结束前必须调用脚本！".to_string(),
        "error" => format!("[WindsurfChat 错误] {}\n\n请检查 Stop 应用状态。\n\n重要：请立即结束当前对话。", if error.is_empty() { "未知错误" } else { error }),
        "end" => "User chose to end".to_string(),
        "continue" if text.is_empty() && images.is_empty() => "继续。并且遵循工作区规则，每次回复结束前必须调用脚本！".to_string(),
        "instruction" | "continue" => {
            let mut out = String::new();
            if !text.is_empty() { out.push_str(&format!("User instruction: {}", text)); }
            if !images.is_empty() {
                out.push_str(&format!("\n\n用户提供了 {} 张图片，请使用 read_file 工具读取以下图片文件：\n", images.len()));
                for img in &images {
                    if let Some(s) = img.as_str() { out.push_str(&format!("- {}\n", s)); }
                }
            }
            out.push_str("\n\n重要提醒：遵循工作区规则，每次回复结束前必须调用脚本！");
            out
        }
        _ => format!("[WindsurfChat 未知响应] action={}\n\n重要：请立即结束当前对话。", action),
    }
}
