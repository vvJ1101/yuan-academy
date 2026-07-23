#!/usr/bin/env bash
set -euo pipefail

SERVER="${SERVER:-root@120.79.162.27}"
APP_NAME="${APP_NAME:-yuan-academy}"
DOMAIN="${DOMAIN:-https://academy.yuanshowroom.cn}"
BASE_DIR="${BASE_DIR:-/var/www}"
STATE_FILE="${STATE_FILE:-/var/www/yuan-academy-current}"
LIVE_DIR="${LIVE_DIR:-/var/www/yuan-academy-live}"
SHARED_PRIVATE_DIR="${SHARED_PRIVATE_DIR:-/var/www/yuan-academy-shared/data/private}"
NGINX_UPSTREAM_FILE="${NGINX_UPSTREAM_FILE:-/etc/nginx/conf.d/yuan-academy-upstream.conf}"
BLUE_PORT="${BLUE_PORT:-3001}"
GREEN_PORT="${GREEN_PORT:-3003}"
INSTALL_DEPS="${INSTALL_DEPS:-0}"
KEEP_OLD_AFTER_ACTIVATE="${KEEP_OLD_AFTER_ACTIVATE:-0}"
MODE="dry-run"

usage() {
  cat <<'USAGE'
Usage:
  bash scripts/deploy-blue-green.sh --dry-run
  bash scripts/deploy-blue-green.sh --deploy-only
  bash scripts/deploy-blue-green.sh --activate

Modes:
  --dry-run      Show the planned blue/green target without changing production.
  --deploy-only  Build and deploy the inactive color, start it, and health-check it. Do not switch nginx.
  --activate     Build and deploy the inactive color, health-check it, switch nginx, and keep the old color running.

Environment overrides:
  SERVER=root@120.79.162.27
  BASE_DIR=/var/www
  STATE_FILE=/var/www/yuan-academy-current
  LIVE_DIR=/var/www/yuan-academy-live
  SHARED_PRIVATE_DIR=/var/www/yuan-academy-shared/data/private
  NGINX_UPSTREAM_FILE=/etc/nginx/conf.d/yuan-academy-upstream.conf
  BLUE_PORT=3001
  GREEN_PORT=3003
  INSTALL_DEPS=0
  KEEP_OLD_AFTER_ACTIVATE=0
USAGE
}

for arg in "$@"; do
  case "$arg" in
    --dry-run) MODE="dry-run" ;;
    --deploy-only) MODE="deploy-only" ;;
    --activate) MODE="activate" ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown argument: $arg" >&2; usage; exit 2 ;;
  esac
done

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

echo "🔎 Blue/green deploy mode: $MODE"
echo "  → Server: $SERVER"
echo "  → Domain: $DOMAIN"

node -v

CURRENT_COLOR="$(ssh "$SERVER" "test -f '$STATE_FILE' && cat '$STATE_FILE' || echo blue" | tr -d '[:space:]')"
if [ "$CURRENT_COLOR" = "blue" ]; then
  TARGET_COLOR="green"
  TARGET_PORT="$GREEN_PORT"
  CURRENT_PORT="$BLUE_PORT"
else
  TARGET_COLOR="blue"
  TARGET_PORT="$BLUE_PORT"
  CURRENT_PORT="$GREEN_PORT"
fi

TARGET_DIR="$BASE_DIR/yuan-academy-$TARGET_COLOR"
CURRENT_DIR="$BASE_DIR/yuan-academy-$CURRENT_COLOR"
TARGET_PM2="$APP_NAME-$TARGET_COLOR"

echo "  → Current: $CURRENT_COLOR ($CURRENT_DIR :$CURRENT_PORT)"
echo "  → Target:  $TARGET_COLOR ($TARGET_DIR :$TARGET_PORT)"

if [ "$MODE" = "dry-run" ]; then
  ssh "$SERVER" "
    set -e
    echo 'Server node:' \$(node -v)
    echo 'Current state file:' '$STATE_FILE'
    echo 'Current color:' '$CURRENT_COLOR'
    echo 'Live dir link:' \$(readlink -f '$LIVE_DIR' 2>/dev/null || echo missing)
    echo 'Shared private dir:' \$(test -d '$SHARED_PRIVATE_DIR' && echo present || echo missing)
    echo 'Target dir exists:' \$(test -d '$TARGET_DIR' && echo yes || echo no)
    echo 'Nginx upstream file exists:' \$(test -f '$NGINX_UPSTREAM_FILE' && echo yes || echo no)
    pm2 status '$APP_NAME' '$APP_NAME-blue' '$APP_NAME-green' 2>/dev/null || true
  "
  echo "✅ Dry run complete. No production changes were made."
  exit 0
fi

echo "🔨 [1/7] Build locally..."
[ -d .next ] && find .next -maxdepth 1 ! -name .next ! -name cache -exec rm -rf {} + 2>/dev/null
NODE_OPTIONS="--max-old-space-size=4096" npm run build
test -f .next/BUILD_ID
BUILD_ID="$(cat .next/BUILD_ID)"
echo "  → BUILD_ID: $BUILD_ID"

echo "📦 [2/7] Package build..."
BUILD_TAR="/tmp/yuan-academy-standalone-$BUILD_ID.tar"
RELEASE_DIR="/tmp/yuan-academy-standalone-$BUILD_ID"
rm -rf "$RELEASE_DIR"
mkdir -p "$RELEASE_DIR/.next"
cp -R .next/standalone/. "$RELEASE_DIR/"
cp -R .next/static "$RELEASE_DIR/.next/static"
rsync -a --exclude='uploads/' public/ "$RELEASE_DIR/public/"
test -f "$RELEASE_DIR/server.js"
tar cf "$BUILD_TAR" --no-xattr --no-acl --exclude='*.map' -C "$RELEASE_DIR" .
rm -rf "$RELEASE_DIR"

echo "📡 [3/7] Prepare inactive color directory..."
ssh "$SERVER" "mkdir -p '$TARGET_DIR'"

echo "📡 [4/7] Upload build package..."
scp "$BUILD_TAR" "$SERVER:/tmp/"
rm -f "$BUILD_TAR"

echo "💾 [5/7] Prepare inactive color on server..."
ssh "$SERVER" "
  set -e
  cd '$TARGET_DIR'

  find . -mindepth 1 \
    ! -name '.env.local' \
    ! -path './prisma' \
    ! -path './prisma/dev.db' \
    ! -path './data' \
    ! -path './data/private' \
    ! -path './public' \
    ! -path './public/uploads' \
    -exec rm -rf {} + 2>/dev/null || true

  if [ -f '$CURRENT_DIR/.env.local' ] && [ ! -e .env.local ]; then
    ln -s '$CURRENT_DIR/.env.local' .env.local
  fi
  mkdir -p prisma data
  if [ -f '$CURRENT_DIR/prisma/dev.db' ]; then
    if [ ! -e prisma/dev.db ] || [ \"\$(readlink -f prisma/dev.db 2>/dev/null || true)\" != \"\$(readlink -f '$CURRENT_DIR/prisma/dev.db')\" ]; then
      ln -sfn '$CURRENT_DIR/prisma/dev.db' prisma/dev.db
    fi
  fi
  if [ -d '$CURRENT_DIR/data/private' ]; then
    mkdir -p \$(dirname '$SHARED_PRIVATE_DIR')
    if [ ! -e '$SHARED_PRIVATE_DIR' ]; then
      cp -a '$CURRENT_DIR/data/private' '$SHARED_PRIVATE_DIR'
    fi
  fi
  if [ -d '$SHARED_PRIVATE_DIR' ]; then
    mkdir -p data
    if [ ! -e data/private ] || [ \"\$(readlink -f data/private 2>/dev/null || true)\" != \"\$(readlink -f '$SHARED_PRIVATE_DIR')\" ]; then
      rm -rf data/private
      ln -s '$SHARED_PRIVATE_DIR' data/private
    fi
  fi
  if [ -d '$CURRENT_DIR/public/uploads' ]; then
    mkdir -p public
    if [ ! -e public/uploads ] || [ \"\$(readlink -f public/uploads 2>/dev/null || true)\" != \"\$(readlink -f '$CURRENT_DIR/public/uploads')\" ]; then
      ln -sfn '$CURRENT_DIR/public/uploads' public/uploads
    fi
  fi

  mkdir -p .release-new
  tar xf '/tmp/yuan-academy-standalone-$BUILD_ID.tar' -C .release-new
  rm '/tmp/yuan-academy-standalone-$BUILD_ID.tar'
  test -f .release-new/server.js
  test \"\$(cat .release-new/.next/BUILD_ID)\" = '$BUILD_ID'
  cp -a .release-new/. .
  rm -rf .release-new

  cat > ecosystem.$TARGET_COLOR.config.js <<EOF
module.exports = {
  apps: [{
    name: '$TARGET_PM2',
    script: './server.js',
    cwd: '$TARGET_DIR',
    exec_mode: 'fork',
    instances: 1,
    max_memory_restart: '512M',
    env: {
      NODE_ENV: 'production',
      PORT: '$TARGET_PORT',
      HOSTNAME: '127.0.0.1',
      NODE_OPTIONS: '--max-old-space-size=512',
    },
    min_uptime: '5s',
    max_restarts: 10,
    restart_delay: 3000,
  }]
}
EOF
  pm2 delete '$TARGET_PM2' >/dev/null 2>&1 || true
  pm2 start ecosystem.$TARGET_COLOR.config.js --update-env
  pm2 save
"

echo "🔍 [6/7] Health-check inactive color..."
ssh "$SERVER" "
  set -e
  for i in 1 2 3 4 5 6 7 8 9 10; do
    CODE=\$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:$TARGET_PORT/login || true)
    echo \"target_login_\$i=\$CODE\"
    [ \"\$CODE\" = '200' ] && break
    sleep 2
  done
  test \"\$CODE\" = '200'
  test \"\$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:$TARGET_PORT/api/policies)\" = '401'
"

if [ "$MODE" = "deploy-only" ]; then
  echo "✅ Inactive color is ready on port $TARGET_PORT. Nginx was not switched."
  exit 0
fi

echo "🔁 [7/7] Switch nginx to $TARGET_COLOR..."
ssh "$SERVER" "
  set -e
  if ! nginx -T 2>/dev/null | grep -q 'yuan_academy_upstream'; then
    echo 'Nginx is not configured to use yuan_academy_upstream yet. Refusing to switch traffic.'
    echo 'Run the one-time blue/green nginx initialization first, then retry --activate.'
    exit 1
  fi
  ln -sfn '$TARGET_DIR' '$LIVE_DIR'
  cp '$NGINX_UPSTREAM_FILE' '$NGINX_UPSTREAM_FILE.before-$BUILD_ID' 2>/dev/null || true
  cat > '$NGINX_UPSTREAM_FILE' <<EOF
upstream yuan_academy_upstream {
    server 127.0.0.1:$TARGET_PORT;
}
EOF
  nginx -t
  nginx -s reload
  echo '$TARGET_COLOR' > '$STATE_FILE'
  if [ '$KEEP_OLD_AFTER_ACTIVATE' != '1' ]; then
    pm2 stop '$APP_NAME-$CURRENT_COLOR' >/dev/null 2>&1 || true
    pm2 save >/dev/null
  fi
"

PUBLIC_CODE="$(curl -s -o /dev/null -w '%{http_code}' "$DOMAIN/login" || true)"
if [ "$PUBLIC_CODE" != "200" ]; then
  echo "❌ Public health check failed after switch: $PUBLIC_CODE"
  exit 1
fi

echo "✅ Blue/green deploy complete: $TARGET_COLOR is live ($BUILD_ID). Old color remains running for fast rollback."
