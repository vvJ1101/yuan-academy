#!/bin/bash
set -e
cd /var/www/yuan-academy

echo "=== 1/5 Cleaning FTS shadow tables ==="
sqlite3 prisma/dev.db "DROP TABLE IF EXISTS document_fts; DROP TABLE IF EXISTS document_fts_data; DROP TABLE IF EXISTS document_fts_idx; DROP TABLE IF EXISTS document_fts_docsize; DROP TABLE IF EXISTS document_fts_content; DROP TABLE IF EXISTS document_fts_config;" 2>/dev/null || true

echo "=== 2/5 Prisma db push ==="
npx prisma db push --accept-data-loss

echo "=== 3/5 Seed ==="
npx tsx prisma/seed.ts

echo "=== 4/5 Rebuild FTS index ==="
npx tsx scripts/fts-migrate.ts

echo "=== 5/5 Restart PM2 ==="
pm2 reload yuan-academy

echo "=== 6/6 健康检查 ==="
sleep 2
for path in /login /internal/policy /internal/documents /api/auth/me; do
  code=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3001$path)
  if [ "$code" = "200" ] || [ "$code" = "401" ]; then
    echo "  ✅ $path → $code"
  else
    echo "  ❌ 异常: $path → $code"
    echo "  ⚠️  新版本可能有缺陷，检查后决定是否 rollback"
  fi
done
echo "Deploy done."
