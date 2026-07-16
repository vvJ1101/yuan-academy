# 订货政策私有化设计

## 目标

将 YUAN Academy 的订货政策从可匿名访问的静态目录迁移到受登录保护的服务端存储，同时保持现有内部页面、编辑、上传、导出和模板下载能力。官网不再保存或公开任何订货政策副本。

## 使用者与权限

- 所有已登录 Academy 用户可以查看订货政策和下载上传模板。
- 编辑、删除和上传继续使用现有权限规则：`super_admin`，或时胜品牌部的 `dept_admin`。
- 未登录请求不得读取政策正文、更新时间、备份文件或 Excel 模板。

## 当前问题

政策文件目前存在于两个项目的 `public/` 目录。Next.js 会绕过页面中间件直接提供这些静态文件，因此任何人无需登录即可下载 JSON、备份和 Excel。Academy 页面虽然位于 `/internal`，其浏览器请求的数据源仍然是公开静态地址。

## 方案

### 私有存储

Academy 使用仓库根目录下的 `data/private/policies/` 作为文件式数据源：

- `policies.json`：当前政策列表。
- `policies.updated.json`：最后更新时间和更新人。
- `policies.backup.json`：最近一次写入前的备份。
- `订货政策-上传模板.xlsx`：登录后可下载的上传模板。

该目录不位于 `public/`，Next.js 不会将其映射为静态 URL。部署流程必须把该目录作为持久业务数据保留，不能只依赖 `.next` 构建产物。

### 读取 API

新增两个受保护端点：

- `GET /api/policies`：校验签名 JWT 后，读取政策和更新时间，返回 `{ policies, updatedAt, updatedBy }`。
- `GET /api/policies/template`：校验签名 JWT 后，以附件形式返回 Excel 模板。

未登录或会话无效时返回 `401` 和中文错误信息。文件缺失或内容损坏时返回明确的中文 `404` 或 `500`，不回退到公开目录。

### 写入与上传

现有 `PUT /api/admin/policy` 和 `POST /api/admin/policy-upload` 改为：

1. 使用签名校验后的异步 session 读取。
2. 使用现有 `canEditPolicy()` 权限规则。
3. 只读写 `data/private/policies/`。
4. 写入前保留 `policies.backup.json`。
5. 按项目守则记录审计事件。
6. 返回中文错误信息，并保持现有成功响应所需字段。

### 前端

`/internal/policy` 从 `GET /api/policies` 加载数据和更新时间，不再请求 `/showroom/data/*.json`。上传页面的模板链接改为 `/api/policies/template`。现有筛选、详情、编辑、删除、上传和导出交互保持不变。

### 公开副本清理

完成迁移并验证后，删除：

- 官网 `public/data/` 下的政策 JSON 和 Excel。
- 官网 `src/data/policies.json`。
- Academy `public/data/` 与 `public/showroom/data/` 下的政策、更新时间、备份和模板。
- Academy `src/data/policies.json`（确认无服务端引用后）。

清理只覆盖订货政策相关文件，不删除其他静态数据。部署时还需清除线上遗留文件和 CDN/Nginx 缓存。

## 数据迁移

以官网当前完整政策数据作为初始私有数据，但在写入前与 Academy 现有数据和备份核对品牌数量及更新时间。迁移使用复制后校验、最后删除公开副本的顺序，避免 Academy 页面出现空列表。

## 测试

采用测试先行：

- 未登录读取政策 API 返回 `401`。
- 有效登录用户读取政策成功。
- 未登录模板下载返回 `401`；有效登录用户获得正确附件。
- 无编辑权限用户写入返回 `403`。
- 有编辑权限用户写入私有文件、更新时间和备份，并记录审计。
- 上传接口执行相同的权限与私有写入约束。
- 前端不再引用任何公开政策 URL。
- 两个项目构建成功。
- 本地生产服务中旧静态 URL 返回 `404`。

## 错误处理与回滚

迁移前保留一份不在 Web 根目录内的原始数据备份。若新 API 出现问题，先恢复私有目录中的备份并回滚代码；不得通过重新公开 `public/` 文件来恢复服务。

## 非目标

- 本次不把政策迁入 SQLite。
- 不调整政策页面视觉或字段结构。
- 不改变登录体系和现有角色定义。
- 不在本次修改中自动部署生产环境。
