import { useEffect, useRef, ReactNode } from 'react'
import { useLicenseStore } from '../store/useLicenseStore'
import { useChatStore } from '../store/useChatStore'
import ActivationPage from './ActivationPage'
import { Loader2, WifiOff } from 'lucide-react'

const HEARTBEAT_INTERVAL_MS = 30 * 60 * 1000 // 30 分钟

export default function LicenseGate({ children }: { children: ReactNode }) {
  const { status, loading, error, verifyLicense, logoutLicense } = useLicenseStore()
  const { initRamDisk, installGlobalRules, removeInjection } = useChatStore()
  const injectedRef = useRef(false)

  useEffect(() => {
    verifyLicense()
  }, [verifyLicense])

  // 根据 License 状态控制注入：有效则线性执行 initRamDisk → installGlobalRules，无效则清除
  useEffect(() => {
    if (status === null) return
    if (!status.valid) {
      if (injectedRef.current) {
        injectedRef.current = false
        removeInjection()
      }
      return
    }
    if (injectedRef.current) return
    injectedRef.current = true
    initRamDisk()
      .then(() => installGlobalRules())
      .catch(() => { injectedRef.current = false })
  }, [status?.valid, initRamDisk, installGlobalRules, removeInjection])

  // 心跳：定期重新验证，过期或失效立即删除注入并退出
  useEffect(() => {
    const timer = setInterval(async () => {
      await verifyLicense()
      const s = useLicenseStore.getState().status
      if (!s?.valid) {
        injectedRef.current = false
        await removeInjection()
        logoutLicense()
      }
    }, HEARTBEAT_INTERVAL_MS)
    return () => clearInterval(timer)
  }, [verifyLicense, logoutLicense, removeInjection])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="flex flex-col items-center gap-3 text-slate-400 dark:text-slate-500">
          <Loader2 size={32} className="animate-spin" />
          <p className="text-sm">正在验证授权...</p>
        </div>
      </div>
    )
  }

  // Network error (not invalid key - just can't reach server)
  if (error && !status) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="flex flex-col items-center gap-4 max-w-sm text-center px-6">
          <WifiOff size={40} className="text-slate-300 dark:text-slate-600" />
          <p className="text-lg font-semibold text-slate-700 dark:text-slate-200">无法连接授权服务器</p>
          <p className="text-slate-400 dark:text-slate-500 text-sm">{error}</p>
          <button
            onClick={verifyLicense}
            className="mt-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 text-white dark:text-slate-50 rounded-xl text-sm font-medium transition-colors"
          >
            重试
          </button>
        </div>
      </div>
    )
  }

  if (!status?.valid) {
    return <ActivationPage />
  }

  return <>{children}</>
}
