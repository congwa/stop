import { useState, useCallback, useRef, useEffect } from 'react'
import { useChatStore } from '@/store/useChatStore'
import { cn } from '@/lib/utils'
import {
  Play,
  Square,
  FolderOpen,
  Zap,
  Server,
  CheckCircle2,
  XCircle,
  Loader2,
  ChevronDown,
  ChevronUp,
  ShieldAlert,
  Send,
  SkipForward,
  ImagePlus,
  X,
  Clock,
  WifiOff,
  AlertTriangle,
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
    startServer,
    stopServer,
  } = useChatStore()

  const isRunning = serverStatus?.running ?? false

  // Show only the latest (first) prompt — single conversation mode
  const latestPrompt = pendingPrompts[0] ?? null
  const isResponded = latestPrompt ? respondedIds.has(latestPrompt.request_id) : false

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <header className="border-b bg-card px-4 py-3 flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-base font-bold text-foreground">Stop · AI 对话反馈</h1>
          <p className="text-xs text-muted-foreground mt-0.5">暂停 AI 对话，精准反馈指令</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Auto mode badge */}
          {autoModeInfo && <AutoModeBadge policy={autoModeInfo.auto_execution_policy} />}
          {/* Server status */}
          <ServerStatusBadge running={isRunning} />
          {/* Start/Stop */}
          {isRunning ? (
            <button
              onClick={stopServer}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors"
            >
              <Square className="h-3.5 w-3.5" />
              停止
            </button>
          ) : (
            <button
              onClick={startServer}
              disabled={isStarting}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              <Play className="h-3.5 w-3.5" />
              {isStarting ? '启动中...' : '启动'}
            </button>
          )}
        </div>
      </header>

      {/* Workspace setup */}
      {isRunning && (
        <div className="px-4 pt-3 shrink-0">
          <WorkspaceSetup />
        </div>
      )}

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
// Workspace Setup
// ============================================================

function WorkspaceSetup() {
  const setupWorkspace = useChatStore((s) => s.setupWorkspace)
  const [selectedPath, setSelectedPath] = useState<string | null>(null)
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')
  const [expanded, setExpanded] = useState(true)

  const handleSelectAndSetup = useCallback(async () => {
    try {
      const { open } = await import('@tauri-apps/plugin-dialog')
      const selected = await open({ directory: true, multiple: false, title: '选择项目目录' })
      if (!selected) return
      const dir = selected as string
      setSelectedPath(dir)
      setStatus('loading')
      setErrorMsg('')
      try {
        await setupWorkspace(dir)
        setStatus('success')
        setTimeout(() => setExpanded(false), 1500)
      } catch (e: unknown) {
        setStatus('error')
        setErrorMsg(String(e))
      }
    } catch {
      // User cancelled
    }
  }, [setupWorkspace])

  if (status === 'success' && !expanded) {
    return (
      <div
        className="flex items-center gap-2 px-3 py-2 rounded-md border border-emerald-500/20 bg-emerald-500/5 cursor-pointer hover:bg-emerald-500/10 transition-colors"
        onClick={() => setExpanded(true)}
      >
        <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
        <span className="text-sm text-emerald-500 font-medium">工作区已初始化</span>
        <span className="text-xs text-muted-foreground font-mono truncate flex-1">{selectedPath}</span>
        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
      </div>
    )
  }

  return (
    <div className="rounded-md border px-3 py-2.5 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FolderOpen className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">初始化工作区</span>
          {status === 'success' && (
            <span className="text-xs text-emerald-500 flex items-center gap-1">
              <CheckCircle2 className="h-3.5 w-3.5" />已完成
            </span>
          )}
          {status === 'error' && (
            <span className="text-xs text-red-500 flex items-center gap-1">
              <XCircle className="h-3.5 w-3.5" />失败
            </span>
          )}
        </div>
        {status === 'success' && (
          <button onClick={() => setExpanded(false)} className="text-muted-foreground hover:text-foreground transition-colors" title="收起">
            <ChevronUp className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={handleSelectAndSetup}
          disabled={status === 'loading'}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border border-border hover:bg-muted/50 transition-colors disabled:opacity-50"
        >
          {status === 'loading' ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <FolderOpen className="h-3.5 w-3.5" />
          )}
          {status === 'loading' ? '初始化中...' : '选择目录并初始化'}
        </button>
        {selectedPath && (
          <span className="text-xs text-muted-foreground font-mono truncate flex-1">{selectedPath}</span>
        )}
      </div>

      {status === 'success' && (
        <p className="text-xs text-emerald-500">已创建 .wdm/ 目录和 .windsurfrules 文件</p>
      )}
      {status === 'error' && (
        <p className="text-xs text-red-500">{errorMsg || '初始化失败'}</p>
      )}
      {status === 'idle' && (
        <p className="text-xs text-muted-foreground">选择需要启用 AI 对话反馈的项目目录，将自动完成初始化</p>
      )}
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

  useEffect(() => { textareaRef.current?.focus() }, [prompt.request_id])

  const processImageFile = useCallback(async (file: File) => {
    const preview = URL.createObjectURL(file)
    const ext = file.type.includes('png') ? 'png' : file.type.includes('gif') ? 'gif' : 'jpg'
    const filename = `feedback_${Date.now()}_${Math.floor(Math.random() * 1000)}.${ext}`
    const item: ImageItem = { preview, filePath: null, status: 'uploading' }
    setImages((prev) => [...prev, item])
    const idx = images.length
    try {
      const base64 = await fileToBase64(file)
      const filePath = await saveFeedbackImage(base64, filename)
      setImages((prev) => prev.map((img, i) => i === idx ? { ...img, filePath, status: 'done' } : img))
    } catch {
      setImages((prev) => prev.map((img, i) => i === idx ? { ...img, status: 'error' } : img))
    }
  }, [images.length, saveFeedbackImage])

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items
    if (!items) return
    for (const item of Array.from(items)) {
      if (item.type.startsWith('image/')) {
        e.preventDefault()
        const file = item.getAsFile()
        if (file) processImageFile(file)
        return
      }
    }
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
    if (submitting || isUploading) return
    setSubmitting(true)
    try {
      const trimmed = text.trim()
      const imagePaths = images.filter((img) => img.status === 'done' && img.filePath).map((img) => img.filePath!)
      if (trimmed || imagePaths.length > 0) {
        await submitResponse(prompt.request_id, trimmed, imagePaths.length > 0 ? imagePaths : undefined)
      } else {
        await continueChat(prompt.request_id)
      }
    } finally {
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
