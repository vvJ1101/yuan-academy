#!/bin/bash
set -e
cd /var/www/yuan-academy
echo "=== 1/3 Cleaning cache ==="
rm -rf .next
echo "=== 2/3 Building ==="
npm run build
echo "=== 3/3 Restarting PM2 ==="
pm2 restart yuan-academy
echo "=== DONE ==="
