import { create } from 'zustand'
import { tauriInvoke, isTauri } from '@/lib/tauri'

// ============================================================
// Types
// ============================================================

export type ConnectionState = 'connected' | 'disconnected' | 'response_queued' | 'completed'

export interface PendingPrompt {
  request_id: string
  prompt: string
  context: string | null
  timestamp: number
  workspace_path: string | null
  project_name: string | null
  connection_state: ConnectionState
}

export interface ServerStatus {
  running: boolean
  port: number
  pending_count: number
}

export interface AutoModeInfo {
  auto_execution_policy: string
  auto_continue_enabled: boolean
}

export interface RamDiskStatus {
  mounted: boolean
  binary_installed: boolean
  global_rules_installed: boolean
  launch_agent_installed: boolean
  path: string
}

// ============================================================
// Store
// ============================================================

interface ChatStoreState {
  serverStatus: ServerStatus | null
  isStarting: boolean
  error: string | null

  pendingPrompts: PendingPrompt[]
  respondedIds: Map<string, number>

  autoModeInfo: AutoModeInfo | null
  ramDiskStatus: RamDiskStatus | null
  ramDiskInitializing: boolean

  initRamDisk: () => Promise<void>
  refreshRamDiskStatus: () => Promise<void>
  cleanupRamDisk: () => Promise<void>
  installGlobalRules: () => Promise<void>
  removeInjection: () => Promise<void>

  startServer: () => Promise<void>
  stopServer: () => Promise<void>
  refreshStatus: () => Promise<void>
  refreshPending: () => Promise<void>
  refreshAutoMode: () => Promise<void>

  submitResponse: (requestId: string, text: string, images?: string[]) => Promise<void>
  continueChat: (requestId: string) => Promise<void>
  endChat: (requestId: string) => Promise<void>

  saveFeedbackImage: (base64Data: string, filename: string) => Promise<string>
  setupWorkspace: (path: string) => Promise<void>

  addPending: (prompt: PendingPrompt) => void
  removePending: (requestId: string) => void
  markDisconnected: (requestId: string) => void
  markCompleted: (requestId: string) => void
  dismissRequest: (requestId: string) => Promise<void>
}

const RESPONDED_TTL_MS = 30_000

export const useChatStore = create<ChatStoreState>((set, get) => ({
  serverStatus: null,
  isStarting: false,
  error: null,
  pendingPrompts: [],
  respondedIds: new Map(),
  autoModeInfo: null,
  ramDiskStatus: null,
  ramDiskInitializing: false,

  startServer: async () => {
    if (!isTauri()) return
    set({ isStarting: true, error: null })
    try {
      const port = await tauriInvoke<number>('start_chat_server')
      set({ serverStatus: { running: true, port, pending_count: 0 }, isStarting: false })
    } catch (e) {
      set({ error: String(e), isStarting: false })
    }
  },

  stopServer: async () => {
    if (!isTauri()) return
    try {
      await tauriInvoke('stop_chat_server')
      set({ serverStatus: { running: false, port: 0, pending_count: 0 }, pendingPrompts: [], respondedIds: new Map() })
    } catch (e) {
      set({ error: String(e) })
    }
  },

  refreshStatus: async () => {
    if (!isTauri()) return
    try {
      const status = await tauriInvoke<ServerStatus>('get_chat_server_status')
      const prev = get().serverStatus
      if (prev && prev.running === status.running && prev.port === status.port && prev.pending_count === status.pending_count) return
      set({ serverStatus: status })
    } catch {
      // ignore
    }
  },

  refreshPending: async () => {
    if (!isTauri()) return
    try {
      const prompts = await tauriInvoke<PendingPrompt[]>('get_pending_prompts')
      set((s) => {
        const serverIds = new Set(prompts.map((p) => p.request_id))
        const existing = new Map(s.pendingPrompts.map((p) => [p.request_id, p]))
        const now = Date.now()

        const merged = prompts.map((p) => {
          const prev = existing.get(p.request_id)
          return prev ? { ...p, timestamp: prev.timestamp || p.timestamp } : p
        })

        const newRespondedIds = new Map(s.respondedIds)
        for (const [reqId, respondedAt] of s.respondedIds) {
          if (serverIds.has(reqId)) continue
          const ttlExpired = now - respondedAt > RESPONDED_TTL_MS
          if (ttlExpired) {
            newRespondedIds.delete(reqId)
          } else {
            const stalePrompt = existing.get(reqId)
            if (stalePrompt) {
              merged.push(stalePrompt)
            } else {
              newRespondedIds.delete(reqId)
            }
          }
        }

        return { pendingPrompts: merged, respondedIds: newRespondedIds }
      })
    } catch {
      // ignore
    }
  },

  initRamDisk: async () => {
    if (!isTauri()) return
    set({ ramDiskInitializing: true })
    try {
      const status = await tauriInvoke<RamDiskStatus>('init_ram_disk')
      set({ ramDiskStatus: status, ramDiskInitializing: false })
    } catch (e) {
      set({ error: String(e), ramDiskInitializing: false })
    }
  },

  refreshRamDiskStatus: async () => {
    if (!isTauri()) return
    try {
      const status = await tauriInvoke<RamDiskStatus>('get_ram_disk_status')
      set({ ramDiskStatus: status })
    } catch {
      // ignore
    }
  },

  cleanupRamDisk: async () => {
    if (!isTauri()) return
    try {
      await tauriInvoke('cleanup_ram_disk')
      set({ ramDiskStatus: null })
    } catch (e) {
      set({ error: String(e) })
    }
  },

  installGlobalRules: async () => {
    if (!isTauri()) return
    try {
      await tauriInvoke('install_global_rules')
    } catch (e) {
      set({ error: String(e) })
    }
  },

  removeInjection: async () => {
    if (!isTauri()) return
    try {
      await tauriInvoke('remove_injection')
    } catch {
      // ignore — may fail if already removed
    }
  },

  refreshAutoMode: async () => {
    if (!isTauri()) return
    try {
      const info = await tauriInvoke<AutoModeInfo>('get_auto_mode_info')
      set({ autoModeInfo: info })
    } catch {
      // ignore — may fail if Windsurf not running
    }
  },

  submitResponse: async (requestId: string, text: string, images?: string[]) => {
    if (!isTauri()) return
    try {
      await tauriInvoke('send_chat_response', {
        requestId,
        action: 'instruction',
        text,
        images: images && images.length > 0 ? images : null,
      })
      set((s) => {
        const next = new Map(s.respondedIds)
        next.set(requestId, Date.now())
        return { respondedIds: next }
      })
      tauriInvoke('focus_windsurf').catch(() => {})
    } catch (e) {
      set({ error: String(e) })
    }
  },

  continueChat: async (requestId: string) => {
    if (!isTauri()) return
    try {
      await tauriInvoke('send_chat_response', { requestId, action: 'continue', text: '' })
      set((s) => {
        const next = new Map(s.respondedIds)
        next.set(requestId, Date.now())
        return { respondedIds: next }
      })
      tauriInvoke('focus_windsurf').catch(() => {})
    } catch (e) {
      set({ error: String(e) })
    }
  },

  endChat: async (requestId: string) => {
    if (!isTauri()) return
    try {
      await tauriInvoke('send_chat_response', { requestId, action: 'end', text: '' })
      get().removePending(requestId)
      tauriInvoke('focus_windsurf').catch(() => {})
    } catch (e) {
      set({ error: String(e) })
    }
  },

  saveFeedbackImage: async (base64Data: string, filename: string) => {
    if (!isTauri()) return ''
    return tauriInvoke<string>('save_feedback_image', { imageData: base64Data, filename })
  },

  setupWorkspace: async (path: string) => {
    if (!isTauri()) return
    await tauriInvoke('setup_chat_workspace', { workspacePath: path })
  },

  addPending: (prompt: PendingPrompt) => {
    set((s) => {
      if (s.pendingPrompts.some((p) => p.request_id === prompt.request_id)) return s
      return { pendingPrompts: [prompt, ...s.pendingPrompts] }
    })
  },

  removePending: (requestId: string) => {
    set((s) => {
      const next = new Map(s.respondedIds)
      next.delete(requestId)
      return {
        pendingPrompts: s.pendingPrompts.filter((p) => p.request_id !== requestId),
        respondedIds: next,
      }
    })
  },

  markDisconnected: (requestId: string) => {
    set((s) => {
      const idx = s.pendingPrompts.findIndex((p) => p.request_id === requestId)
      if (idx < 0) return s
      const updated = [...s.pendingPrompts]
      updated[idx] = { ...updated[idx], connection_state: 'disconnected' }
      return { pendingPrompts: updated }
    })
  },

  markCompleted: (requestId: string) => {
    set((s) => {
      const idx = s.pendingPrompts.findIndex((p) => p.request_id === requestId)
      if (idx < 0) return s
      const updated = [...s.pendingPrompts]
      updated[idx] = { ...updated[idx], connection_state: 'completed' }
      return { pendingPrompts: updated }
    })
  },

  dismissRequest: async (requestId: string) => {
    if (!isTauri()) return
    try {
      await tauriInvoke('dismiss_chat_request', { requestId })
    } catch (e) {
      console.warn('[ChatStore] dismiss failed:', e)
    }
    get().removePending(requestId)
  },
}))
