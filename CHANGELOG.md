# Changelog

All notable changes to this project will be documented in this file.

## [0.8.3] - 2026-02-19

### 核心亮点

将初始化流程从并发改为严格线性顺序，从根本上消除竞态条件

### Fixed
- 彻底修复竞态条件：初始化流程改为 `verifyLicense` → `initRamDisk` → `installGlobalRules` 严格顺序
- 无密钥或密钥过期时，`initRamDisk` 和 `installGlobalRules` 均不会被调用

### Changed
- `App.tsx` 不再直接调用 `initRamDisk`，由 `LicenseGate` 统一管控全部初始化序列
- `LicenseGate` 新增线性初始化：`status.valid` 变为 true 后顺序执行 `initRamDisk().then(installGlobalRules)`
- `useChatStore` 新增 `reinitialize()` 动作（顺序执行，用于重试按钮）
- `RamDiskStatusBar` 重试按钮改用 `reinitialize`，确保重试也是顺序执行

## [0.8.2] - 2026-02-19

### 核心亮点

修复二次启动偶现「全局控制代码未写入」的竞态条件 bug

### Fixed
- 修复 `init_ram_disk` 命令未调用 `install_global_rules` 导致二次启动时 `global_rules_installed` 返回 `false` 的问题
- 修复 `LicenseGate` 调用 `installGlobalRules()` 后需等 5 秒轮询才更新 UI 状态的问题，现在调用后立即 `refreshRamDiskStatus()`

### Changed
- `init_ram_disk` 命令新增第 4 步：binary 安装后立即写入 global rules，确保返回状态准确
- `LicenseGate` 注入流程：`installGlobalRules().then(() => refreshRamDiskStatus())`

## [0.8.1] - 2026-02-19

### 核心亮点

注入流程安全加固：License 验证通过后才执行注入，过期/退出立即清除注入

### Fixed
- 注入生命周期修复：不再在启动时立即注入 global_rules，改为 License 验证成功后才注入
- 密钥过期后立即调用 `remove_injection` 删除 `~/.codeium/windsurf/memories/global_rules.md`
- 退出软件时清除所有注入设置（已有的 `on_window_event` 机制保持不变）

### Added
- License 明文密钥存储：后台可查看 Key 原始值
- 短期测试类型 License 支持
- 管理面板 KeyList 一键复制 License Key 功能
- 新 Tauri 命令 `install_global_rules` / `remove_injection`：精细控制注入与清除

### Changed
- `init_ram_disk` 命令不再安装全局规则，专注基础设施（RAM 磁盘 + 二进制）
- `LicenseGate` 接管注入生命周期，通过 `injectedRef` 避免重复注入

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
