# YUAN Academy — 部署运维手册

## 服务器信息

| 项目 | 值 |
|------|-----|
| **生产域名** | https://academy.yuanshowroom.cn |
| **服务器 IP** | `120.79.162.27` |
| **SSH 用户** | `root` |
| **SSH 密码** | `Huang991208` |
| **项目路径** | `/var/www/yuan-academy` |
| **PM2 进程名** | `yuan-academy`（fork 单实例，256MB 上限） |

## 环境变量（生产）

环境变量在服务器 `.env.local` 中，**不要提交到 Git**：

```
DEEPSEEK_API_KEY=<从本地.env.local获取>
JWT_SECRET=353df428b72a117e3922fb242f79d76f301372ac327d3a2b23cd512a5b6e0da6
NODE_ENV=production
```

## 部署工作流

### 前置条件
- 本地已安装 `rsync`（macOS 自带）
- SSH 免密登录已配置：`ssh root@120.79.162.27`
- 本地 Node.js >= 18

### 一键部署脚本

```bash
cd /Users/vv/yuan-academy
bash scripts/deploy-local.sh
```

脚本自动执行：
1. 本地 `npm run build`
2. rsync 源代码到服务器（排除 node_modules、.next、.git、数据库）
3. rsync `.next/` 构建产物到服务器
4. 服务器上自动 `pm2 restart` 并验证

### 手动分步部署

```bash
# 1. 本地构建
cd /Users/vv/yuan-academy
rm -rf .next
NODE_OPTIONS="--max-old-space-size=4096" npm run build

# 2. 同步源代码（排除大文件和敏感文件）
rsync -avz --delete \
  --exclude='node_modules/' \
  --exclude='.next/' \
  --exclude='.git/' \
  --exclude='prisma/dev.db*' \
  --exclude='public/uploads/' \
  --exclude='.env*' \
  --exclude='screenlog*' \
  ./ root@120.79.162.27:/var/www/yuan-academy/

# 3. 同步构建产物
rsync -avz --delete .next/ root@120.79.162.27:/var/www/yuan-academy/.next/

# 4. 服务器部署
ssh root@120.79.162.27 "
  cd /var/www/yuan-academy
  
  # 如果 schema 有变化，需要重新生成 Prisma Client
  # npx prisma generate
  
  # 重启应用
  pm2 restart yuan-academy 2>/dev/null || \
    NODE_OPTIONS='--max-old-space-size=256' pm2 start ecosystem.config.js
  
  # 验证
  curl -s -o /dev/null -w 'Login: %{http_code}' http://localhost:3001/login
  echo ''
"
```

### 首次部署（需要额外步骤）

```bash
# 1. 连接服务器并初始化
ssh root@120.79.162.27 "
  mkdir -p /var/www/yuan-academy
  # 安装 PM2（如果没有）
  npm i -g pm2
"

# 2. 同步源代码（同上）
# 3. 服务器初始化数据库
ssh root@120.79.162.27 "
  cd /var/www/yuan-academy
  npx prisma generate
  npx prisma db push
  npx tsx scripts/fts-migrate.ts
  
  # 创建 swap（如果还没有）
  fallocate -l 2G /swapfile 2>/dev/null || echo 'swap exists'
  chmod 600 /swapfile 2>/dev/null
  mkswap /swapfile 2>/dev/null
  swapon /swapfile 2>/dev/null
  echo '/swapfile none swap sw 0 0' >> /etc/fstab 2>/dev/null || true
"
```

## 服务器配置

### 当前状态

| 配置项 | 值 |
|--------|-----|
| **CPU** | 1-2 核 |
| **RAM** | 1.6 GB |
| **Swap** | 2 GB（已激活） |
| **磁盘** | 40 GB（约 11GB 已用） |
| **PM2 模式** | fork，单实例，256MB 内存上限 |
| **Node.js** | v20.x |
| **端口** | 3001（Next.js）← nginx 代理 443（HTTPS） |

### 确认服务器运行状态

```bash
# 从本地执行
ssh root@120.79.162.27 "
  pm2 list
  free -m | grep -E 'Mem|Swap'
  curl -s -o /dev/null -w '%{http_code}' http://localhost:3001/login
  df -h /
"
```

## 数据库操作

```bash
# Prisma Client 重新生成（schema 变更后必须执行）
npx prisma generate

# 数据库迁移（开发环境）
npx prisma db push

# 重建 FTS5 全文索引
npx tsx scripts/fts-migrate.ts

# 备份数据库
cp prisma/dev.db /var/backups/yuan-academy-$(date +%Y%m%d).db
```

## API 端点（管理后台）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/roles` | 角色列表（分页+搜索） |
| POST | `/api/roles` | 创建角色 |
| PUT | `/api/roles/{id}` | 编辑角色 |
| DELETE | `/api/roles/{id}` | 删除角色 |
| GET | `/api/permissions/tree` | 权限树 |
| GET/PUT | `/api/roles/{id}/permissions` | 角色权限分配 |
| GET/PUT | `/api/roles/{id}/dataScope` | 数据权限配置 |
| POST | `/api/admin/policy/parse` | 订货政策文本结构化解析 |

### 政策结构化解析示例

```bash
curl -X POST https://academy.yuanshowroom.cn/api/admin/policy/parse \
  -H 'Content-Type: application/json' \
  -d '{"text": "每款每色3件起订\n5W 4.5折 无换货率\n8W 4折 换货率10%"}'
```

## 回滚方案

### 快速回滚（有备份时）

```bash
ssh root@120.79.162.27 "
  # 如果有 .next 备份
  mv /var/www/yuan-academy/.next /var/www/yuan-academy/.next-broken
  cp -a /var/www/yuan-academy/.next-backup /var/www/yuan-academy/.next
  pm2 restart yuan-academy
"
```

### Git 回滚

```bash
# 本地回滚到上一个版本
git log --oneline -5
git reset --hard <上个正常commit的hash>

# 重新构建并部署
bash scripts/deploy-local.sh
```

## 常见问题

| 问题 | 排查方法 |
|------|----------|
| **Login: 000** | PM2 进程挂掉，`pm2 logs yuan-academy --lines 20` 查看错误 |
| **端口 3001 被占用** | `fuser -k 3001/tcp` 强杀后重启 PM2 |
| **Prisma Client 报错** | 服务器上执行 `npx prisma generate` |
| **构建不通过** | `rm -rf .next node_modules/.cache` 清除缓存后重试 |
| **.next 文件权限问题** | `chmod -R 755 /var/www/yuan-academy/.next` |
| **登录 500** | 检查 `.env.local` 是否存在，Prisma Client 是否最新 |
| **退出登录跳错** | 确认 logout API 返回 `307` 而非 `500` |
