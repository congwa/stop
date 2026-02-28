#!/usr/bin/env node
// Cross-platform build script for windsurf_chat CLI
import { execSync } from 'child_process';
import { mkdirSync, copyFileSync, readdirSync, unlinkSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..');

// Set up cargo path for cross-platform support
const isWindows = process.platform === 'win32';
const cargoPath = isWindows ? 
  (process.env.USERPROFILE || '') + '\\.cargo\\bin' : 
  (process.env.HOME || '') + '/.cargo/bin';
const env = { ...process.env, PATH: `${process.env.PATH}${isWindows ? ';' : ':'}${cargoPath}` };

// Build the CLI for multiple targets on macOS
if (process.platform === 'darwin') {
  // Build for Intel and ARM
  execSync('cargo build --release --manifest-path windsurf_chat/Cargo.toml --target x86_64-apple-darwin', {
    cwd: projectRoot,
    stdio: 'inherit',
    env: env
  });
  execSync('cargo build --release --manifest-path windsurf_chat/Cargo.toml --target aarch64-apple-darwin', {
    cwd: projectRoot,
    stdio: 'inherit',
    env: env
  });
  
  // Create universal binary
  const universalDir = join(projectRoot, 'windsurf_chat', 'target', 'universal-apple-darwin', 'release');
  mkdirSync(universalDir, { recursive: true });
  execSync('lipo -create windsurf_chat/target/x86_64-apple-darwin/release/windsurf_chat windsurf_chat/target/aarch64-apple-darwin/release/windsurf_chat -output windsurf_chat/target/universal-apple-darwin/release/windsurf_chat', {
    cwd: projectRoot,
    stdio: 'inherit'
  });
} else {
  // Build for other platforms
  execSync('cargo build --release --manifest-path windsurf_chat/Cargo.toml', {
    cwd: projectRoot,
    stdio: 'inherit',
    env: env
  });
}

// Get target triple
const rustcOutput = execSync('rustc -Vv', { encoding: 'utf8', env: env });
const hostLine = rustcOutput.split('\n').find(line => line.startsWith('host:'));
const target = hostLine ? hostLine.split(' ')[1].trim() : 'unknown';

// For macOS, use universal-apple-darwin as target
const finalTarget = process.platform === 'darwin' ? 'universal-apple-darwin' : target;

// Create binaries directory and clean stale files
const binDir = join(projectRoot, 'src-tauri', 'binaries');
mkdirSync(binDir, { recursive: true });
for (const f of readdirSync(binDir)) {
  if (f.startsWith('windsurf_chat')) {
    unlinkSync(join(binDir, f));
  }
}

// 复制最终二进制到 src-tauri/binaries/windsurf_chat
// Tauri resources 直接打入 Contents/Resources/，find_app_binary() 在该目录查找
const srcBinary = join(projectRoot, 'windsurf_chat', 'target', finalTarget, 'release', isWindows ? 'windsurf_chat.exe' : 'windsurf_chat');
const destBinary = join(binDir, isWindows ? 'windsurf_chat.exe' : 'windsurf_chat');
copyFileSync(srcBinary, destBinary);

console.log(`Built windsurf_chat for ${finalTarget}`);
