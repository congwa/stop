import { useState } from 'react'
import { api } from '../lib/api'
import { Copy, Check, Download } from 'lucide-react'

const KEY_TYPES = [
  { value: '2h', label: '2 小时测试' },
  { value: '1d', label: '1 天' },
  { value: '2d', label: '2 天' },
  { value: '3d', label: '3 天' },
  { value: '4d', label: '4 天' },
  { value: '5d', label: '5 天' },
  { value: '7d', label: '7 天' },
  { value: '30d', label: '30 天' },
  { value: '90d', label: '90 天' },
  { value: '365d', label: '365 天' },
  { value: 'permanent', label: '永久' },
]

export default function GenerateKeys() {
  const [keyType, setKeyType] = useState('30d')
  const [count, setCount] = useState(1)
  const [note, setNote] = useState('')
  const [keys, setKeys] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')
  const [copied, setCopied] = useState(false)

  async function generate() {
    if (count < 1 || count > 500) { setErr('数量须在 1~500 之间'); return }
    setLoading(true)
    setErr('')
    setKeys([])
    try {
      const r = await api.generateKeys({ key_type: keyType, count, note: note || undefined })
      setKeys(r.keys)
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string } } }
      setErr(err.response?.data?.detail || '生成失败')
    } finally {
      setLoading(false)
    }
  }

  function copyAll() {
    navigator.clipboard.writeText(keys.join('\n'))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function downloadCsv() {
    const csv = 'Key,Type,Generated\n' + keys.map(k => `${k},${keyType},${new Date().toISOString()}`).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `stop-keys-${Date.now()}.csv`
    a.click()
  }

  return (
    <div className="p-8 max-w-2xl">
      <h2 className="text-xl font-bold text-slate-800 mb-6">批量生成 Key</h2>
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-6 space-y-5">
        <div>
          <label className="block text-sm font-medium text-slate-600 mb-2">Key 类型</label>
          <div className="flex gap-2 flex-wrap">
            {KEY_TYPES.map(t => (
              <button
                key={t.value}
                onClick={() => setKeyType(t.value)}
                className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                  keyType === t.value
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'border-slate-200 text-slate-600 hover:border-indigo-400'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex gap-4">
          <div className="flex-1">
            <label className="block text-sm font-medium text-slate-600 mb-1">数量 (1~500)</label>
            <input
              type="number"
              min={1}
              max={500}
              value={count}
              onChange={e => setCount(Number(e.target.value))}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div className="flex-1">
            <label className="block text-sm font-medium text-slate-600 mb-1">备注（可选）</label>
            <input
              type="text"
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="批次备注"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>
        {err && <p className="text-red-500 text-sm">{err}</p>}
        <button
          onClick={generate}
          disabled={loading}
          className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg px-6 py-2 font-medium transition-colors"
        >
          {loading ? '生成中...' : '生成'}
        </button>
      </div>

      {keys.length > 0 && (
        <div className="mt-6 bg-white rounded-xl border border-slate-100 shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <p className="font-medium text-slate-700">已生成 {keys.length} 个 Key</p>
            <div className="flex gap-2">
              <button
                onClick={copyAll}
                className="flex items-center gap-1.5 text-sm text-slate-600 hover:text-indigo-600 border border-slate-200 rounded-lg px-3 py-1.5 transition-colors"
              >
                {copied ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                {copied ? '已复制' : '复制全部'}
              </button>
              <button
                onClick={downloadCsv}
                className="flex items-center gap-1.5 text-sm text-slate-600 hover:text-indigo-600 border border-slate-200 rounded-lg px-3 py-1.5 transition-colors"
              >
                <Download size={14} />
                导出 CSV
              </button>
            </div>
          </div>
          <div className="bg-slate-50 rounded-lg p-4 max-h-64 overflow-y-auto">
            {keys.map((k, i) => (
              <div key={i} className="font-mono text-sm text-slate-700 py-0.5">{k}</div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
