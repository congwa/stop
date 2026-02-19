# Stop 部署指南

## 项目架构

```
stop/
  backend/          ← Python FastAPI License 服务端（:17771）
  frontend-manager/ ← React Admin 管理面板（构建后托管在后端）
  frontend/         ← Tauri 桌面客户端（macOS .app / .dmg）
  nginx/            ← Nginx 配置文件
  docker-compose.yml
```

**三个端：**

| 端 | 说明 | 线上地址 |
|---|---|---|
| License API | 客户端激活/验证接口 | `windsurf-stop.biomed168.com/api/*` |
| Admin 面板 | Key 生成/管理后台 | `windsurf-stop.biomed168.com/admin/` |
| Tauri 客户端 | macOS 桌面应用 | 分发 .dmg，连线上 API |

---

## 一、服务端部署（Docker + 宝塔 Nginx）

### 1. 服务器准备

```bash
# 安装 Docker 和 Docker Compose（若未安装）
curl -fsSL https://get.docker.com | sh
```

### 2. 拉取代码

```bash
git clone https://github.com/congwa/stop.git /opt/stop
cd /opt/stop
```

### 3. 配置环境变量

```bash
cp backend/.env.example backend/.env
nano backend/.env
```

修改以下三项（其余保持默认）：

```env
SECRET_KEY=你的随机密钥（至少32位）
ADMIN_PASSWORD=wangcong0921!
DATABASE_URL=sqlite:///./data/stop_license.db
```

> 生成随机密钥：`python3 -c "import secrets; print(secrets.token_hex(32))"`

### 4. 构建并启动

```bash
# 一条命令完成所有构建（Docker 内部自动安装所有依赖）：
# Stage 1: Node.js 安装 frontend-manager 依赖并构建 Admin 面板
# Stage 2: Python 安装后端依赖，打包 Admin 静态文件
docker compose up -d --build

# 检查状态
docker compose ps
curl http://localhost:17771/health
```

> **无需**在服务器上安装 Node.js 或手动执行 npm install，Docker 多阶段构建全部处理。

### 5. 配置宝塔 Nginx

**第一步：添加限流配置到 Nginx http{} 块**

宝塔面板 → 软件商店 → Nginx → 配置修改，在 `http {` 后面添加：

```nginx
limit_req_zone $binary_remote_addr zone=stop_client:10m rate=10r/m;
limit_req_zone $binary_remote_addr zone=stop_activate:10m rate=3r/m;
```

保存，点击「重载配置」。

**第二步：新建站点**

宝塔面板 → 网站 → 添加站点：
- 域名：`windsurf-stop.biomed168.com`
- 根目录任意（不使用，仅走反代）
- PHP 版本：纯静态

**第三步：配置文件**

进入站点设置 → 配置文件，**清空全部内容**，粘贴 `nginx/windsurf-stop.biomed168.com.conf` 的完整内容，保存。

**第四步：测试**

```bash
curl http://windsurf-stop.biomed168.com/health
# 应返回: {"status":"ok"}
```

---

## 二、Admin 管理面板使用

访问：`http://windsurf-stop.biomed168.com/admin/`

登录私钥：`wangcong0921!`（即 `.env` 中的 `ADMIN_PASSWORD`）

**生成 License Key 步骤：**

1. 登录 → 「生成 Key」页面
2. 选择类型（7天 / 30天 / 90天 / 365天 / 永久）
3. 输入数量 → 点「生成」
4. 复制或导出 CSV，分发给用户

---

## 三、Tauri 客户端构建

### 环境区分（自动）

| 命令 | License 服务器 |
|---|---|
| `cargo tauri dev` | `http://localhost:17771`（本地开发）|
| `cargo tauri build` | `http://windsurf-stop.biomed168.com`（线上）|

由 Tauri 的 `cfg!(dev)` 标志自动切换，**无需手动配置**。

### 本地开发调试

```bash
# 启动本地后端
cd backend
source venv/bin/activate
python main.py

# 另一个终端，启动 Tauri 开发模式
cd frontend
npm run tauri dev
# 此时连接 localhost:17771
```

### 打包生产版本（.dmg）

```bash
cd frontend

# 完整构建（包含 windsurf_chat CLI）
npm run tauri -- build

# 或者只构建 .app 然后手动打 DMG
npm run tauri -- build --bundles app
hdiutil create -volname "Stop" \
  -srcfolder "src-tauri/target/release/bundle/macos/Stop.app" \
  -ov -format UDZO \
  "src-tauri/target/release/bundle/dmg/Stop_aarch64.dmg"
```

产物路径：`frontend/src-tauri/target/release/bundle/dmg/Stop_*.dmg`

---

## 四、前端 Admin 面板本地开发

```bash
cd frontend-manager
npm install
npm run dev
# 访问 http://localhost:5173/admin/
# 代理 /admin/api → http://localhost:17771
# 需要先启动后端
```

---

## 五、数据持久化

SQLite 数据库文件：`/opt/stop/data/stop_license.db`（宿主机挂载卷）

**备份：**
```bash
cp /opt/stop/data/stop_license.db /backup/stop_license_$(date +%Y%m%d).db
```

**升级后端（不丢数据）：**
```bash
cd /opt/stop
git pull
docker compose up -d --build
# Docker 会重新构建镜像（含 Admin 面板），数据卷 ./data/ 不受影响
```

---

## 六、常见问题

**Q: 客户端提示"无法连接授权服务器"**
- 检查服务端是否运行：`docker compose ps`
- 检查 Nginx 配置：`curl http://windsurf-stop.biomed168.com/health`

**Q: 想强制某用户重新激活**
- Admin 面板 → Key 列表 → 找到该 Key → 点「吊销」
- 用户下次启动会被要求输入新 Key

**Q: 本地开发时跳过 License 验证**
- 临时方式：在 `LicenseGate.tsx` 直接 `return <>{children}</>` 跳过验证

**Q: 管理员私钥泄露怎么办**
- 修改 `backend/.env` 中的 `ADMIN_PASSWORD`
- 重启容器：`docker compose restart backend`
- 之前颁发的 JWT（24小时有效期）会在过期后自动失效
