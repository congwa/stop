# Build windsurf_chat CLI for Windows
$ErrorActionPreference = "Stop"
Set-Location (Split-Path -Parent $PSScriptRoot)
cargo build --release --manifest-path windsurf_chat/Cargo.toml
New-Item -ItemType Directory -Force -Path src-tauri/binaries | Out-Null
$target = (rustc -Vv | Select-String "host:" | ForEach-Object { $_.Line.Split(" ")[1] })
Copy-Item "windsurf_chat/target/release/windsurf_chat.exe" "src-tauri/binaries/windsurf_chat-$target.exe"
Write-Host "Built windsurf_chat for $target"
