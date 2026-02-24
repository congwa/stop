#!/usr/bin/env node
// Cross-platform build script for windsurf_chat CLI
import { execSync } from 'child_process';
import { mkdirSync, copyFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..');

// Build the CLI
console.log('Building windsurf_chat...');
execSync('cargo build --release --manifest-path windsurf_chat/Cargo.toml', {
  cwd: projectRoot,
  stdio: 'inherit'
});

// Get target triple
const rustcOutput = execSync('rustc -Vv', { encoding: 'utf8' });
const hostLine = rustcOutput.split('\n').find(line => line.startsWith('host:'));
const target = hostLine ? hostLine.split(' ')[1].trim() : 'unknown';

// Create binaries directory
const binDir = join(projectRoot, 'src-tauri', 'binaries');
mkdirSync(binDir, { recursive: true });

// Copy binary
const isWindows = process.platform === 'win32';
const srcBinary = join(projectRoot, 'windsurf_chat', 'target', 'release', isWindows ? 'windsurf_chat.exe' : 'windsurf_chat');
const destBinary = join(binDir, isWindows ? `windsurf_chat-${target}.exe` : `windsurf_chat-${target}`);

copyFileSync(srcBinary, destBinary);
console.log(`Built windsurf_chat for ${target}`);
