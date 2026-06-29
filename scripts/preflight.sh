#!/bin/bash
# 🛡 preflight.sh — 部署前完整性检查
# 在本地改完代码后运行: bash scripts/preflight.sh

set -e
cd "$(dirname "$0")/.."
ERR=0

print_result() {
  if [ "$1" = "0" ]; then echo "  ✅ $2"; else echo "  ❌ $2"; ((ERR++)); fi
}

echo "========================================="
echo "  YUAN Academy — 部署前预检"
echo "========================================="

# ── 1. 关键页面文件是否存在 ──
echo ""
echo "【1/4】页面文件完整性检查"
PAGES=(
  "src/app/page.tsx"
  "src/app/login/page.tsx"
  "src/app/internal/page.tsx"
  "src/app/internal/dashboard/page.tsx"
  "src/app/internal/documents/page.tsx"
  "src/app/internal/documents/[id]/page.tsx"
  "src/app/internal/policy/page.tsx"
  "src/app/internal/policy-upload/page.tsx"
  "src/app/internal/admin/page.tsx"
  "src/app/internal/admin/folders/page.tsx"
  "src/app/internal/admin/users/page.tsx"
  "src/app/internal/admin/org/page.tsx"
  "src/app/internal/admin/analytics/page.tsx"
  "src/app/internal/admin/settings/page.tsx"
  "src/app/internal/admin/learning-paths/page.tsx"
  "src/app/internal/faq/page.tsx"
  "src/app/internal/sop/page.tsx"
  "src/app/internal/search/page.tsx"
  "src/app/internal/recent/page.tsx"
  "src/app/internal/favorites/page.tsx"
  "src/app/internal/ai/page.tsx"
  "src/app/not-found.tsx"
  "src/middleware.ts"
)
for page in "${PAGES[@]}"; do
  [ -f "$page" ] && print_result 0 "$page" || print_result 1 "$page"
done

# ── 2. 核心 API 路由是否存在 ──
echo ""
echo "【2/4】API 路由完整性检查"
APIS=(
  "src/app/api/auth/login/route.ts"
  "src/app/api/auth/me/route.ts"
  "src/app/api/documents/route.ts"
  "src/app/api/documents/[id]/route.ts"
  "src/app/api/documents/[id]/history/route.ts"
  "src/app/api/documents/[id]/analyze/route.ts"
  "src/app/api/folders/route.ts"
  "src/app/api/companies/route.ts"
  "src/app/api/departments/route.ts"
  "src/app/api/users/route.ts"
  "src/app/api/dashboard/route.ts"
  "src/app/api/search/route.ts"
  "src/app/api/bookmarks/route.ts"
  "src/app/api/admin/policy/route.ts"
  "src/app/api/admin/policy-upload/route.ts"
  "src/app/api/ai/search/route.ts"
  "src/app/api/ai/recommend/route.ts"
  "src/app/api/ai/risk/route.ts"
)
for api in "${APIS[@]}"; do
  [ -f "$api" ] && print_result 0 "$api" || print_result 1 "$api"
done

# ── 3. 构建 ──
echo ""
echo "【3/4】构建检查"
if npx next build 2>&1 | tail -3; then
  print_result 0 "next build 通过"
else
  print_result 1 "next build 失败"
fi

# ── 4. 启动服务器验证路由响应 ──
echo ""
echo "【4/4】路由响应检查"
PORT=3999
npx next start -p $PORT > /dev/null 2>&1 &
PID=$!
sleep 4

for path in /login /internal/policy /internal/dashboard /api/auth/me; do
  code=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:$PORT$path 2>/dev/null || echo "000")
  if [ "$code" = "200" ] || [ "$code" = "401" ] || [ "$code" = "307" ]; then
    print_result 0 "$path → $code"
  else
    print_result 1 "$path → $code"
  fi
done

kill $PID 2>/dev/null
wait $PID 2>/dev/null

# ── 汇总 ──
echo ""
echo "========================================="
if [ "$ERR" = "0" ]; then
  echo "  ✅ 全部通过，可以部署"
else
  echo "  ❌ 发现 $ERR 个问题，修复后再部署"
fi
echo "========================================="
exit $ERR
