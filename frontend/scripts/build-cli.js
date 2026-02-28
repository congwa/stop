#!/usr/bin/env node
// Cross-platform build script for windsurf_chat CLI
import { execSync } from 'child_process';
import { mkdirSync, copyFileSync } from 'fs';
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

// Create binaries directory
const binDir = join(projectRoot, 'src-tauri', 'binaries');
mkdirSync(binDir, { recursive: true });

// Tauri externalBin 命名规则：binaries/{name}-{target-triple}
// 需要为每种打包目标都提供对应名称的文件
if (process.platform === 'darwin') {
  const universalSrc = join(projectRoot, 'windsurf_chat', 'target', 'universal-apple-darwin', 'release', 'windsurf_chat');
  const arm64Src    = join(projectRoot, 'windsurf_chat', 'target', 'aarch64-apple-darwin',   'release', 'windsurf_chat');
  const x8664Src    = join(projectRoot, 'windsurf_chat', 'target', 'x86_64-apple-darwin',    'release', 'windsurf_chat');

  // universal build (tauri:build)
  copyFileSync(universalSrc, join(binDir, 'windsurf_chat-universal-apple-darwin'));
  // arm-only build (tauri:build:arm)
  copyFileSync(arm64Src,    join(binDir, 'windsurf_chat-aarch64-apple-darwin'));
  // intel-only build (tauri:build:intel)
  copyFileSync(x8664Src,    join(binDir, 'windsurf_chat-x86_64-apple-darwin'));

  console.log('Built windsurf_chat → universal / aarch64 / x86_64');
} else if (isWindows) {
  const src = join(projectRoot, 'windsurf_chat', 'target', 'release', 'windsurf_chat.exe');
  const hostTarget = finalTarget;
  copyFileSync(src, join(binDir, `windsurf_chat-${hostTarget}.exe`));
  console.log(`Built windsurf_chat for ${hostTarget}`);
} else {
  const src = join(projectRoot, 'windsurf_chat', 'target', 'release', 'windsurf_chat');
  copyFileSync(src, join(binDir, `windsurf_chat-${finalTarget}`));
  console.log(`Built windsurf_chat for ${finalTarget}`);
}
