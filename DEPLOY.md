# YUAN Academy — 部署运维手册

## 服务器信息

| 项目 | 值 |
|------|-----|
| **生产域名** | https://academy.yuanshowroom.cn |
| **服务器地址** | 从安全的密码管理器或运维平台获取 |
| **SSH 用户** | 从安全的密码管理器或运维平台获取 |
| **SSH 凭据** | 禁止写入本文档或提交到 Git |
| **项目路径** | `/var/www/yuan-academy` |
| **PM2 进程名** | `yuan-academy`（fork 单实例，512MB 上限） |

## 环境变量（生产）

环境变量在服务器 `.env.local` 中，**不要提交到 Git**：

```
DEEPSEEK_API_KEY=<从密码管理器或部署平台注入>
JWT_SECRET=<使用密码生成器创建的高强度随机值>
NODE_ENV=production
```

生产凭据只允许保存在服务器环境文件、GitHub Actions Secrets 或公司密码管理器中。禁止在 Markdown、源码、提交记录和聊天记录中保存真实值。若凭据曾进入 Git 历史，必须立即轮换；仅删除当前文件中的文字并不能撤销已经泄露的凭据。

## 部署工作流

### 前置条件
- 本地已安装 `scp` 和 `tar`
- SSH 登录信息已通过安全渠道配置
- 本地 Node.js >= 20.16.0；部署前运行 `node -v` 确认版本
- 服务器部署前同样运行 `node -v`，确认 Node.js >= 20.16.0

### 一键部署脚本

```bash
cd /Users/vv/Documents/YUAN开发/yuan-academy
# 必须先确认本地 Node.js >= 20.16.0
node -v
bash scripts/deploy-local.sh
```

脚本自动执行：
1. 本地 `npm run build`（保留 `.next/cache` 加速增量编译）
2. `xattr -cr` 清除 macOS 扩展属性
3. tar 打包构建产物（排除 `*.map` 文件）
4. scp 传输到服务器
5. 服务器备份旧 `.next` → 解压新版本 → 校验 BUILD_ID
6. PM2 重启 + 健康检查（失败自动回滚）

### 手动分步部署

```bash
# 1. 本地构建
cd /Users/vv/Documents/YUAN开发/yuan-academy
# 必须确认输出版本 >= 20.16.0
node -v
[ -d .next ] && find .next -maxdepth 1 ! -name .next ! -name cache -exec rm -rf {} +
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
# 清除 macOS 扩展属性，然后打包传输
xattr -cr .next 2>/dev/null || true
tar cf /tmp/next-build.tar --exclude='*.map' -C .next .
scp /tmp/next-build.tar root@120.79.162.27:/tmp/

# 4. 服务器部署
ssh root@120.79.162.27 "
  cd /var/www/yuan-academy
  # 必须确认输出版本 >= 20.16.0，否则停止部署并先升级 Node.js
  node -v
  
  # 备份并解压
  rm -rf .next.backup
  [ -d .next ] && mv .next .next.backup
  mkdir .next
  tar xf /tmp/next-build.tar -C .next
  rm /tmp/next-build.tar
  
  # 校验 BUILD_ID
  if [ "$(cat .next/BUILD_ID)" != "$(cd /var/www/yuan-academy && cat .next/BUILD_ID 2>/dev/null || echo 'unknown')" ]; then
    echo 'BUILD_ID 不匹配，回滚'
    rm -rf .next
    mv .next.backup .next
    exit 1
  fi
  
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
| **PM2 模式** | fork，单实例，512MB 内存上限 |
| **Node.js** | >= v20.16.0（每次部署前运行 `node -v` 验证） |
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
| POST | `/api/admin/policy/parse` | 订货政策文本结构化解析（规则引擎） |
| POST | `/api/admin/policy/ai-generate` | AI 生成政策结构化布局（super_admin，DeepSeek） |
| GET | `/api/admin/policy/layout?brand=xxx` | 获取指定品牌的 AI 布局 |
| PUT | `/api/admin/policy/layout` | 保存 AI 生成的品牌布局（super_admin） |
| GET | `/api/policies` | 登录用户读取私有订货政策，响应禁止公共缓存 |
| GET | `/api/policies/template` | 登录用户下载私有上传模板 |

旧的 `/data/policies.json`、`/showroom/data/policies.json` 和公开模板路径已经停用，不得恢复。

## 订货政策私有数据部署

订货政策运行数据不提交到 Git，也不包含在 `.next` 构建包中。首次部署、迁移服务器或重建 `/var/www/yuan-academy` 时，必须单独配置以下目录：

```text
/var/www/yuan-academy/data/private/policies/
├── policies.json
├── policies.updated.json
├── policies.backup.json
└── 订货政策-上传模板.xlsx
```

目录权限设为 `750`，文件权限设为 `640`。传输应先进入服务器临时目录，校验 JSON 后再通过 `install` 原子写入目标位置。不得把这些文件复制到 `public/`、`.next/static/` 或 Nginx 静态目录。

部署后验证：

```bash
ssh root@120.79.162.27 '
  set -e
  cd /var/www/yuan-academy
  test "$(stat -c %a data/private/policies)" = 750
  node -e "const p=require(\"./data/private/policies/policies.json\"); const rows=Array.isArray(p)?p:p.policies; if(!Array.isArray(rows)||rows.length===0) process.exit(1); console.log(rows.length)"
  test ! -e public/data/policies.json
  test ! -e public/showroom/data/policies.json
  test "$(curl -sS -o /dev/null -w "%{http_code}" http://127.0.0.1:3001/api/policies)" = 401
'
```

登录态还需在浏览器访问 `/internal/policy`，确认品牌数量和更新时间正常显示。自动部署不得删除 `data/private/`；使用 `rsync --delete` 时必须把该目录加入排除列表。

### 政策结构化解析示例

```bash
curl -X POST https://academy.yuanshowroom.cn/api/admin/policy/parse \
  -H 'Content-Type: application/json' \
  -d '{"text": "每款每色3件起订\n5W 4.5折 无换货率\n8W 4折 换货率10%"}'
```

## 回滚方案

部署脚本自动包含回滚：解压后 BUILD_ID 校验失败会自动恢复上一版本。

### 快速回滚（有备份时）

```bash
ssh root@120.79.162.27 "
  cd /var/www/yuan-academy
  [ -d .next.backup ] && rm -rf .next && mv .next.backup .next
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
| **xattr 警告刷屏** | 本地构建前 `xattr -cr .next` 清除 macOS 扩展属性（脚本已自动处理） |
| **订货政策数据不存在** | 检查 `data/private/policies/policies.json` 是否存在、JSON 是否含非空数组以及目录/文件权限是否为 `750`/`640`；禁止从公开目录回退读取 |

## CI/CD 自动部署（GitHub Actions）

### 配一次就能 git push 自动上线

#### 第一步：在 GitHub 仓库添加 Secrets

把你的仓库 `vvJ1101/yuan-academy` 的 Settings → Secrets and variables → Actions → New repository secret 添加以下密钥：

| 密钥名称 | 值（以下面的为准） |
|----------|----------------|
| `SERVER_HOST` | 从运维平台获取，不写入仓库 |
| `SERVER_USER` | 使用最小权限部署账号，不在仓库公开具体值 |
| `SSH_PRIVATE_KEY` | 新建专用部署密钥，并只保存到 GitHub Actions Secrets |
| `DEEPSEEK_API_KEY` | 从密码管理器复制到 GitHub Actions Secrets |
| `JWT_SECRET` | 使用密码生成器创建并保存到 GitHub Actions Secrets |

> 安全要求：私钥、密码和实际环境变量值不得出现在 Markdown、Issue、PR、日志或 Git 历史中。发现泄露后必须立即撤销旧凭据并重新生成；仅删除当前文件内容不能消除历史泄露。
