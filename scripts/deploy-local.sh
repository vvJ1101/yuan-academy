#!/usr/bin/env bash
set -e

SERVER="root@120.79.162.27"
REMOTE_DIR="/var/www/yuan-academy"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)

echo "🔨 [1/6] 本地构建..."
cd "$(dirname "$0")/.."
echo "  → 保留构建缓存加速增量编译..."
[ -d .next ] && find .next -maxdepth 1 ! -name .next ! -name cache -exec rm -rf {} + 2>/dev/null
NODE_OPTIONS="--max-old-space-size=4096" npm run build

if [ ! -f .next/BUILD_ID ]; then
  echo "❌ 构建失败：未生成 BUILD_ID"
  exit 1
fi
BUILD_ID=$(cat .next/BUILD_ID)
echo "  → BUILD_ID: $BUILD_ID"

echo "  → 拷贝静态文件（favicon等）到 .next/"
[ -f public/favicon.png ] && cp public/favicon.png .next/favicon.png 2>/dev/null || true
[ -f public/apple-icon.png ] && cp public/apple-icon.png .next/apple-icon.png 2>/dev/null || true
[ -f public/og-image.png ] && cp public/og-image.png .next/og-image.png 2>/dev/null || true

echo "📦 [2/6] 打包构建产物..."
# --no-xattr 排除 macOS 的 com.apple.provenance 属性，避免服务端 tar 刷报警
tar cf /tmp/next-build-$BUILD_ID.tar --no-xattr --no-acl --exclude='*.map' -C .next .
BUILD_SIZE=$(du -h /tmp/next-build-$BUILD_ID.tar | cut -f1)
echo "  → 压缩包大小: $BUILD_SIZE"

echo "📡 [3/6] 传输到服务器..."
# 传输到服务器临时目录
scp /tmp/next-build-$BUILD_ID.tar "$SERVER:/tmp/"
# 删除本地压缩包
rm /tmp/next-build-$BUILD_ID.tar

echo "💾 [4/6] 在服务器上部署..."
ssh "$SERVER" "
  set -e
  cd $REMOTE_DIR

  # 检查磁盘空间（至少需要2GB）
  AVAIL=\$(df --output=avail /var/www | tail -1)
  if [ \$AVAIL -lt 2097152 ]; then
    echo '❌ 磁盘空间不足 (可用: \$((AVAIL/1024))MB，需要: 2GB)'
    exit 1
  fi

  # 备份当前 .next
  echo '  → 备份旧版本...'
  rm -rf .next.backup
  [ -d .next ] && mv .next .next.backup

  # 解压新版本
  echo '  → 解压新版本...'
  mkdir .next
  tar xf /tmp/next-build-$BUILD_ID.tar -C .next
  rm /tmp/next-build-$BUILD_ID.tar

  # 验证 BUILD_ID
  REMOTE_ID=\$(cat .next/BUILD_ID)
  if [ \"\$REMOTE_ID\" != \"$BUILD_ID\" ]; then
    echo \"❌ BUILD_ID 不匹配 (\$REMOTE_ID vs $BUILD_ID)\"
    rm -rf .next
    mv .next.backup .next
    exit 1
  fi
  echo \"  → BUILD_ID 验证通过 (\$REMOTE_ID)\"
"

echo "🔄 [5/6] 重启应用..."
ssh "$SERVER" "
  cd $REMOTE_DIR
  pm2 start ecosystem.config.js --update-env 2>/dev/null || pm2 restart yuan-academy
  pm2 save
"

echo "🔍 [6/6] 健康检查..."
sleep 5
HTTP_CODE=$(curl -s -o /dev/null -w '%{http_code}' https://academy.yuanshowroom.cn/login)
if [ "$HTTP_CODE" = "200" ]; then
  echo "✅ 部署成功！https://academy.yuanshowroom.cn ($HTTP_CODE)"
  ssh "$SERVER" "rm -rf $REMOTE_DIR/.next.backup"
else
  echo "❌ 健康检查失败 (HTTP $HTTP_CODE)，正在回滚..."
  ssh "$SERVER" "
    cd $REMOTE_DIR
    rm -rf .next
    mv .next.backup .next
    pm2 restart yuan-academy
  "
  echo "  → 已回滚到上一版本"
  exit 1
fi

echo ""
echo "━━━ 部署完成 ━━━"
echo "耗时: 本地构建 + 远程部署"
echo "时间: $(date '+%Y-%m-%d %H:%M:%S')"
