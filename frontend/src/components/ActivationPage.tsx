import { useState, useEffect } from 'react'
import { useLicenseStore } from '../store/useLicenseStore'
import { KeyRound, Loader2, AlertCircle, CheckCircle } from 'lucide-react'

export default function ActivationPage() {
  const { machineId, activating, error, loadMachineId, activateLicense } = useLicenseStore()
  const [key, setKey] = useState('')
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    loadMachineId()
  }, [loadMachineId])

  function formatKey(raw: string) {
    const clean = raw.toUpperCase().replace(/[^A-Z0-9]/g, '')
    const parts = clean.match(/.{1,4}/g) || []
    return parts.slice(0, 4).join('-')
  }

  function handleKeyInput(e: React.ChangeEvent<HTMLInputElement>) {
    const formatted = formatKey(e.target.value)
    setKey(formatted)
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const cleaned = key.replace(/-/g, '')
    if (cleaned.length < 16) return
    await activateLicense(`STOP-${key}`.replace('STOP-STOP-', 'STOP-'))
    if (!useLicenseStore.getState().error) setSuccess(true)
  }

  const isReady = key.replace(/-/g, '').length === 16

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <CheckCircle className="text-emerald-500" size={48} />
          <p className="text-xl font-semibold text-slate-800">激活成功</p>
          <p className="text-slate-400 text-sm">正在进入应用...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="bg-white rounded-2xl shadow-lg p-10 w-full max-w-md border border-slate-100">
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-indigo-600 flex items-center justify-center mb-4">
            <KeyRound className="text-white" size={28} />
          </div>
          <h1 className="text-2xl font-bold text-slate-800">激活 Stop</h1>
          <p className="text-slate-400 text-sm mt-1.5 text-center">
            请输入 License Key 以激活应用
          </p>
        </div>

        <form onSubmit={submit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1.5">License Key</label>
            <input
              type="text"
              value={key}
              onChange={handleKeyInput}
              placeholder="XXXX-XXXX-XXXX-XXXX"
              maxLength={19}
              autoFocus
              className="w-full border border-slate-200 rounded-xl px-4 py-3 text-center font-mono text-lg tracking-widest focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
            <p className="text-xs text-slate-400 mt-1.5">
              完整格式: STOP-XXXX-XXXX-XXXX-XXXX
            </p>
          </div>

          {error && (
            <div className="flex items-start gap-2.5 bg-red-50 text-red-600 rounded-xl px-4 py-3 text-sm">
              <AlertCircle size={16} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={!isReady || activating}
            className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl py-3 font-semibold text-sm transition-colors flex items-center justify-center gap-2"
          >
            {activating && <Loader2 size={16} className="animate-spin" />}
            {activating ? '激活中...' : '激活'}
          </button>
        </form>

        {machineId && (
          <div className="mt-6 pt-5 border-t border-slate-100">
            <p className="text-xs text-slate-400 text-center">
              机器码（激活绑定此设备）
            </p>
            <p className="text-xs font-mono text-slate-500 text-center mt-1 break-all">{machineId}</p>
          </div>
        )}
      </div>
    </div>
  )
}
