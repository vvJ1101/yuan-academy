# 订货政策数据安全

订货政策仅供内部员工、已登录用户或获授权的特定客户使用，不属于官网公开内容。

## 存储边界

- 生产运行数据保存在 `/var/www/yuan-academy-shared/data/private/policies/`，运行目录 `data/private` 只作为软链接指向共享目录。
- 本地开发仍可使用仓库内 `data/private/policies/`，但该目录中的运行时 JSON、元数据和备份文件不提交到 Git。
- Excel 上传模板保存在私有数据目录，由受保护接口提供下载。
- `public/data/`、`public/showroom/data/` 和 `src/data/` 不得保存订货政策副本。

## 访问控制

- `GET /api/policies`：需要有效登录会话。
- `GET /api/policies/template`：需要有效登录会话。
- 管理端政策写入与文件上传：需要具备政策编辑权限。
- 未登录请求返回 `401`，权限不足的写入请求返回 `403`。

## 运维检查

部署前运行：

```bash
npm test
npm run build
```

部署后应确认旧公开地址不返回政策内容，未登录访问政策接口返回 `401`，并检查 CDN 或反向代理缓存中不存在历史公开文件。`data/private/policies/` 不包含在 Git、`.next` 或 standalone 构建产物中，新服务器必须独立配置共享私有目录。

生产环境标准：

- 共享目录：`/var/www/yuan-academy-shared/data/private/policies/`
- 运行目录软链接：`/var/www/yuan-academy/data/private -> /var/www/yuan-academy-shared/data/private`
- 目录权限：`750`
- 文件权限：`640`
- 必需文件：`policies.json`、`policies.updated.json`、`policies.backup.json`、`订货政策-上传模板.xlsx`
- 部署脚本不得删除或覆盖 `/var/www/yuan-academy-shared/data/private/`。

当页面提示“订货政策数据不存在”时，先检查生产服务器共享私有目录和运行目录软链接；不得将数据复制回 `public/` 作为临时修复。

## 迁移记录

2026-07-16 将官网及 Academy 的公开政策副本移除，并将读取、模板下载和管理写入统一迁移到 Academy 的鉴权接口与私有存储。

### 2026-07-16 生产数据恢复

线上 `/internal/policy` 显示“订货政策数据不存在”。排查确认 `/var/www/yuan-academy/data/private/policies/` 未在部署时配置，而旧公开目录仍残留历史副本。

本次处理：

- 将本地已验证的 15 条政策同步至生产私有目录。
- 同步政策元数据、备份 JSON 和 Excel 上传模板。
- 将目录权限设为 `750`、文件权限设为 `640`。
- 将旧公开政策文件移出 Web 目录，保存到权限为 `700` 的服务器备份目录，未直接销毁。
- 未重启服务；政策读取接口按请求实时读取私有文件。

验证结果：

- 登录态 `GET /api/policies` 返回 `200` 和 15 条政策。
- 未登录 `GET /api/policies` 返回 `401`。
- 旧公开目录中不存在政策 JSON。
- 生产私有目录和文件权限符合上述标准。

此次故障属于运行数据配置缺失，不是官网或 Academy 页面代码回归。后续首次部署和服务器迁移必须把私有数据配置列为独立上线步骤。

### 2026-07-23 standalone 部署后数据恢复

线上切换为 standalone 轻量部署后，`/internal/policy` 再次出现订货政策数据为空。排查确认数据没有真正丢失，备份目录 `/var/backups/yuan-academy/blue-green-init-20260721-125143/code/data/private/policies/` 中仍有完整政策文件。

本次处理：

- 将备份中的私有数据恢复到 `/var/www/yuan-academy-shared/data/private/`。
- 将当前运行目录 `/var/www/yuan-academy/data/private` 改为指向共享目录的软链接。
- 更新部署脚本，后续颜色目录只挂载共享私有目录，不再把私有数据放进 standalone 包。
- 更新部署文档，明确共享私有目录为生产标准路径。

验证结果：

- `policies.json` 可读取 15 条政策。
- 公网 `/login` 返回 `200`。
- 未登录 `GET /api/policies` 返回 `401`。

详细设计与实施步骤见：

- [私有订货政策设计](superpowers/specs/2026-07-16-private-ordering-policies-design.md)
- [私有订货政策迁移计划](superpowers/plans/2026-07-16-private-ordering-policies.md)
