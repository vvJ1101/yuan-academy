# YUAN Academy 权限矩阵

> 建立日期：2026-07-20  
> 用途：作为全系统“页面 / 按钮 / API / 数据范围”权限改造的基准表。  
> 原则：前端隐藏按钮只是体验优化，后端 API 必须做同等或更严格的权限校验。

## 0. 当前落地状态（2026-07-20）

已落地的后端守卫范围：

- 用户、公司、部门、文件夹、文件夹权限、角色、角色权限、角色数据权限、角色用户分配等管理类写接口。
- 文档上传、编辑、删除、替换、AI 解析、OCR、批量操作、原文件下载、打印、历史记录。
- FAQ 新建、编辑、删除。
- 订货政策查看、编辑、上传、解析、模板下载；品牌对接信息查看、编辑、上传、导出、模板下载。
- 搜索、AI 搜索、AI 对话、AI 推荐、AI 风险分析、首页推荐、Dashboard 热门文档、SOP 列表、收藏列表和收藏/取消收藏。
- 侧边栏、管理中心入口、文档按钮、品牌资料按钮已经按 `/api/user/permissions` 返回的统一权限做前端可见性控制。

仍需 Review 的边界：

- `/api/companies`、`/api/departments` 的 GET 当前仍偏“基础字典/筛选数据”定位；如果确认只允许组织管理页读取，可继续收紧为 `menu.admin.org`。
- 品牌对接信息内部还有 `brand-data-access.ts` 的字段级权限辅助函数，逻辑正确但后续建议继续收敛到统一 RBAC resolver，减少双轨维护。
- 需要补充数据权限自动化用例，验证不同角色在 `ALL / COMPANY / DEPARTMENT / DEPARTMENT_AND_CHILDREN / CUSTOM / SELF` 下的实际返回。

## 1. 权限分层

| 层级 | 作用 | 示例 |
|---|---|---|
| 菜单权限 | 控制能不能看到页面入口、左侧导航、管理中心卡片 | `menu.admin.users` |
| 操作权限 | 控制页面按钮和具体动作 | `user.delete` |
| API 守卫 | 防止绕过前端直接调用接口 | `DELETE /api/users` 检查 `user.delete` |
| 数据权限 | 控制这个权限作用在哪些数据上 | 全部、本公司、本部门、本部门及下级、本人、指定文件夹 |

## 2. 数据权限范围

| 范围 | 建议 key | 说明 |
|---|---|---|
| 全部数据 | `ALL` | 可查看/管理授权模块下全部数据，危险权限，需要二次确认 |
| 本公司 | `COMPANY` | 仅当前用户所属公司 |
| 本部门 | `DEPARTMENT` | 仅当前用户所属部门 |
| 本部门及下级 | `DEPARTMENT_AND_CHILDREN` | 当前部门和所有下级部门 |
| 本人 | `SELF` | 用户本人创建、上传、负责的数据 |
| 自定义 | `CUSTOM` | 指定公司、部门、文件夹、用户等范围 |

## 3. 总体命名规范

| 类型 | 命名格式 | 示例 |
|---|---|---|
| 菜单 | `menu.<module>[.<page>]` | `menu.admin.users` |
| 文档 | `document.<action>` | `document.upload` |
| 文件夹 | `folder.<action>` | `folder.permissionManage` |
| 用户 | `user.<action>` | `user.resetPassword` |
| 组织 | `org.<target><Action>` | `org.departmentDelete` |
| 角色 | `role.<action>` | `role.assignDataScope` |
| 品牌对接 | `brandContact.<action>` | `brandContact.viewMarketFields` |
| 订货政策 | `brandOrdering.<action>` | `brandOrdering.upload` |
| AI | `ai.<action>` | `ai.search` |

> 迁移注意：项目里现有 `menu.policyUpload`、`policy:upload` 等旧命名，短期保留兼容，不在第一阶段删除。

## 4. 页面权限矩阵

| 模块 | 页面 | 菜单权限 | 数据范围 | 备注 |
|---|---|---|---|---|
| 首页 | `/internal/dashboard` | `menu.dashboard` | 可见文档范围 | 统计卡片、推荐内容必须过滤到可见数据 |
| 最近访问 | `/internal/recent` | `menu.recent` | 可见文档范围 | 只显示用户有权访问的浏览记录 |
| 我的收藏 | `/internal/favorites` | `menu.favorites` | 可见文档范围 | 收藏列表仍需二次过滤文档权限 |
| 我的上传 / 文档中心 | `/internal/documents` | `menu.documents` | 文件夹/文档范围 | 文件夹树和文档列表按权限过滤 |
| 文档详情 | `/internal/documents/[id]` | `menu.documents` + 文档 view 权限 | 目标文档 | 无文档权限不得访问详情 |
| 旧文档详情 | `/internal/docs/[department]/[slug]` | `menu.documents` + 文档 view 权限 | 目标文档 | 旧入口也要走同一文档权限 |
| 搜索 | `/internal/search` | `menu.search` | 可见文档范围 | 搜索结果必须过滤权限 |
| SOP | `/internal/sop` | `menu.sop` | 可见 SOP 文档范围 | 分类为 SOP 的可见文档 |
| FAQ | `/internal/faq` | `menu.faq` | FAQ 范围 | 后续需要补 CRUD 按钮权限 |
| AI 助手 | `/internal/ai` | `menu.ai` | 可见文档范围 | AI 搜索、推荐、风险分析都不能越权引用文档 |
| 品牌资料 | `/internal/brand` | `menu.brand` | 品牌资料范围 | 父级入口 |
| 品牌对接信息 | `/internal/brand?type=contact` | `menu.brand.contact` | 字段范围 + 品牌资料范围 | 市场字段/完整字段分权 |
| 订货政策 | `/internal/policy` | `menu.brand.ordering` | 品牌资料范围 | 查看、编辑、上传、导出、删除分开控 |
| 订货政策上传 | `/internal/policy-upload` | `menu.brand.ordering` + `brandOrdering.upload` | 品牌资料范围 | 页面入口和上传按钮都需权限 |
| 管理中心 | `/internal/admin` | `menu.admin` | 管理数据范围 | 卡片入口需按子权限显示 |
| 用户管理 | `/internal/admin/users` | `menu.admin.users` | 可管理用户范围 | 用户增删改按钮独立控制 |
| 组织架构 | `/internal/admin/org` | `menu.admin.org` | 可管理组织范围 | 公司/部门操作分开控 |
| 文件夹管理 | `/internal/admin/folders` | `menu.admin.folders` | 文件夹范围 | 文件夹增删改和权限管理分开控 |
| 角色权限 | `/internal/admin/role-permissions` | `menu.admin.roles` | 角色管理范围 | 权限配置、数据权限、选择用户分开控 |
| 数据分析 | `/internal/admin/analytics` | `menu.admin.analytics` | 数据分析范围 | 汇总数据必须按范围过滤 |
| 审计日志 | `/internal/admin/audit-log` | `menu.admin.audit` + `audit.view` | 审计范围 | 默认建议仅超管/授权管理员 |
| 学习路径 | `/internal/admin/learning-paths` | `menu.admin.learningPaths` | 学习路径范围 | 新增、删除需独立按钮权限 |
| 系统设置 | `/internal/admin/settings` | `menu.admin.settings` + `settings.manage` | 全局 | 高危，建议默认仅超管 |

## 5. 按钮 / 操作权限矩阵

### 5.1 文档与知识空间

| 页面/组件 | 按钮/动作 | 权限点 | 数据范围 | 对应 API |
|---|---|---|---|---|
| `/internal/documents` | 上传文档 | `document.upload` + 目标文件夹 edit/admin | 目标文件夹 | `POST /api/documents` |
| `/internal/documents/[id]` | 编辑内容 | `document.edit` + 文档 edit/admin | 目标文档 | `PUT /api/documents/[id]` |
| 文档阅读器 | 保存 Markdown | `document.edit` + 文档 edit/admin | 目标文档 | `PUT /api/documents/[id]` |
| 文档阅读器 | 删除文档 | `document.delete` + 文档 delete/admin | 目标文档 | `DELETE /api/documents/[id]` |
| 文档阅读器 | 替换文件 | `document.replace` + 文档 edit/admin | 目标文档 | `POST /api/documents/[id]/replace` |
| 文档阅读器 | AI 解析 | `document.aiAnalyze` + 文档 edit/admin | 目标文档 | `POST /api/documents/[id]/analyze` |
| 文档阅读器 | OCR | `document.ocr` + 文档 edit/admin | 目标文档 | `POST /api/documents/[id]/ocr` |
| 文档文件接口 | 原文件下载 | `document.downloadOriginal` + 文档 edit/admin | 目标文档 | `GET /api/documents/[id]/file?variant=original` |
| 文档文件接口 | 打印 | `document.print` + 文档 edit/admin | 目标文档 | `GET /api/documents/[id]/file?purpose=print` |
| 文档列表 | 批量操作 | `document.batchManage` | 选中文档集合 | `POST /api/documents/batch` |
| 收藏按钮 | 收藏 | `favorite.create` + 文档 view | 目标文档 | `POST /api/bookmarks` |
| 收藏按钮 | 取消收藏 | `favorite.delete` + 本人收藏 | 目标收藏 | `DELETE /api/bookmarks` |
| 文件夹树 | 新建子文件夹 | `folder.create` + 父文件夹 admin | 父文件夹 | `POST /api/folders` |
| 文件夹树 | 重命名文件夹 | `folder.edit` + 文件夹 admin | 目标文件夹 | `PUT /api/folders` |
| 文件夹树 | 删除文件夹 | `folder.delete` + 文件夹 admin | 目标文件夹 | `DELETE /api/folders` |
| 文件夹树 | 设置文件夹权限 | `folder.permissionManage` + 文件夹 admin | 目标文件夹 | `POST/DELETE /api/folders/permissions` |

### 5.2 品牌资料

| 页面/组件 | 按钮/动作 | 权限点 | 数据范围 | 对应 API |
|---|---|---|---|---|
| 品牌资料 | 进入品牌资料 | `menu.brand` | 品牌资料范围 | `GET /api/brand-data` |
| 品牌对接信息 | 查看市场字段 | `brandContact.viewMarketFields` | 字段范围 | `GET /api/brand-data?type=contact` |
| 品牌对接信息 | 查看完整字段 | `brandContact.viewFullFields` | 字段范围 | `GET /api/brand-data?type=contact` |
| 品牌对接信息 | 网页编辑 | `brandContact.edit` + 完整字段查看 | 品牌资料范围 | `PUT /api/admin/brand-data` |
| 品牌对接信息 | 上传更新 | `brandContact.upload` + 完整字段查看 | 品牌资料范围 | `POST /api/admin/brand-data/upload` |
| 品牌对接信息 | 导出市场字段 | `brandContact.exportMarketFields` | 字段范围 | `GET /api/brand-data/export` |
| 品牌对接信息 | 导出完整字段 | `brandContact.exportFullFields` + 完整字段查看 | 字段范围 | `GET /api/brand-data/export` |
| 订货政策 | 查看 | `brandOrdering.view` | 品牌资料范围 | `GET /api/policies` |
| 订货政策 | 添加品牌 | `brandOrdering.edit` | 品牌资料范围 | `PUT /api/admin/policy` |
| 订货政策 | 编辑政策 | `brandOrdering.edit` | 品牌资料范围 | `PUT /api/admin/policy` |
| 订货政策 | 删除单个品牌 | `brandOrdering.delete` | 品牌资料范围 | `PUT /api/admin/policy` |
| 订货政策 | 删除全部 | `brandOrdering.deleteAll` | 品牌资料范围 | `PUT /api/admin/policy` |
| 订货政策 | 上传更新 | `brandOrdering.upload` | 品牌资料范围 | `POST /api/admin/policy-upload` |
| 订货政策 | 解析文本 | `brandOrdering.parse` | 品牌资料范围 | `POST /api/admin/policy/parse` |
| 订货政策 | 导出 | `brandOrdering.export` | 品牌资料范围 | 前端导出 / 后续 API |

### 5.3 用户、组织、角色

| 页面/组件 | 按钮/动作 | 权限点 | 数据范围 | 对应 API |
|---|---|---|---|---|
| 用户管理 | 查看用户列表 | `menu.admin.users` | 可管理用户范围 | `GET /api/users` |
| 用户管理 | 新建用户 | `user.create` | 可管理组织范围 | `POST /api/users` |
| 用户管理 | 编辑用户 | `user.edit` | 目标用户范围 | `PUT /api/users` |
| 用户管理 | 删除用户 | `user.delete` | 目标用户范围 | `DELETE /api/users` |
| 用户管理 | 批量删除用户 | `user.batchDelete` | 目标用户集合 | `POST /api/users/batch` |
| 用户管理 | 管理用户公司 | `user.assignCompany` | 目标用户范围 | `GET /api/users/[id]/companies`，后续写接口 |
| 组织架构 | 查看组织 | `menu.admin.org` | 可管理组织范围 | `GET /api/companies` / `GET /api/departments` |
| 组织架构 | 添加公司 | `org.companyCreate` | 可管理组织范围 | `POST /api/companies` |
| 组织架构 | 编辑公司 | `org.companyEdit` | 目标公司 | `PUT /api/companies` |
| 组织架构 | 删除公司 | `org.companyDelete` | 目标公司 | `DELETE /api/companies` |
| 组织架构 | 添加部门 | `org.departmentCreate` | 目标公司/上级部门 | `POST /api/departments` |
| 组织架构 | 编辑部门 | `org.departmentEdit` | 目标部门 | `PUT /api/departments` |
| 组织架构 | 删除部门 | `org.departmentDelete` | 目标部门 | `DELETE /api/departments` |
| 角色管理 | 查看角色 | `menu.admin.roles` | 角色管理范围 | `GET /api/admin/roles` |
| 角色管理 | 添加角色 | `role.create` | 角色管理范围 | `POST /api/admin/roles` |
| 角色管理 | 编辑角色 | `role.edit` | 目标角色 | `PUT /api/admin/roles/[id]` |
| 角色管理 | 删除角色 | `role.delete` | 目标角色 | `DELETE /api/admin/roles/[id]` |
| 角色管理 | 分配菜单/按钮权限 | `role.assignPermission` | 目标角色 | `PUT /api/admin/roles/[id]/permissions` |
| 角色管理 | 配置数据权限 | `role.assignDataScope` | 目标角色 | `PUT /api/admin/roles/[id]/dataScope` |
| 角色管理 | 选择用户 | `role.assignUser` | 目标角色和目标用户 | `POST /api/admin/roles/[id]/users` |
| 角色管理 | 移除用户 | `role.removeUser` | 目标角色和目标用户 | `DELETE /api/admin/roles/[id]/users/[userId]` |

### 5.4 管理中心、统计、审计、系统

| 页面/组件 | 按钮/动作 | 权限点 | 数据范围 | 对应 API |
|---|---|---|---|---|
| 管理中心 | 查看管理入口 | `menu.admin` | 管理范围 | 静态页面 + 子菜单权限 |
| 文件夹管理 | 查看文件夹管理 | `menu.admin.folders` | 文件夹范围 | `GET /api/folders` |
| 数据分析 | 查看统计分析 | `menu.admin.analytics` + `analytics.view` | 数据分析范围 | `GET /api/analytics/cross-dept` |
| 审计日志 | 查看日志 | `menu.admin.audit` + `audit.view` | 审计范围 | `GET /api/audit` |
| 审计日志 | 写入日志 | 系统内部 | 当前用户 | `POST /api/audit` |
| 学习路径 | 查看 | `menu.admin.learningPaths` | 学习路径范围 | `GET /api/learning-paths` |
| 学习路径 | 新建 | `learningPath.create` | 学习路径范围 | `POST /api/learning-paths` |
| 学习路径 | 编辑 | `learningPath.edit` | 目标学习路径 | `PUT /api/learning-paths/[id]` |
| 学习路径 | 删除 | `learningPath.delete` | 目标学习路径 | `DELETE /api/learning-paths/[id]` / `DELETE /api/learning-paths?id=` |
| 系统设置 | 查看/修改设置 | `menu.admin.settings` + `settings.manage` | 全局 | 现阶段多为只读统计，后续写入需单独加守卫 |

### 5.5 AI、搜索、FAQ

| 页面/组件 | 按钮/动作 | 权限点 | 数据范围 | 对应 API |
|---|---|---|---|---|
| 搜索页 | 全局搜索 | `menu.search` | 可见文档范围 | `GET /api/search` |
| AI 助手 | 对话 | `ai.chat` | 可见文档范围 | `POST /api/chat` |
| AI 搜索 | 搜索 | `ai.search` | 可见文档范围 | `POST /api/ai/search` |
| AI 推荐 | 推荐 | `ai.recommend` | 可见文档范围 | `GET /api/ai/recommend` |
| AI 风险分析 | 风险分析 | `ai.risk` | 可见文档范围 | `GET /api/ai/risk` |
| 首页推荐 | 推荐内容 | `menu.dashboard` | 可见文档范围 | `GET /api/recommendations/home` |
| FAQ | 查看 | `menu.faq` | FAQ 范围 | `GET /api/faq` |
| FAQ | 新建 | `faq.create` | FAQ 范围 | `POST /api/faq` |
| FAQ | 编辑 | `faq.edit` | 目标 FAQ | `PUT /api/faq/[id]` |
| FAQ | 删除 | `faq.delete` | 目标 FAQ | `DELETE /api/faq/[id]` |

### 5.6 账号与个人操作

| 页面/组件 | 按钮/动作 | 权限点 | 数据范围 | 对应 API |
|---|---|---|---|---|
| 登录页 | 登录 | 公开 | 当前账号 | `POST /api/auth/login` |
| 顶部菜单 | 退出登录 | 已登录 | 当前账号 | `GET /api/auth/logout` |
| 账号设置 | 修改密码 | `account.changePassword` 或本人 | 当前账号 | `POST /api/auth/change-password` |
| 当前用户 | 查看自己权限 | 已登录 | 当前账号 | `GET /api/auth/me` |
| 当前用户 | 兼容权限接口 | 已登录 | 当前账号 | `GET /api/user/permissions` |

## 6. API 守卫清单

### 6.1 必须优先加守卫的写接口

| API | 方法 | 建议权限 | 数据范围 | 当前风险等级 |
|---|---:|---|---|---|
| `/api/users` | `POST` | `user.create` | 可管理组织范围 | 高 |
| `/api/users` | `PUT` | `user.edit` | 目标用户范围 | 高 |
| `/api/users` | `DELETE` | `user.delete` | 目标用户范围 | 高 |
| `/api/users/batch` | `POST` | `user.batchDelete` | 目标用户集合 | 高 |
| `/api/companies` | `POST` | `org.companyCreate` | 组织范围 | 高 |
| `/api/companies` | `PUT` | `org.companyEdit` | 目标公司 | 高 |
| `/api/companies` | `DELETE` | `org.companyDelete` | 目标公司 | 高 |
| `/api/departments` | `POST` | `org.departmentCreate` | 目标公司/部门 | 高 |
| `/api/departments` | `PUT` | `org.departmentEdit` | 目标部门 | 高 |
| `/api/departments` | `DELETE` | `org.departmentDelete` | 目标部门 | 高 |
| `/api/admin/roles` | `POST` | `role.create` | 角色管理范围 | 高 |
| `/api/admin/roles/[id]` | `PUT` | `role.edit` | 目标角色 | 高 |
| `/api/admin/roles/[id]` | `DELETE` | `role.delete` | 目标角色 | 高 |
| `/api/admin/roles/[id]/permissions` | `PUT` | `role.assignPermission` | 目标角色 | 高 |
| `/api/admin/roles/[id]/dataScope` | `PUT` | `role.assignDataScope` | 目标角色 | 高 |
| `/api/admin/roles/[id]/users` | `POST` | `role.assignUser` | 目标用户 | 高 |
| `/api/admin/roles/[id]/users/[userId]` | `DELETE` | `role.removeUser` | 目标用户 | 高 |
| `/api/folders` | `POST` | `folder.create` | 父文件夹/公司 | 高 |
| `/api/folders` | `PUT` | `folder.edit` | 目标文件夹 | 高 |
| `/api/folders` | `DELETE` | `folder.delete` | 目标文件夹 | 高 |
| `/api/folders/permissions` | `POST` | `folder.permissionManage` | 目标文件夹 | 高 |
| `/api/folders/permissions` | `DELETE` | `folder.permissionManage` | 目标文件夹 | 高 |
| `/api/documents` | `POST` | `document.upload` | 目标文件夹 | 高 |
| `/api/documents/[id]` | `PUT` | `document.edit` | 目标文档 | 高 |
| `/api/documents/[id]` | `DELETE` | `document.delete` | 目标文档 | 高 |
| `/api/documents/[id]/replace` | `POST` | `document.replace` | 目标文档 | 高 |
| `/api/documents/[id]/analyze` | `POST` | `document.aiAnalyze` | 目标文档 | 中 |
| `/api/documents/[id]/ocr` | `POST` | `document.ocr` | 目标文档 | 中 |
| `/api/admin/policy` | `PUT` | `brandOrdering.edit` / `brandOrdering.delete` | 品牌资料范围 | 高 |
| `/api/admin/policy-upload` | `POST` | `brandOrdering.upload` | 品牌资料范围 | 高 |
| `/api/admin/policy/parse` | `POST` | `brandOrdering.parse` | 品牌资料范围 | 中 |
| `/api/admin/brand-data` | `PUT` | `brandContact.edit` | 完整字段范围 | 高 |
| `/api/admin/brand-data/upload` | `POST` | `brandContact.upload` | 完整字段范围 | 高 |
| `/api/faq` | `POST` | `faq.create` | FAQ 范围 | 中 |
| `/api/faq/[id]` | `PUT` | `faq.edit` | 目标 FAQ | 中 |
| `/api/faq/[id]` | `DELETE` | `faq.delete` | 目标 FAQ | 中 |
| `/api/learning-paths` | `POST` | `learningPath.create` | 学习路径范围 | 中 |
| `/api/learning-paths` | `DELETE` | `learningPath.delete` | 目标学习路径 | 中 |
| `/api/learning-paths/[id]` | `PUT` | `learningPath.edit` | 目标学习路径 | 中 |
| `/api/learning-paths/[id]` | `DELETE` | `learningPath.delete` | 目标学习路径 | 中 |
| `/api/bookmarks` | `POST` | `favorite.create` | 目标文档 + 本人 | 低 |
| `/api/bookmarks` | `DELETE` | `favorite.delete` | 本人收藏 | 低 |
| `/api/chat` | `POST` | `ai.chat` | 可见文档范围 | 中 |
| `/api/ai/search` | `POST` | `ai.search` | 可见文档范围 | 中 |

### 6.2 只读接口也必须过滤数据

| API | 方法 | 建议权限 | 数据过滤 |
|---|---:|---|---|
| `/api/dashboard` | `GET` | `menu.dashboard` | 可见文档范围 |
| `/api/workspace/activity` | `GET` | `menu.dashboard` 或 `menu.recent` | 可见文档范围 |
| `/api/recommendations/home` | `GET` | `menu.dashboard` | 可见文档范围 |
| `/api/search` | `GET` | `menu.search` | 可见文档范围 |
| `/api/sop` | `GET` | `menu.sop` | 可见 SOP 文档 |
| `/api/documents` | `GET` | `menu.documents` | 文件夹/文档范围 |
| `/api/documents/[id]` | `GET` | 文档 view | 目标文档 |
| `/api/documents/[id]/file` | `GET` | 文档 view / download / print | 目标文档 |
| `/api/documents/[id]/history` | `GET` | `document.historyView` + 文档 edit/admin | 目标文档 |
| `/api/documents/[id]/graph` | `GET` | 文档 view | 目标文档 |
| `/api/folders` | `GET` | `menu.documents` 或 `menu.admin.folders` | 文件夹范围 |
| `/api/users` | `GET` | `menu.admin.users` | 可管理用户范围 |
| `/api/companies` | `GET` | `menu.admin.org` 或后台需要 | 可见公司范围 |
| `/api/departments` | `GET` | `menu.admin.org` 或后台需要 | 可见部门范围 |
| `/api/admin/roles` | `GET` | `menu.admin.roles` | 角色管理范围 |
| `/api/admin/menus/tree` | `GET` | `role.assignPermission` | 权限管理范围 |
| `/api/admin/depts/tree` | `GET` | `role.assignDataScope` | 可管理组织范围 |
| `/api/audit` | `GET` | `audit.view` | 审计范围 |
| `/api/analytics/cross-dept` | `GET` | `analytics.view` | 数据分析范围 |
| `/api/brand-data` | `GET` | `brandContact.viewMarketFields` 或 `brandContact.viewFullFields` | 字段范围 |
| `/api/brand-data/export` | `GET` | 对应导出权限 | 字段范围 |
| `/api/brand-data/template` | `GET` | `brandContact.upload` | 完整字段范围 |
| `/api/policies` | `GET` | `brandOrdering.view` | 品牌资料范围 |
| `/api/policies/template` | `GET` | `brandOrdering.upload` | 品牌资料范围 |
| `/api/faq` | `GET` | `menu.faq` | FAQ 范围 |
| `/api/learning-paths` | `GET` | `menu.admin.learningPaths` | 学习路径范围 |
| `/api/ai/recommend` | `GET` | `ai.recommend` | 可见文档范围 |
| `/api/ai/risk` | `GET` | `ai.risk` | 可见文档范围 |

## 7. 角色模板建议

| 模板 | 默认菜单权限 | 默认操作权限 | 默认数据权限 |
|---|---|---|---|
| 超级管理员 | `*` | `*` | `ALL` |
| 普通查看 | 首页、最近、收藏、文档、SOP | 收藏、预览 | `SELF` 或本部门 |
| 文档编辑 | 文档、搜索、SOP、FAQ | 上传、编辑、AI 解析、收藏 | 本部门及下级或指定文件夹 |
| 文件夹管理员 | 文档、文件夹管理 | 文件夹增删改、权限管理 | 指定文件夹 |
| 用户管理员 | 管理中心、用户管理、组织架构 | 用户增删改、批量导入 | 本公司/指定部门 |
| 角色管理员 | 管理中心、角色管理 | 角色增删改、分配权限、数据权限、选择用户 | 指定角色/指定组织 |
| 品牌资料市场查看 | 品牌资料、品牌对接信息 | 查看市场字段、导出市场字段 | 品牌资料范围 |
| 品牌资料商品维护 | 品牌资料、品牌对接信息、订货政策 | 完整查看、编辑、上传、导出 | 品牌资料范围 |
| 审计/分析查看 | 管理中心、审计日志、数据分析 | 查看审计、查看统计 | 指定组织范围 |

## 8. 第一阶段改造优先级

1. 统一权限读取来源：`/api/auth/me`、`/api/user/permissions`、`getUserPermissions()`。
2. 保护高风险管理接口：用户、组织、角色、文件夹权限。
3. 去掉业务硬编码：订货政策、品牌资料。
4. 补齐权限树：让管理页面能勾选所有页面和按钮。
5. 页面按钮按权限显示：先做管理中心和品牌资料，再逐页扩展。
6. 数据范围联动查询：文档/文件夹优先，其次用户/组织/统计/品牌资料。

## 9. 待确认事项

| 问题 | 推荐答案 |
|---|---|
| 是否允许普通角色拥有“分配权限”？ | 默认不允许，仅超管或授权角色管理员 |
| 是否允许角色管理员分配比自己更高的权限？ | 不允许，后续需要加“权限上限” |
| 数据权限是否按角色叠加？ | 建议多个角色取并集，但危险权限需要显式授予 |
| 用户级权限覆盖是否做 UI？ | 第一阶段不做，保留底层能力 |
| 品牌资料是否需要按品牌分数据范围？ | 第一阶段先按字段权限；若品牌量增大，再加指定品牌范围 |
