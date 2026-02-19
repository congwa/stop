# Changelog

All notable changes to this project will be documented in this file.

## [0.8.0] - 2025-02-19

### 核心亮点

License 管理完善、UI 体验修复、全项目时区统一（北京时间 UTC+8）

### Added
- License 倒计时 Badge：Header 显示有效天数，7 天内变为橙色警告
- License 一键切换：Header 右侧 🔑 按钮，清除当前 Key 并跳回激活页
- License 心跳检测：每 30 分钟自动验证，失效/过期立即退出到激活页
- License 到期自动退出：倒计时归零时自动调用 logoutLicense
- Tauri 新命令 `clear_license`：清除本地缓存的 License 文件

### Fixed
- 等待反馈时输入框未清空：新请求到来时自动重置文本和图片列表
- macOS DMG 打包：Tauri v2 默认已包含 Applications 快捷方式

### Changed
- 全项目版本号统一为 `0.8.0`（package.json、tauri.conf.json、Cargo.toml × 2）
- **时区全面校准（北京时间 UTC+8）**
  - `backend/config.py`：新增 `BEIJING_TZ`、`beijing_now()`、`beijing_today()` helper
  - `backend/models.py`：`created_at` 默认值从 `datetime.utcnow` 改为 `beijing_now`
  - `backend/routes/api.py`：`date.today()` → `beijing_today()`，`datetime.utcnow()` → `beijing_now()`
  - `backend/routes/admin.py`：所有 `date.today()` → `beijing_today()`
  - `backend/routes/admin_auth.py`：JWT `datetime.utcnow()` → `datetime.now(timezone.utc)`
  - `backend/services/license.py`：`date.today()` → `beijing_today()`
  - `frontend/ChatPanel.tsx`：expiry_date 解析从 UTC 午夜改为北京时区当天结束时刻 `T23:59:59+08:00`

## [0.7.1] - 2025-02-19

### Changed
- 切换为 uv 管理 Python 依赖
- Docker 多阶段构建，所有依赖在容器内安装
- 开发/生产环境自动切换 + 部署文档

## [0.7.0] - 2025-02-18

### Added
- License 在线激活绑定系统 v1.0
- Docker 部署配置 + Nginx 限流 + Admin JWT 私钥认证

### Changed
- 修复打包配置，windsurf_chat 正确包含在应用包中
- windsurf_chat 拆为独立 crate 解决 externalBin 循环依赖

## [0.6.0] - 2025-02

### Added
- RAM Disk 自动挂载 + 全局规则写入
- LaunchAgent 守护进程安装

## [0.5.0] - 2025-02

### Added
- 多 Prompt 队列管理
- 图片粘贴/上传反馈
- 断线重连 + response_queued 状态

## [0.4.0] - 2025-01

### Added
- Chat 服务器核心架构
- Tauri 前端 + Rust 后端通信

## [0.1.0] - 2025-01

### Added
- 项目初始化
