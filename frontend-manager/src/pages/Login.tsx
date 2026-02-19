import { useState } from 'react'
import { setToken } from '../lib/api'
import { KeyRound } from 'lucide-react'

export default function Login({ onLogin }: { onLogin: () => void }) {
  const [t, setT] = useState('')
  const [err, setErr] = useState('')

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!t.trim()) { setErr('请输入 Token'); return }
    setToken(t.trim())
    onLogin()
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100">
      <div className="bg-white rounded-2xl shadow-lg p-10 w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 rounded-full bg-indigo-600 flex items-center justify-center mb-3">
            <KeyRound className="text-white" size={26} />
          </div>
          <h1 className="text-2xl font-bold text-slate-800">Stop 管理后台</h1>
          <p className="text-slate-400 text-sm mt-1">License 管理系统</p>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">Admin Token</label>
            <input
              type="password"
              value={t}
              onChange={(e) => setT(e.target.value)}
              placeholder="输入管理员 Token"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          {err && <p className="text-red-500 text-sm">{err}</p>}
          <button
            type="submit"
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg py-2 font-medium transition-colors"
          >
            登录
          </button>
        </form>
      </div>
    </div>
  )
}
