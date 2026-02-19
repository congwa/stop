import { invoke } from '@tauri-apps/api/core'

export async function tauriInvoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  try {
    return await invoke<T>(cmd, args)
  } catch (e) {
    console.warn(`[Tauri] ${cmd} failed:`, e)
    throw e
  }
}

export function isTauri(): boolean {
  return '__TAURI_INTERNALS__' in window
}
