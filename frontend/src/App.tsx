import { useEffect, useRef } from 'react'
import { useChatStore, type PendingPrompt } from '@/store/useChatStore'
import { isTauri } from '@/lib/tauri'
import { ChatPanel } from '@/components/ChatPanel'

export default function App() {
  const { addPending, removePending, markDisconnected, markCompleted, refreshStatus, refreshPending, refreshAutoMode, startServer } = useChatStore()
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Listen for Tauri events
  useEffect(() => {
    if (!isTauri()) return
    let unlisten: (() => void) | null = null

    import('@tauri-apps/api/event').then(({ listen }) => {
      const unlisteners: (() => void)[] = []

      listen<PendingPrompt>('chat-request', (event) => {
        addPending(event.payload)
        refreshAutoMode()
      }).then((fn) => unlisteners.push(fn))

      listen<string[]>('chat-stale-removed', (event) => {
        const staleIds = event.payload
        if (staleIds?.length > 0) {
          staleIds.forEach((id) => removePending(id))
        }
      }).then((fn) => unlisteners.push(fn))

      listen<string>('chat-request-disconnected', (event) => {
        markDisconnected(event.payload)
      }).then((fn) => unlisteners.push(fn))

      listen<string>('chat-request-completed', (event) => {
        markCompleted(event.payload)
      }).then((fn) => unlisteners.push(fn))

      unlisten = () => unlisteners.forEach((fn) => fn())
    })

    return () => { unlisten?.() }
  }, [addPending, removePending, markDisconnected, markCompleted, refreshAutoMode])

  // Initial load and polling
  useEffect(() => {
    refreshStatus().then(async () => {
      const { serverStatus } = useChatStore.getState()
      if (!serverStatus?.running) {
        await startServer()
      }
    })
    refreshAutoMode()

    pollingRef.current = setInterval(() => {
      refreshStatus()
      refreshPending()
    }, 3000)

    const autoRef = setInterval(() => {
      refreshAutoMode()
    }, 15_000)

    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current)
      clearInterval(autoRef)
    }
  }, [refreshStatus, refreshPending, refreshAutoMode, startServer])

  return (
    <div className="min-h-screen bg-background">
      <ChatPanel />
    </div>
  )
}
