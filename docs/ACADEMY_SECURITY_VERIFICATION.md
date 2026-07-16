# Academy 安全与权限修复验证报告

日期：2026-07-16
分支：`codex/academy-security`

## 修复范围

- 会话 Cookie 仅接受使用 `JWT_SECRET` 签名且验证通过的 JWT。
- 拒绝篡改 JWT、过期 JWT 和旧版未签名 JSON Cookie。
- 所有 API 会等待服务端会话验证，不再同步解码载荷。
- 政策解析接口要求登录，并仅允许超级管理员或时胜品牌部部门管理员使用。
- 文件夹权限查询完成后再构建文档可见条件。
- 文档列表、SOP、搜索、仪表盘、首页推荐和 AI 读取入口均等待文档权限条件。

## 自动验证

```bash
npm run test:session
npm run test:policy-access
npm run test:permissions
npm run typecheck
npx prisma validate
npm run build
git diff --check
```

验证结果：

- 会话测试：4 项通过，0 项失败。
- 政策权限测试：5 项通过，0 项失败。
- 文档权限测试：5 项通过，0 项失败。
- TypeScript 检查通过。
- Prisma Schema 校验通过。
- Next.js 生产构建通过，共生成 45 个页面。
- Git 差异格式检查通过。

## 权限场景

| 场景 | 预期结果 |
|------|----------|
| 未登录访问受保护 API | 401，提示“请先登录” |
| 使用旧版 JSON Cookie | 401，不再兼容未签名会话 |
| 篡改 JWT 角色为超级管理员 | 401，签名验证失败 |
| viewer 调用政策解析 | 403，提示“无权解析订货政策” |
| 时胜品牌部 dept_admin 调用政策解析 | 允许 |
| 用户拥有显式文件夹权限 | 文件夹内文档进入可见查询范围 |
| 用户无部门且无文件夹权限 | 返回永不匹配条件 |
| super_admin 查询文档 | 不增加可见范围限制 |

## 部署提醒

- 部署环境必须设置非空 `JWT_SECRET`。
- 上线后旧会话会失效，用户需要重新登录一次。
- 建议在低峰期部署，并提前通知内部用户重新登录。

## 回滚

按风险从低到高，三个提交可以分别回滚：

```bash
git revert 1379946  # 文档权限异步修复
git revert 006deea  # 政策解析权限边界
git revert 027fbc2  # 会话签名强制验证
```

不建议回滚 `027fbc2`，因为这会恢复伪造 Cookie 风险。如果上线后仅出现文档显示问题，应只回滚 `1379946` 并保留会话安全修复。
