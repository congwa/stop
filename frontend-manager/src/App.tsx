import { useState } from 'react'
import { getToken } from './lib/api'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import KeyList from './pages/KeyList'
import GenerateKeys from './pages/GenerateKeys'
import { LayoutDashboard, Key, Plus, LogOut } from 'lucide-react'

type Page = 'dashboard' | 'keys' | 'generate'

const NAV = [
  { id: 'dashboard' as Page, label: '概览', icon: LayoutDashboard },
  { id: 'keys' as Page, label: 'Key 列表', icon: Key },
  { id: 'generate' as Page, label: '生成 Key', icon: Plus },
]

function App() {
  const [authed, setAuthed] = useState(!!getToken())
  const [page, setPage] = useState<Page>('dashboard')

  function logout() {
    localStorage.removeItem('admin_token')
    setAuthed(false)
  }

  if (!authed) return <Login onLogin={() => setAuthed(true)} />

  return (
    <div className="flex h-screen bg-slate-100">
      <aside className="w-56 bg-white border-r border-slate-100 flex flex-col">
        <div className="px-5 py-5 border-b border-slate-100">
          <h1 className="font-bold text-lg text-slate-800">Stop Admin</h1>
          <p className="text-xs text-slate-400 mt-0.5">License 管理系统</p>
        </div>
        <nav className="flex-1 py-4 px-3 space-y-1">
          {NAV.map(n => {
            const Icon = n.icon
            return (
              <button
                key={n.id}
                onClick={() => setPage(n.id)}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  page === n.id
                    ? 'bg-indigo-50 text-indigo-700'
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                <Icon size={17} />
                {n.label}
              </button>
            )
          })}
        </nav>
        <div className="px-3 py-4 border-t border-slate-100">
          <button
            onClick={logout}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-slate-500 hover:bg-red-50 hover:text-red-600 transition-colors"
          >
            <LogOut size={16} />
            退出登录
          </button>
        </div>
      </aside>
      <main className="flex-1 overflow-y-auto">
        {page === 'dashboard' && <Dashboard />}
        {page === 'keys' && <KeyList />}
        {page === 'generate' && <GenerateKeys />}
      </main>
    </div>
  )
}

export default App
