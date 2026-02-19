import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import type { Stats } from '../lib/api'
import { Users, CheckCircle, XCircle, Clock, TrendingUp, AlertTriangle } from 'lucide-react'

function StatCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: number; color: string }) {
  return (
    <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-100 flex items-center gap-4">
      <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${color}`}>
        {icon}
      </div>
      <div>
        <p className="text-sm text-slate-500">{label}</p>
        <p className="text-2xl font-bold text-slate-800">{value}</p>
      </div>
    </div>
  )
}

export default function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')

  useEffect(() => {
    api.getStats()
      .then(setStats)
      .catch((e) => setErr(e.response?.data?.detail || '加载失败'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="p-8 text-slate-400">加载中...</div>
  if (err) return <div className="p-8 text-red-500">{err}</div>
  if (!stats) return null

  return (
    <div className="p-8">
      <h2 className="text-xl font-bold text-slate-800 mb-6">概览</h2>
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard
          icon={<Users className="text-indigo-600" size={22} />}
          label="License 总数"
          value={stats.total}
          color="bg-indigo-50"
        />
        <StatCard
          icon={<CheckCircle className="text-emerald-600" size={22} />}
          label="已激活"
          value={stats.activated}
          color="bg-emerald-50"
        />
        <StatCard
          icon={<TrendingUp className="text-blue-600" size={22} />}
          label="今日激活"
          value={stats.today_activated}
          color="bg-blue-50"
        />
        <StatCard
          icon={<XCircle className="text-red-500" size={22} />}
          label="已吊销"
          value={stats.revoked}
          color="bg-red-50"
        />
        <StatCard
          icon={<Clock className="text-orange-500" size={22} />}
          label="已过期"
          value={stats.expired}
          color="bg-orange-50"
        />
        <StatCard
          icon={<AlertTriangle className="text-yellow-500" size={22} />}
          label="30天内到期"
          value={stats.expiring_soon}
          color="bg-yellow-50"
        />
      </div>
    </div>
  )
}
