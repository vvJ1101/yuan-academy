# YUAN Academy — 部署运维手册

## 服务器信息

| 项目 | 值 |
|------|-----|
| **生产域名** | https://academy.yuanshowroom.cn |
| **服务器 IP** | `120.79.162.27` |
| **SSH 用户** | `root` |
| **SSH 端口** | `22` |
| **SSH 密码** | `Huang991208` |
| **项目路径** | `/var/www/yuan-academy` |
| **PM2 进程名** | `yuan-academy` |

## 环境变量（生产）

```
DEEPSEEK_API_KEY=<从本地.env.local获取>
JWT_SECRET=353df428b72a117e3922fb242f79d76f301372ac327d3a2b23cd512a5b6e0da6
NODE_ENV=production
NODE_OPTIONS=--max-old-space-size=512
```

## 部署工作流

### 前置条件
- 本地已安装 `rsync`（macOS 自带）
- 服务器已安装 `pm2`、`node`、`npm`
- 首次部署前执行一次 `ssh root@120.79.162.27 "mkdir -p /var/www/yuan-academy"`

### 标准部署流程（推荐）

#### 第 1 步：本地预检

每次部署前必须运行，确保没有遗漏文件或编译错误：

```bash
cd /Users/vv/yuan-academy
bash scripts/preflight.sh
# 全部通过则继续，有错误则修复后重跑
```

#### 第 2 步：增量同步到服务器

```bash
cd /Users/vv/yuan-academy
rsync -avz --delete \
  --exclude '.git' \
  --exclude '.next' \
  --exclude 'node_modules' \
  --exclude 'prisma/dev.db' \
  --exclude 'prisma/dev.db-journal' \
  --exclude 'public/uploads' \
  . root@120.79.162.27:/var/www/yuan-academy/
```

#### 第 3 步：服务器部署

```bash
ssh root@120.79.162.27 'bash /var/www/yuan-academy/scripts/server-deploy.sh'
```

部署脚本执行内容：
1. 清理 FTS 影子表
2. Prisma 数据库迁移（`db push --accept-data-loss`）
3. 种子数据更新
4. 重建 FTS5 全文索引
5. PM2 重启应用
6. 健康检查（curl 验证 4 个关键路由）

### 备用方式（tar + scp）

当 rsync 不可用时：

```bash
cd /Users/vv/yuan-academy
tar -czf deploy.tar.gz \
  --exclude='node_modules' \
  --exclude='.next' \
  --exclude='prisma/dev.db' \
  --exclude='.git' \
  --exclude='public/uploads' \
  --exclude='public/data/policies.json' \
  --exclude='public/showroom/data/policies.json' \
  .
scp deploy.tar.gz root@120.79.162.27:/var/www/yuan-academy/
ssh root@120.79.162.27 "cd /var/www/yuan-academy && tar -xzf deploy.tar.gz && npm install --production && bash scripts/server-deploy.sh"
```

## 运维操作

### 快速重启（仅重启应用，不更新代码）

```bash
ssh root@120.79.162.27 "cd /var/www/yuan-academy && bash scripts/server-deploy.sh"
```

### 查看运行状态

```bash
pm2 status
pm2 logs yuan-academy --lines 50
pm2 monit
```

### 数据库备份

```bash
# 服务器上执行
cp /var/www/yuan-academy/prisma/dev.db /var/backups/yuan-academy-$(date +%Y%m%d).db
```

## 回滚方案

### 快速回滚（有备份目录时）

部署前先备份当前稳定版本：

```bash
ssh root@120.79.162.27 "cp -a /var/www/yuan-academy /var/www/yuan-academy-backup"
```

出问题时立即回滚：

```bash
ssh root@120.79.162.27 "
  rm -rf /var/www/yuan-academy && \
  cp -a /var/www/yuan-academy-backup /var/www/yuan-academy && \
  cd /var/www/yuan-academy && \
  npm install --production && \
  pm2 restart yuan-academy
"
```

### 手动回滚（无备份目录时）

```bash
# 恢复数据库
cp /var/backups/yuan-academy-<日期>.db /var/www/yuan-academy/prisma/dev.db

# 恢复旧代码（如有 git）
cd /var/www/yuan-academy && git checkout <上一个正常commit>

# 重启
pm2 restart yuan-academy
```

## 常见问题

| 问题 | 排查方法 |
|------|----------|
| 部署后页面 404 | 检查 `scripts/preflight.sh` 文件清单是否覆盖了新页面 |
| 数据库迁移报错 | `npx prisma db push --accept-data-loss` 强制同步 |
| PM2 进程起不来 | `pm2 logs yuan-academy --lines 30` 查看错误日志 |
| 图片不显示 | 确认 `public/uploads/` 是否被 rsync `--exclude` 跳过 |
| CSS 错乱或页面 500 | `rm -rf .next` 清除构建缓存后重启（`build` 后切回 `dev` 必须清缓存） |
| 服务器连不上 | 检查 IP `120.79.162.27` 和端口 `22` 是否可达 |
