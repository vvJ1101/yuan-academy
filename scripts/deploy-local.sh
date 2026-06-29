#!/usr/bin/env bash
set -e

# ============================================================
# YUAN Academy — 本地构建 → 远程部署脚本
# 用法: ./scripts/deploy-local.sh
# 前置条件: SSH 免密登录已配置 (ssh root@120.79.162.27)
# ============================================================

SERVER="root@120.79.162.27"
REMOTE_DIR="/var/www/yuan-academy"

echo "🔨 [1/4] 本地构建..."
cd "$(dirname "$0")/.."
rm -rf .next
NODE_OPTIONS="--max-old-space-size=4096" npm run build

echo "📡 [2/4] 同步源代码到服务器..."
rsync -avz --delete \
  --exclude='node_modules/' \
  --exclude='.next/' \
  --exclude='.git/' \
  --exclude='prisma/dev.db*' \
  --exclude='public/uploads/' \
  --exclude='.env*' \
  --exclude='screenlog*' \
  ./ "$SERVER:$REMOTE_DIR/"

echo "📦 [3/4] 同步构建产物到服务器..."
rsync -avz --delete .next/ "$SERVER:$REMOTE_DIR/.next/"

echo "🔄 [4/4] 部署..."
ssh "$SERVER" "
  set -e
  cd $REMOTE_DIR

  # 检查是否需要更新 Prisma Client（schema 有变化时）
  if [ prisma/schema.prisma -nt node_modules/.prisma/client/index.js ] 2>/dev/null; then
    echo '  → 更新 Prisma Client...'
    npx prisma generate
    npx tsx scripts/fts-migrate.ts
  fi

  # 重启应用
  pm2 restart yuan-academy 2>/dev/null || \
    NODE_OPTIONS='--max-old-space-size=256' pm2 start ecosystem.config.js

  echo '  → 部署完成'
"

echo ""
echo "✅ 部署成功！访问 https://academy.yuanshowroom.cn 验证"
