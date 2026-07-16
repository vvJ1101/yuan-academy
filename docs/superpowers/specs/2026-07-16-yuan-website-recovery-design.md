# YUAN 官网本地备份与 502 恢复设计

## 目标

- 将服务器 `/var/www/yuan-website` 的可维护源码保存到本地 `/Users/vv/Documents/YUAN开发/yuan-website`。
- 恢复 `https://yuanshowroom.cn` 和 `https://www.yuanshowroom.cn`，使其不再返回 502。
- 不修改或中断 `yuan-academy` 学院系统。

## 已确认的根因

Nginx 已正确将官网域名反向代理到 `127.0.0.1:3002`，官网目录中也存在可用的 Next.js 构建产物和 PM2 配置。但是服务器的 3002 端口没有进程监听，PM2 当前列表及保存列表中也没有 `yuan-website`。因此 502 的直接原因是官网进程未运行，而不是域名、证书或 Nginx 配置错误。

## 执行设计

### 1. 本地备份与验证

使用 `rsync` 将服务器官网源码同步到本地目标目录，排除可再生成的 `node_modules` 和 `.next`，保留源码、公开资源、配置文件和锁文件。同步完成后检查文件清单，在本地安装锁定依赖并执行生产构建。

若本地目标目录在执行时已经存在，则停止并检查，不覆盖未知文件。

### 2. 线上恢复

保留当前 Nginx 配置不变。进入 `/var/www/yuan-website`，使用现有 `ecosystem.config.js` 启动名为 `yuan-website` 的 PM2 进程。只新增该官网进程，不重启或修改 `yuan-academy`。

### 3. 验证顺序

1. PM2 显示 `yuan-website` 为 `online`。
2. `127.0.0.1:3002` 返回有效 HTTP 响应。
3. `https://yuanshowroom.cn` 返回 200 或预期重定向，且不再返回 502。
4. `https://academy.yuanshowroom.cn/login` 仍返回正常响应。
5. 全部通过后执行 `pm2 save`，保存开机恢复状态。

## 错误处理

- 本地同步或构建失败：保留已下载源码用于排查，不改线上状态。
- 官网进程启动失败：读取该进程的 PM2 错误日志，定位根因后再决定是否重新构建；不连续叠加多个修复。
- 公网仍为 502：比较本机 3002 与 Nginx 两层响应，明确故障边界。
- 学院系统验证异常：立即停止官网恢复操作并检查资源占用。

## 回滚

若新增官网进程导致异常，执行 `pm2 delete yuan-website`，恢复到操作前状态。因为本方案不修改 Nginx、不替换服务器源码、不触碰学院进程，所以回滚不需要改代码或恢复配置。

## 完成标准

- 本地 `/Users/vv/Documents/YUAN开发/yuan-website` 包含完整可维护源码并能成功生产构建。
- 官网公网请求不再是 502。
- PM2 已保存官网进程。
- 学院系统保持正常。
