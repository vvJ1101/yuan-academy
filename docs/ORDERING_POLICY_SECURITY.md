# 订货政策数据安全

订货政策仅供内部员工、已登录用户或获授权的特定客户使用，不属于官网公开内容。

## 存储边界

- 运行数据保存在 `data/private/policies/`，该目录中的运行时 JSON、元数据和备份文件不提交到 Git。
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

部署后应确认旧公开地址返回 `404`，未登录访问政策接口返回 `401`，并检查 CDN 或反向代理缓存中不存在历史公开文件。

## 迁移记录

2026-07-16 将官网及 Academy 的公开政策副本移除，并将读取、模板下载和管理写入统一迁移到 Academy 的鉴权接口与私有存储。

详细设计与实施步骤见：

- [私有订货政策设计](superpowers/specs/2026-07-16-private-ordering-policies-design.md)
- [私有订货政策迁移计划](superpowers/plans/2026-07-16-private-ordering-policies.md)
