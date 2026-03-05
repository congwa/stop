import { useState, useCallback, useRef, useEffect } from 'react'
import { useChatStore } from '@/store/useChatStore'
import { useLicenseStore } from '@/store/useLicenseStore'
import { cn } from '@/lib/utils'
import { ThemeToggle } from './ThemeToggle'
import {
  Play,
  Square,
  Zap,
  Server,
  CheckCircle2,
  XCircle,
  Loader2,
  ShieldAlert,
  Send,
  SkipForward,
  ImagePlus,
  X,
  Clock,
  WifiOff,
  AlertTriangle,
  HardDrive,
  RefreshCw,
  KeyRound,
} from 'lucide-react'

// ============================================================
// Main Panel
// ============================================================

export function ChatPanel() {
  const {
    serverStatus,
    isStarting,
    pendingPrompts,
    respondedIds,
    autoModeInfo,
    ramDiskStatus,
    ramDiskInitializing,
    globalRulesInstalling,
    startServer,
    stopServer,
    reinitialize,
  } = useChatStore()

  const isRunning = serverStatus?.running ?? false
  const latestPrompt = pendingPrompts[0] ?? null
  const isResponded = latestPrompt ? respondedIds.has(latestPrompt.request_id) : false

  const { status: licenseStatus, logoutLicense } = useLicenseStore()

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <header className="border-b bg-card px-4 py-3 flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-base font-bold text-foreground">Stop · AI 对话反馈</h1>
          <p className="text-xs text-muted-foreground mt-0.5">自动生效 · 退出即清理</p>
        </div>
        <div className="flex items-center gap-2">
          {autoModeInfo && <AutoModeBadge policy={autoModeInfo.auto_execution_policy} />}
          {licenseStatus?.expiry_date && <LicenseExpiryBadge expiryDate={licenseStatus.expiry_date} />}
          <ServerStatusBadge running={isRunning} />
          {isRunning ? (
            <button onClick={stopServer} className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors">
              <Square className="h-3.5 w-3.5" />停止
            </button>
          ) : (
            <button onClick={startServer} disabled={isStarting} className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50">
              <Play className="h-3.5 w-3.5" />{isStarting ? '启动中...' : '启动'}
            </button>
          )}
          <ThemeToggle />
          <button
            onClick={logoutLicense}
            className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
            title="切换 License Key"
          >
            <KeyRound className="h-3.5 w-3.5" />
          </button>
        </div>
      </header>

      {/* RAM Disk status bar */}
      <div className="px-4 pt-2 shrink-0">
        <RamDiskStatusBar status={ramDiskStatus} initializing={ramDiskInitializing || globalRulesInstalling} onRetry={reinitialize} />
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-auto p-4">
        {latestPrompt ? (
          <PromptCard prompt={latestPrompt} isResponded={isResponded} />
        ) : isRunning ? (
          <EmptyWaiting />
        ) : (
          <EmptyServer />
        )}
      </div>
    </div>
  )
}

// ============================================================
// Status Badges
// ============================================================

function ServerStatusBadge({ running }: { running: boolean }) {
  return (
    <span className={cn(
      'flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border',
      running
        ? 'text-emerald-600 border-emerald-500/30 bg-emerald-500/5'
        : 'text-muted-foreground border-border bg-muted/30'
    )}>
      <span className={cn(
        'h-1.5 w-1.5 rounded-full',
        running ? 'bg-emerald-500 animate-pulse' : 'bg-muted-foreground'
      )} />
      {running ? '运行中' : '已停止'}
    </span>
  )
}

function AutoModeBadge({ policy }: { policy: string }) {
  const isEager = policy?.includes('EAGER')
  if (!isEager) return null
  return (
    <span className="flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border border-amber-500/30 bg-amber-500/5 text-amber-600">
      <ShieldAlert className="h-3 w-3" />
      Auto 模式
    </span>
  )
}

function LicenseExpiryBadge({ expiryDate }: { expiryDate: string }) {
  const [remaining, setRemaining] = useState('')
  const [expired, setExpired] = useState(false)
  const { logoutLicense } = useLicenseStore()

  useEffect(() => {
    function calc() {
      // expiry_date is a bare date string (e.g. "2025-12-31") from the server.
      // JS parses bare dates as UTC midnight, causing an 8-hour offset in UTC+8.
      // Treat it as end-of-day Beijing time (UTC+8) = T23:59:59+08:00.
      const expiry = new Date(`${expiryDate}T23:59:59+08:00`).getTime()
      const diffMs = expiry - Date.now()
      if (diffMs <= 0) {
        setRemaining('已过期')
        setExpired(true)
        return
      }
      const days = Math.floor(diffMs / 86400000)
      if (days > 0) { setRemaining(`${days}天`); return }
      const hours = Math.floor(diffMs / 3600000)
      setRemaining(`${hours}h`)
    }
    calc()
    const t = setInterval(calc, 60_000)
    return () => clearInterval(t)
  }, [expiryDate])

  useEffect(() => {
    if (expired) {
      logoutLicense()
    }
  }, [expired, logoutLicense])

  const isExpiringSoon = (() => {
    const diffMs = new Date(`${expiryDate}T23:59:59+08:00`).getTime() - Date.now()
    return diffMs > 0 && diffMs < 7 * 86400000
  })()

  return (
    <span className={cn(
      'flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border',
      expired || isExpiringSoon
        ? 'border-amber-500/30 bg-amber-500/5 text-amber-600'
        : 'border-emerald-500/20 bg-emerald-500/5 text-emerald-600'
    )}>
      <Clock className="h-3 w-3" />
      {remaining}
    </span>
  )
}

// ============================================================
// RAM Disk Status Bar
// ============================================================

function RamDiskStatusBar({
  status, initializing, onRetry
}: {
  status: ReturnType<typeof useChatStore.getState>['ramDiskStatus']
  initializing: boolean
  onRetry: () => void
}) {
  if (initializing) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-md border border-border bg-muted/30 text-xs text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        正在初始化 RAM Disk...
      </div>
    )
  }

  if (!status) {
    return (
      <div className="flex items-center justify-between px-3 py-2 rounded-md border border-amber-500/20 bg-amber-500/5 text-xs">
        <div className="flex items-center gap-2 text-amber-600">
          <HardDrive className="h-3.5 w-3.5" />
          RAM Disk 未初始化
        </div>
        <button onClick={onRetry} className="flex items-center gap-1 text-amber-600 hover:text-amber-700 transition-colors">
          <RefreshCw className="h-3 w-3" />重试
        </button>
      </div>
    )
  }

  const allGood = status.mounted && status.binary_installed && status.global_rules_installed

  if (allGood) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-md border border-emerald-500/20 bg-emerald-500/5 text-xs">
        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
        <span className="text-emerald-600 font-medium">已激活</span>
        <span className="text-muted-foreground ml-1">所有 Windsurf 项目自动生效，退出即清理</span>
        {!status.launch_agent_installed && (
          <span className="text-amber-500 ml-auto">(LaunchAgent 未安装)</span>
        )}
      </div>
    )
  }

  const issues = [
    !status.mounted && 'RAM Disk 未挂载',
    status.mounted && !status.binary_installed && '二进制未安装',
    !status.global_rules_installed && '全局控制代码未写入',
  ].filter(Boolean)

  return (
    <div className="flex items-center justify-between px-3 py-2 rounded-md border border-amber-500/20 bg-amber-500/5 text-xs">
      <div className="flex items-center gap-2 text-amber-600">
        <AlertTriangle className="h-3.5 w-3.5" />
        {issues.join(' · ')}
      </div>
      <button onClick={onRetry} className="flex items-center gap-1 text-amber-600 hover:text-amber-700 transition-colors">
        <RefreshCw className="h-3 w-3" />重新初始化
      </button>
    </div>
  )
}

// ============================================================
// Empty States
// ============================================================

function EmptyWaiting() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-muted-foreground">
      <Zap className="h-16 w-16 mb-6 opacity-20" />
      <p className="text-xl font-medium">等待 AI 回复...</p>
      <p className="text-sm mt-2 text-muted-foreground/70">
        AI 每次回复后会自动暂停，在此面板中提供反馈
      </p>
    </div>
  )
}

function EmptyServer() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-muted-foreground">
      <Server className="h-16 w-16 mb-6 opacity-20" />
      <p className="text-xl font-medium">服务启动中...</p>
      <p className="text-sm mt-2 text-muted-foreground/70">请稍等</p>
    </div>
  )
}

// ============================================================
// Image types
// ============================================================

interface ImageItem {
  preview: string
  filePath: string | null
  status: 'uploading' | 'done' | 'error'
}

// ============================================================
// PromptCard
// ============================================================

function PromptCard({ prompt, isResponded }: { prompt: ReturnType<typeof useChatStore.getState>['pendingPrompts'][0]; isResponded: boolean }) {
  const [text, setText] = useState('')
  const [images, setImages] = useState<ImageItem[]>([])
  const [submitting, setSubmitting] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { submitResponse, continueChat, endChat, saveFeedbackImage, dismissRequest } = useChatStore()

  const [elapsed, setElapsed] = useState(0)
  useEffect(() => {
    const startTime = prompt.timestamp * 1000 || Date.now()
    setElapsed(Math.floor((Date.now() - startTime) / 1000))
    const timer = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTime) / 1000))
    }, 5000)
    return () => clearInterval(timer)
  }, [prompt.timestamp])

  useEffect(() => {
    setText('')
    setImages([])
    textareaRef.current?.focus()
  }, [prompt.request_id])

  const processImageFile = useCallback(async (file: File) => {
    console.log('[Frontend] processImageFile 开始')
    console.log('[Frontend] 文件信息:', {
      name: file.name,
      size: file.size,
      type: file.type,
      lastModified: file.lastModified
    })
    
    const preview = URL.createObjectURL(file)
    console.log('[Frontend] 创建预览 URL:', preview)
    
    const ext = file.type.includes('png') ? 'png' : file.type.includes('gif') ? 'gif' : 'jpg'
    const filename = `feedback_${Date.now()}_${Math.floor(Math.random() * 1000)}.${ext}`
    console.log('[Frontend] 生成文件名:', filename)
    
    const item: ImageItem = { preview, filePath: null, status: 'uploading' }
    setImages((prev) => {
      console.log('[Frontend] 添加图片到列表，当前数量:', prev.length + 1)
      return [...prev, item]
    })
    
    const idx = images.length
    console.log('[Frontend] 图片索引:', idx)
    
    try {
      console.log('[Frontend] 开始转换为 base64')
      const base64 = await fileToBase64(file)
      console.log('[Frontend] base64 转换完成，数据长度:', base64.length)
      console.log('[Frontend] base64 前50字符:', base64.substring(0, 50))
      
      console.log('[Frontend] 开始调用 saveFeedbackImage')
      const filePath = await saveFeedbackImage(base64, filename)
      console.log('[Frontend] saveFeedbackImage 成功，文件路径:', filePath)
      
      setImages((prev) => {
        console.log('[Frontend] 更新图片状态为 done')
        return prev.map((img, i) => i === idx ? { ...img, filePath, status: 'done' } : img)
      })
    } catch (error) {
      console.error('[Frontend] 图片处理失败:', error)
      setImages((prev) => {
        console.log('[Frontend] 更新图片状态为 error')
        return prev.map((img, i) => i === idx ? { ...img, status: 'error' } : img)
      })
    }
  }, [images.length, saveFeedbackImage])

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    console.log('[Frontend] handlePaste 开始')
    console.log('[Frontend] clipboardData items count:', e.clipboardData?.items?.length)
    
    const items = e.clipboardData?.items
    if (!items) {
      console.log('[Frontend] 没有找到 clipboardData items')
      return
    }
    
    for (const item of Array.from(items)) {
      console.log('[Frontend] 检查 item:', {
        kind: item.kind,
        type: item.type,
        isImage: item.type.startsWith('image/')
      })
      
      if (item.type.startsWith('image/')) {
        console.log('[Frontend] 发现图片，阻止默认粘贴行为')
        e.preventDefault()
        const file = item.getAsFile()
        if (file) {
          console.log('[Frontend] 获取到图片文件:', {
            name: file.name,
            size: file.size,
            type: file.type,
            lastModified: file.lastModified
          })
          processImageFile(file)
        } else {
          console.log('[Frontend] 无法从 clipboard item 获取文件')
        }
        return
      }
    }
    
    console.log('[Frontend] 没有发现图片，允许默认粘贴行为')
  }, [processImageFile])

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files) return
    for (const file of Array.from(files)) {
      if (file.type.startsWith('image/')) processImageFile(file)
    }
    e.target.value = ''
  }, [processImageFile])

  const removeImage = useCallback((idx: number) => {
    setImages((prev) => {
      const removed = prev[idx]
      if (removed?.preview) URL.revokeObjectURL(removed.preview)
      return prev.filter((_, i) => i !== idx)
    })
  }, [])

  const hasContent = text.trim() || images.some((img) => img.status === 'done')
  const isUploading = images.some((img) => img.status === 'uploading')

  const handleSubmit = useCallback(async () => {
    console.log('[Frontend] handleSubmit 开始')
    console.log('[Frontend] 提交状态检查:', {
      submitting,
      isUploading,
      textLength: text.trim().length,
      imagesCount: images.length,
      doneImagesCount: images.filter(img => img.status === 'done').length
    })
    
    if (submitting || isUploading) {
      console.log('[Frontend] 当前正在提交或上传，跳过')
      return
    }
    
    setSubmitting(true)
    console.log('[Frontend] 设置提交状态为 true')
    
    try {
      const trimmed = text.trim()
      const imagePaths = images.filter((img) => img.status === 'done' && img.filePath).map((img) => img.filePath!)
      
      console.log('[Frontend] 准备提交数据:')
      console.log('  - 文本长度:', trimmed.length)
      console.log('  - 文本内容前50字符:', trimmed.substring(0, 50))
      console.log('  - 图片路径数量:', imagePaths.length)
      console.log('  - 图片路径:', imagePaths)
      
      if (trimmed || imagePaths.length > 0) {
        console.log('[Frontend] 调用 submitResponse')
        await submitResponse(prompt.request_id, trimmed, imagePaths.length > 0 ? imagePaths : undefined)
        console.log('[Frontend] submitResponse 成功')
      } else {
        console.log('[Frontend] 没有内容，调用 continueChat')
        await continueChat(prompt.request_id)
        console.log('[Frontend] continueChat 成功')
      }
    } catch (error) {
      console.error('[Frontend] handleSubmit 失败:', error)
    } finally {
      console.log('[Frontend] 设置提交状态为 false')
      setSubmitting(false)
    }
  }, [text, images, prompt.request_id, submitResponse, continueChat, submitting, isUploading])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault()
      handleSubmit()
    }
    if (e.key === 'Escape') endChat(prompt.request_id)
  }, [handleSubmit, endChat, prompt.request_id])

  const isDisconnected = prompt.connection_state === 'disconnected'
  const isResponseQueued = prompt.connection_state === 'response_queued'
  const isCompleted = prompt.connection_state === 'completed'

  if (isCompleted) {
    return (
      <div className="rounded-lg border bg-card p-4 space-y-3 opacity-50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-muted-foreground/40" />
            <span className="text-sm font-medium text-muted-foreground">已完成</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="h-3.5 w-3.5" />{formatElapsed(elapsed)}
            </span>
            <button
              onClick={() => dismissRequest(prompt.request_id)}
              className="h-6 w-6 flex items-center justify-center rounded text-muted-foreground hover:text-destructive transition-colors"
              title="关闭"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
        <div className="text-sm text-muted-foreground/70">{prompt.prompt}</div>
      </div>
    )
  }

  if (isResponded) {
    return (
      <div className="rounded-lg border bg-card p-4 space-y-3 opacity-70">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            <span className="text-sm font-medium text-muted-foreground">已响应，等待 AI 下一轮...</span>
          </div>
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="h-3.5 w-3.5" />{formatElapsed(elapsed)}
          </span>
        </div>
        <div className="text-sm text-muted-foreground/70">{prompt.prompt}</div>
      </div>
    )
  }

  return (
    <div className={cn('rounded-lg border bg-card p-4 space-y-3', isDisconnected && 'border-amber-500/30')}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {isDisconnected ? (
            <WifiOff className="h-3.5 w-3.5 text-amber-500" />
          ) : isResponseQueued ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-500" />
          ) : (
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
          )}
          <span className="text-sm font-medium">
            {isResponseQueued ? '响应已暂存' : isDisconnected ? '连接已断开' : '等待反馈'}
          </span>
          {prompt.project_name && (
            <span className="text-xs text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded">
              {prompt.project_name}
            </span>
          )}
        </div>
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          <Clock className="h-3.5 w-3.5" />{formatElapsed(elapsed)}
        </span>
      </div>

      {/* Disconnected banner */}
      {isDisconnected && (
        <div className="rounded-md bg-amber-500/10 border border-amber-500/20 px-3 py-2 text-sm">
          <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 font-medium">
            <WifiOff className="h-3.5 w-3.5 shrink-0" />
            CLI 连接已断开（Windsurf 可能已重试）
          </div>
          <p className="mt-1 text-xs text-muted-foreground">您仍可输入反馈，将在 AI 下次暂停时自动发送</p>
        </div>
      )}

      {/* Response queued banner */}
      {isResponseQueued && (
        <div className="rounded-md bg-blue-500/10 border border-blue-500/20 px-3 py-2 text-sm">
          <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 font-medium">
            <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
            响应已暂存，等待 AI 下次连接取走
          </div>
        </div>
      )}

      {/* Context */}
      {prompt.context && (
        <div className="rounded-md bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
          <span className="text-xs font-medium text-foreground/60 uppercase tracking-wider">用户消息</span>
          <p className="mt-1 line-clamp-3">{prompt.context}</p>
        </div>
      )}

      {/* AI prompt */}
      <div className="text-sm text-foreground">{prompt.prompt}</div>

      {/* Input */}
      <div className="space-y-2">
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          placeholder="输入新指令，可粘贴截图... (留空直接继续)"
          className="w-full min-h-[80px] resize-y rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        />

        {/* Image previews */}
        {images.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {images.map((img, idx) => (
              <div key={idx} className="relative group rounded-md overflow-hidden border border-border">
                <img src={img.preview} alt={`图片 ${idx + 1}`} className="h-16 w-16 object-cover" />
                {img.status === 'uploading' && (
                  <div className="absolute inset-0 bg-background/70 flex items-center justify-center">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  </div>
                )}
                {img.status === 'error' && (
                  <div className="absolute inset-0 bg-red-500/20 flex items-center justify-center">
                    <AlertTriangle className="h-4 w-4 text-red-500" />
                  </div>
                )}
                <button
                  onClick={() => removeImage(idx)}
                  className="absolute top-0.5 right-0.5 h-4 w-4 rounded-full bg-background/80 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="p-2 rounded-md border border-border text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors"
            title="添加图片"
          >
            <ImagePlus className="h-4 w-4" />
          </button>
          <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleFileChange} title="选择图片" />

          <button
            onClick={handleSubmit}
            disabled={submitting || isUploading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : hasContent ? (
              <Send className="h-4 w-4" />
            ) : (
              <SkipForward className="h-4 w-4" />
            )}
            {submitting ? '发送中...' : hasContent ? '提交' : '继续'}
          </button>

          <button
            onClick={() => endChat(prompt.request_id)}
            disabled={submitting}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors disabled:opacity-50"
          >
            <XCircle className="h-4 w-4" />
            结束
          </button>
        </div>

        <span className="text-xs text-muted-foreground">
          {navigator.platform?.includes('Mac') ? '⌘' : 'Ctrl'}+Enter 提交
        </span>
      </div>
    </div>
  )
}

// ============================================================
// Helpers
// ============================================================

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}
