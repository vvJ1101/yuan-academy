# 权限管理统一优化设计

> 日期：2026-07-20  
> 项目：YUAN Academy  
> 范围：全系统角色权限、菜单管理、按钮/操作权限、数据权限、品牌资料、订货政策、权限缓存与管理后台体验

## 一、背景问题

当前系统里存在两套权限来源：

1. `RolePermission / UserPermission`：由 `src/lib/permissions/rbac.ts` 读取，`/api/auth/me` 会返回这套权限。
2. `SysMenu / SysRoleMenu`：由角色权限管理页维护，`/api/user/permissions` 和部分业务接口直接读取这套权限。

这会造成三个实际风险：

- 管理员在页面里分配了权限，但部分接口不一定认。
- 前端菜单可能显示了入口，但后端接口可能按另一套规则拒绝。
- 部分旧功能仍按公司/部门名称写死，例如订货政策编辑判断。

## 二、目标

统一权限管理后，系统应该满足：

1. 管理员能管控全部页面入口、全部关键按钮、全部写入接口。
2. 权限管理同时包含“菜单管理”和“数据权限管理”，不是只勾菜单。
3. 管理员在权限管理页面勾选什么，后端接口就严格按这套权限执行。
4. 部门只用于“默认角色模板”和“数据范围”，不再作为品牌资料、订货政策等功能的硬编码判断。
5. 前端菜单显示、页面按钮显示、后端 API 鉴权使用同一套权限结果。
6. 权限修改后能及时生效，不需要重启服务或让用户反复登录。
7. 品牌资料权限支持“市场部只能看黄色列 + 五个基础字段，商品部可查看和维护完整表格”的业务规则，但实现上不绑定部门名称。

## 三、角色和成功标准

### 角色

- 超级管理员：拥有全部权限，可分配菜单权限、操作权限和数据权限。
- 角色管理员：如果未来开放，可管理指定范围内的角色权限；本轮先不扩展。
- 商品部维护人员：通过权限点获得品牌对接信息完整查看、网页编辑、上传、导出。
- 市场部查看人员：通过权限点获得品牌对接信息市场字段查看。
- 普通查看人员：只看到被授权的菜单和数据。

### 成功标准

- 非超级管理员如果没有 `brandContact.edit`，直接调用编辑接口也返回 403。
- 非超级管理员如果只有 `brandContact.viewMarketFields`，只能看到五个基础字段和市场字段。
- 订货政策上传不再要求“时胜 + 品牌部”，而是检查 `brandOrdering.upload`。
- 角色权限页面能看到全系统页面和按钮权限树。
- 角色权限页面能配置数据范围，例如全部数据、本公司、本部门、本部门及下级、本人、指定部门、指定文件夹。
- 修改角色权限后，同一用户刷新页面即可看到最新权限结果。

## 四、推荐方案

推荐采用“统一权限中心 + 菜单管理 + 数据权限结合管理”的方案。

### 方案说明

- 保留 `SysMenu / SysRoleMenu`，因为当前角色权限页面已经基于菜单树勾选，适合管理员使用。
- 将 `getUserPermissions()` 改为统一从 `SysUserRole -> SysRoleMenu -> SysMenu.permission` 计算权限。
- 保留 `UserPermission` 作为“用户级覆盖”能力，但本轮不做复杂 UI，只确保底层支持。
- 前端统一从 `/api/auth/me` 获取权限；逐步废弃 `/api/user/permissions`，或让它也调用同一个权限服务。
- 所有业务后端接口统一调用 `hasPermission()` / `hasAnyPermission()`。
- 数据权限从角色数据范围、文件夹权限、文档权限等来源汇总，形成统一 `dataScope`，业务查询必须使用它过滤数据。

### 为什么不推荐继续两套并存

两套并存短期看起来灵活，但会让后续每个功能都必须问：“它读的是哪套权限？”这对管理后台很危险。权限这种东西越简单越安全。

## 五、权限模型设计

全系统权限分四层：

```text
菜单权限 menu.*       控制页面入口和左侧导航
操作权限 action.*     控制按钮、写入动作、导出、删除、AI 解析等能力
资源权限 resource.*   控制具体资源类型的业务能力，例如品牌资料、订货政策、文档
数据权限 dataScope    控制能看到/能操作哪些数据
```

### 菜单管理

菜单管理负责维护系统有哪些页面入口。每个菜单项至少包含：

```ts
type ManagedMenu = {
  id: string
  name: string
  path: string | null
  permission: string
  type: '目录' | '菜单' | '按钮'
  parentId: string | null
  sort: number
  status: 'enabled' | 'disabled'
}
```

菜单权限只解决“能不能看到入口”，不等于能操作里面的数据。

### 操作权限

操作权限负责按钮和接口能力。命名规则：

```text
模块.资源.动作
```

例如：

```text
document.upload
document.edit
document.delete
folder.create
folder.permissionManage
user.create
role.assignPermission
brandContact.edit
brandOrdering.upload
```

页面按钮必须绑定操作权限；后端接口也必须检查同一个操作权限。

### 数据权限

数据权限负责“权限作用范围”。建议支持：

```text
ALL                 全部数据
COMPANY             本公司
DEPARTMENT          本部门
DEPARTMENT_AND_CHILDREN 本部门及下级
SELF                本人创建/负责的数据
CUSTOM_DEPARTMENTS  指定部门
CUSTOM_FOLDERS      指定文件夹
CUSTOM_USERS        指定用户
```

不同模块可以有不同数据范围：

- 文档/知识空间：按文件夹、文档、公司、部门、用户过滤。
- 用户管理：按组织范围过滤可管理用户。
- 统计分析：按数据范围聚合。
- 品牌资料：按字段可见性 + 角色数据范围控制。
- 订货政策：按品牌资料权限和数据范围控制。

### 页面、按钮、接口的关系

```text
页面入口：menu.*
按钮显示：action.* / resource.*
接口执行：action.* / resource.* + dataScope
列表查询：menu.* 或 view 权限 + dataScope
```

不能只靠隐藏按钮。即使用户手动请求 API，后端也必须按同一套权限拒绝。

## 六、全系统权限点设计

### 菜单权限

```text
menu.brand                         品牌资料入口
menu.brand.ordering                品牌资料 / 订货政策
menu.brand.contact                 品牌资料 / 品牌对接信息
menu.admin.permissions             管理中心 / 权限管理
```

完整菜单权限应覆盖：

```text
menu.dashboard                     首页
menu.recent                        最近访问
menu.favorites                     我的收藏
menu.documents                     我的上传 / 文档中心
menu.search                        全局搜索
menu.sop                           SOP 流程
menu.faq                           FAQ 管理
menu.brand                         品牌资料
menu.brand.ordering                订货政策
menu.brand.contact                 品牌对接信息
menu.admin                         管理中心
menu.admin.users                   用户管理
menu.admin.org                     组织架构
menu.admin.roles                   角色管理
menu.admin.permissions             权限管理
menu.admin.folders                 文件夹管理
menu.admin.analytics               数据分析
menu.admin.audit                   审计日志
menu.admin.settings                系统设置
menu.admin.learningPaths           学习路径
```

### 全局操作权限

```text
document.upload                    上传文档
document.edit                      编辑文档
document.delete                    删除文档
document.downloadOriginal          下载原文件
document.print                     打印文档
document.aiAnalyze                 AI 解析
document.permissionManage          文档权限管理

folder.create                      新建文件夹
folder.edit                        编辑文件夹
folder.delete                      删除文件夹
folder.permissionManage            文件夹权限管理

favorite.create                    收藏
favorite.delete                    取消收藏

user.create                        新建用户
user.edit                          编辑用户
user.delete                        删除用户
user.batchImport                   批量导入用户
user.resetPassword                 重置密码

org.companyCreate                  新建公司
org.companyEdit                    编辑公司
org.companyDelete                  删除公司
org.departmentCreate               新建部门
org.departmentEdit                 编辑部门
org.departmentDelete               删除部门

role.create                        新建角色
role.edit                          编辑角色
role.delete                        删除角色
role.assignPermission              分配菜单/按钮权限
role.assignDataScope               分配数据权限
role.assignUser                    选择用户

audit.view                         查看审计日志
analytics.view                     查看统计分析
settings.manage                    管理系统设置
```

### 订货政策权限

```text
brandOrdering.view                 查看订货政策
brandOrdering.edit                 网页编辑订货政策
brandOrdering.upload               上传更新订货政策
brandOrdering.export               导出订货政策
brandOrdering.delete               删除订货政策
```

### 品牌对接信息权限

```text
brandContact.viewMarketFields      查看市场字段
brandContact.viewFullFields        查看完整字段
brandContact.edit                  网页编辑
brandContact.upload                上传更新
brandContact.exportMarketFields    导出市场字段
brandContact.exportFullFields      导出完整字段
```

### 字段可见性规则

市场字段查看权限可见：

```text
品牌名称
商品部-负责人
品牌部-运营负责人
品牌国家
类目
所有 Excel 中标黄字段
```

完整字段查看权限可见：

```text
Excel 表格内所有字段
```

如果一个用户同时拥有市场字段和完整字段查看权限，以完整字段为准。

## 七、数据流设计

### 登录态

1. 用户登录后，session 只保存身份基础信息，例如用户 ID、角色、部门。
2. 页面需要权限时调用 `/api/auth/me`。
3. `/api/auth/me` 调用统一权限服务返回：

```ts
{
  permissions: string[]
  dataScope: {
    mode: 'ALL' | 'COMPANY' | 'DEPARTMENT' | 'DEPARTMENT_AND_CHILDREN' | 'SELF' | 'CUSTOM'
    companies: string[]
    departments: string[]
    folders: string[]
    users: string[]
  }
}
```

### 前端菜单

1. 左侧菜单读取 `/api/auth/me` 的 `permissions`。
2. 有 `menu.brand` 或任一 `menu.brand.*` 时显示“品牌资料”折叠菜单。
3. 有 `menu.brand.ordering` 时显示“订货政策”。
4. 有 `menu.brand.contact` 时显示“品牌对接信息”。

### 后端 API

后端接口不相信前端按钮状态，必须二次校验：

- `GET /api/brand-data?type=contact`：检查 `brandContact.viewMarketFields` 或 `brandContact.viewFullFields`。
- `PUT /api/admin/brand-data`：检查 `brandContact.edit`。
- `POST /api/admin/brand-data/upload`：检查 `brandContact.upload`。
- `PUT /api/admin/policy`：检查 `brandOrdering.edit`。
- `POST /api/admin/policy-upload`：检查 `brandOrdering.upload`。

## 八、管理后台优化设计

### 管理入口结构

建议把截图里的“分配权限”和“数据权限”整合成一个抽屉或分步弹窗：

```text
角色管理
  编辑角色
  权限配置
    1. 菜单与按钮权限
    2. 数据范围
    3. 成员用户
```

这样管理员配置一个角色时，不需要在多个入口之间来回跳。

### 菜单与按钮权限树结构

权限管理页面建议按业务分组，而不是只按路由分组：

```text
首页
  访问首页
  查看统计卡片

知识空间
  我的上传
    上传文档
    编辑文档
    删除文档
    下载原文件
    打印
    AI 解析
  文件夹管理
    新建文件夹
    编辑文件夹
    删除文件夹
    分配文件夹权限

品牌资料
  订货政策
    查看
    网页编辑
    上传更新
    导出
    删除
  品牌对接信息
    查看市场字段
    查看完整字段
    网页编辑
    上传更新
    导出市场字段
    导出完整字段

系统管理
  用户管理
    新建用户
    编辑用户
    删除用户
    批量导入
  角色管理
    新建角色
    编辑角色
    删除角色
    分配权限
    分配数据权限
    选择用户
  组织架构
    新建公司
    编辑公司
    删除公司
    新建部门
    编辑部门
    删除部门
  审计日志
    查看审计日志
```

### 数据权限配置

数据权限页签建议包含：

```text
数据范围：
  全部数据
  本公司
  本部门
  本部门及下级
  仅本人
  自定义

自定义范围：
  指定公司
  指定部门
  指定文件夹
  指定用户

适用模块：
  文档/知识空间
  用户管理
  统计分析
  品牌资料
```

最小可行版本先做“角色级数据范围”；用户级单独覆盖可以作为下一阶段。

### 角色模板

可提供默认模板，减少管理员勾选成本：

- 市场部查看模板：`menu.brand`、`menu.brand.contact`、`brandContact.viewMarketFields`。
- 商品部维护模板：`menu.brand`、`menu.brand.contact`、`brandContact.viewFullFields`、`brandContact.edit`、`brandContact.upload`、`brandContact.exportFullFields`。
- 品牌资料管理员模板：包含品牌对接信息和订货政策的查看、编辑、上传、导出权限。

模板只负责初始化勾选项，不参与后端判断。

### 防错交互

- 勾选 `brandContact.edit` 时，如果没有 `brandContact.viewFullFields`，前端提示“编辑完整表格需要完整查看权限”，并自动补勾完整查看。
- 勾选 `brandOrdering.upload` 时，如果没有 `menu.brand.ordering`，前端提示并自动补勾菜单入口。
- 勾选任何按钮权限时，如果没有对应菜单入口，提示并自动补勾父级菜单。
- 如果选择“全部数据”，必须二次确认，文案说明“该角色可查看授权模块下的全部数据”。
- 如果取消“角色管理 / 分配权限”，必须提示“该角色将无法再调整权限”。
- 删除、全部覆盖、批量重置类操作必须二次确认。

## 九、缓存策略

当前 `getUserPermissions()` 有内存缓存。权限统一后需要：

1. 角色权限保存成功后清理所有权限缓存。
2. 用户权限覆盖保存成功后清理对应用户缓存。
3. `/api/auth/me` 返回 `permissionsUpdatedAt`，前端可用于判断是否需要刷新。

最小可行方案：角色权限更新后直接 `clearPermissionCache()` 清空全部缓存。

## 十、测试策略

### 单元测试

- `getUserPermissions()` 能从 `SysRoleMenu` 合并权限。
- `UserPermission` 覆盖优先级高于角色权限。
- `*` 通配符拥有所有权限。
- `dataScope` 能正确解析全部、本公司、本部门、本部门及下级、本人、自定义范围。
- 没有权限时品牌对接信息返回 `null` 视图。

### API 测试

- 没有页面权限时访问页面数据接口返回 403 或空结果。
- 没有按钮权限时调用写入接口返回 403。
- 有按钮权限但数据范围不包含目标数据时返回 403。
- 无登录访问品牌资料 API 返回 401。
- 无 `brandContact.edit` 编辑品牌对接信息返回 403。
- 有 `brandContact.edit` 编辑成功，并写审计日志。
- 无 `brandOrdering.upload` 上传订货政策返回 403。

### 页面验证

- 没有 `menu.admin.users` 的角色看不到用户管理入口。
- 没有 `user.delete` 的角色看不到删除用户按钮，直接调用删除接口也失败。
- 有 `document.upload` 但目标文件夹无 edit/admin 数据权限时不能上传。
- 只有市场字段权限的账号，只看到允许字段。
- 有完整字段权限但无编辑权限，只能看不能改。
- 有编辑权限的账号能看到编辑按钮，保存后刷新仍存在。
- 修改角色权限后刷新页面立即生效。

## 十一、分阶段上线方案

### 阶段 1：权限盘点和命名统一

盘点所有 `/internal/*` 页面、所有按钮、所有 `POST/PUT/DELETE` API，形成权限清单。

### 阶段 2：统一权限读取

把 `getUserPermissions()` 统一到 `SysMenu / SysRoleMenu`，并保留 `UserPermission` 覆盖能力。

### 阶段 3：统一数据权限模型

把角色数据范围、文件夹权限、文档权限的边界说清楚，并输出统一 `dataScope`。

### 阶段 4：替换业务硬编码

替换订货政策、品牌资料等接口里的部门写死判断。

### 阶段 5：补齐全系统权限树和管理体验

补齐所有页面、按钮、接口对应的权限树，增加联动勾选提示和默认模板。

### 阶段 6：逐页接入权限守卫

从高风险模块开始：用户管理、角色权限、组织架构、文件夹管理、文档上传/删除、品牌资料、订货政策。

### 阶段 7：回归测试与开发环境部署

跑类型检查、构建、权限相关测试，在开发环境验证后再考虑生产部署。

## 十二、回滚方案

本次优化应拆成小提交：

1. 权限读取统一。
2. 业务接口迁移。
3. 权限树和管理页体验优化。
4. 文档和测试补齐。

如果上线后发现异常，可以按提交回滚；同时保留超级管理员 `*` 权限不变，确保管理入口不会被锁死。
