import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import type { KeyItem } from '../lib/api'
import { Trash2, Ban, ChevronLeft, ChevronRight } from 'lucide-react'

const STATUS_LABELS: Record<string, { label: string; className: string }> = {
  activated: { label: '已激活', className: 'bg-emerald-100 text-emerald-700' },
  unactivated: { label: '未激活', className: 'bg-slate-100 text-slate-600' },
  revoked: { label: '已吊销', className: 'bg-red-100 text-red-600' },
  expired: { label: '已过期', className: 'bg-orange-100 text-orange-600' },
}

const STATUS_OPTIONS = [
  { value: '', label: '全部' },
  { value: 'unactivated', label: '未激活' },
  { value: 'activated', label: '已激活' },
  { value: 'revoked', label: '已吊销' },
  { value: 'expired', label: '已过期' },
]

export default function KeyList() {
  const [items, setItems] = useState<KeyItem[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const pageSize = 20

  function load(p = page, s = statusFilter) {
    setLoading(true)
    api.listKeys({ page: p, page_size: pageSize, status: s || undefined })
      .then(r => { setItems(r.items); setTotal(r.total) })
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  function changeStatus(s: string) {
    setStatusFilter(s)
    setPage(1)
    load(1, s)
  }

  function changePage(p: number) {
    setPage(p)
    load(p)
  }

  async function revoke(id: number) {
    if (!confirm('确认吊销该 Key？')) return
    await api.revokeKey(id)
    load()
  }

  async function del(id: number) {
    if (!confirm('确认删除该 Key？')) return
    await api.deleteKey(id)
    load()
  }

  const totalPages = Math.ceil(total / pageSize)

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-slate-800">Key 列表</h2>
        <p className="text-sm text-slate-400">共 {total} 条</p>
      </div>

      <div className="flex gap-2 mb-4 flex-wrap">
        {STATUS_OPTIONS.map(o => (
          <button
            key={o.value}
            onClick={() => changeStatus(o.value)}
            className={`px-3 py-1 rounded-full text-sm border transition-colors ${
              statusFilter === o.value
                ? 'bg-indigo-600 text-white border-indigo-600'
                : 'border-slate-200 text-slate-600 hover:border-indigo-400'
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-400">加载中...</div>
        ) : items.length === 0 ? (
          <div className="p-8 text-center text-slate-400">暂无数据</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-xs">
              <tr>
                <th className="px-4 py-3 text-left font-medium">ID</th>
                <th className="px-4 py-3 text-left font-medium">Key Hash</th>
                <th className="px-4 py-3 text-left font-medium">类型</th>
                <th className="px-4 py-3 text-left font-medium">到期日</th>
                <th className="px-4 py-3 text-left font-medium">激活时间</th>
                <th className="px-4 py-3 text-left font-medium">机器码</th>
                <th className="px-4 py-3 text-left font-medium">状态</th>
                <th className="px-4 py-3 text-left font-medium">备注</th>
                <th className="px-4 py-3 text-left font-medium">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {items.map(item => {
                const s = STATUS_LABELS[item.status] || STATUS_LABELS.unactivated
                return (
                  <tr key={item.id} className="hover:bg-slate-50/50">
                    <td className="px-4 py-3 text-slate-500">{item.id}</td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-600">{item.key_hash}</td>
                    <td className="px-4 py-3 text-slate-600">{item.key_type}</td>
                    <td className="px-4 py-3 text-slate-600">{item.expiry_date}</td>
                    <td className="px-4 py-3 text-slate-500 text-xs">{item.activated_at ? item.activated_at.slice(0, 16) : '—'}</td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-500 max-w-24 truncate">{item.machine_id || '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${s.className}`}>{s.label}</span>
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-xs">{item.note || '—'}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {!item.is_revoked && (
                          <button onClick={() => revoke(item.id)} title="吊销" className="text-orange-400 hover:text-orange-600 transition-colors">
                            <Ban size={15} />
                          </button>
                        )}
                        <button onClick={() => del(item.id)} title="删除" className="text-red-400 hover:text-red-600 transition-colors">
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-4">
          <button
            onClick={() => changePage(page - 1)}
            disabled={page <= 1}
            className="p-1.5 rounded-lg border border-slate-200 disabled:opacity-40 hover:bg-slate-50 transition-colors"
          >
            <ChevronLeft size={16} />
          </button>
          <span className="text-sm text-slate-600">{page} / {totalPages}</span>
          <button
            onClick={() => changePage(page + 1)}
            disabled={page >= totalPages}
            className="p-1.5 rounded-lg border border-slate-200 disabled:opacity-40 hover:bg-slate-50 transition-colors"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      )}
    </div>
  )
}
