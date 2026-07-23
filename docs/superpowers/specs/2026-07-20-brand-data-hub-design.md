# 品牌资料中心设计

## 背景

Academy 现有“订货政策”和“政策上传”分别占用左侧导航入口。新增“品牌对接信息”后，如果继续新增导航，会让左侧越来越像功能清单，而不是业务入口。

本设计将“订货政策”和“品牌对接信息”合并到一个“品牌资料”入口中。页面内部用 Tab 切换资料类型，上传、导出、模板下载跟随当前资料类型变化。

## 使用场景

- **市场部**：查询品牌基础信息、合作折扣、含票情况、合作时间、售后/样衣地址和周末发货时间。不查看付款、开票、电话、邮箱等敏感信息。
- **商品部**：维护品牌对接信息完整表，包含联系人、电话、邮箱、付款、开票、售后和发货相关字段。
- **管理员**：配置角色权限，必要时导入、导出或回滚品牌资料数据。

成功标准：

- 用户从一个“品牌资料”入口进入，不再单独寻找“政策上传”。
- 市场部只能从接口拿到允许字段，不依赖前端隐藏。
- 商品部可以上传并维护完整 Excel。
- 后续新增品牌资料类型时，不需要再新增左侧主导航。

## 信息架构

左侧导航调整为：

```text
首页
最近访问
我的收藏
我的上传

品牌资料 ▾
  订货政策
  品牌对接信息

知识空间
  ...

管理中心
```

实际路由复用同一页面：

```text
/internal/brand?type=ordering
/internal/brand?type=contact
```

页面顶部显示：

```text
品牌资料
[订货政策] [品牌对接信息]

搜索品牌 / 国家 / 类目
右侧按钮：上传更新 ｜ 下载模板 ｜ 导出
```

按钮根据当前 Tab 和权限动态显示。

## 上传路径设计

“政策上传”不再作为左侧独立入口。上传功能合并到品牌资料页右上角。

在 `type=ordering` 时：

- 上传更新：上传订货政策 Excel。
- 下载模板：下载订货政策模板。
- 导出：导出订货政策数据。

在 `type=contact` 时：

- 上传更新：上传品牌对接信息 Excel。
- 下载模板：下载品牌对接信息模板。
- 导出：根据权限导出完整字段或市场部可见字段。

上传弹窗：

```text
上传更新

资料类型：品牌对接信息
上传文件：选择 Excel
更新方式：
  ○ 增量更新：同名品牌覆盖非空字段，新品牌新增
  ○ 全量替换：用这份 Excel 完整替换当前资料

[下载当前模板] [取消] [开始上传]
```

默认使用增量更新，避免空白单元格误清空旧数据。全量替换需要二次确认。

## 品牌对接信息 Excel 字段

当前样例文件：

- 文件名：`🟢 合作品牌对接信息-26版.xlsx`
- 工作表：`工作表2`
- 表头：第 1 行
- 规模：190 行、32 列
- 有数据品牌：约 21 个

字段映射：

| Excel 列 | 字段 | 建议字段名 | 权限分组 |
|---|---|---|---|
| A | 品牌名称 | brandName | 基础信息 |
| B | 商品部-负责人 | merchandisingOwner | 基础信息 |
| C | 品牌部-运营负责人 | brandOperationOwner | 基础信息 |
| D | 品牌国家 | country | 基础信息 |
| E | 类目 | category | 基础信息 |
| F | 主理人 | designer | 商品部完整字段 |
| G | 商品对接人 | contactPerson | 商品部完整字段 |
| H | 电话 | phone | 商品部完整字段 |
| I | 订单邮箱 | orderEmail | 商品部完整字段 |
| J | 抄送邮箱 | ccEmail | 商品部完整字段 |
| K | 付款对公信息 | publicPaymentInfo | 商品部完整字段 |
| L | 付款对私信息 | privatePaymentInfo | 商品部完整字段 |
| M | 支付宝信息 | alipayInfo | 商品部完整字段 |
| N | 开票信息 | invoiceInfo | 商品部完整字段 |
| O | 合作折扣 | cooperationDiscount | 市场部可见字段 |
| P | 是否含票 | taxIncluded | 市场部可见字段 |
| Q | 专票 | specialInvoice | 市场部可见字段 |
| R | 普票 | normalInvoice | 市场部可见字段 |
| S | 对私 | privatePaymentMethod | 商品部完整字段 |
| T | 合作时间 | cooperationTime | 市场部可见字段 |
| U | 售后地址 | afterSalesAddress | 市场部可见字段 |
| V | 样衣地址 | sampleAddress | 市场部可见字段 |
| W | 周末发货时间 | weekendShippingTime | 市场部可见字段 |

X-AF 为空列，导入时忽略。

## 字段权限设计

品牌对接信息使用固定字段视图，不做任意字段勾选。这样第一版更清楚，也降低权限配置错误风险。

基础信息字段，市场部和商品部都可见：

```text
品牌名称
商品部-负责人
品牌部-运营负责人
品牌国家
类目
```

市场部可见字段：

```text
品牌名称
商品部-负责人
品牌部-运营负责人
品牌国家
类目
合作折扣
是否含票
专票
普票
合作时间
售后地址
样衣地址
周末发货时间
```

商品部完整字段：

```text
全部 Excel 有效字段 A-W
```

敏感字段默认不返回给市场部：

```text
主理人
商品对接人
电话
订单邮箱
抄送邮箱
付款对公信息
付款对私信息
支付宝信息
开票信息
对私
```

## 权限点

菜单权限：

```text
menu.brand
menu.brand.ordering
menu.brand.contact
```

订货政策权限：

```text
brandOrdering.view
brandOrdering.edit
brandOrdering.upload
brandOrdering.export
brandOrdering.delete
```

品牌对接信息权限：

```text
brandContact.viewMarketFields
brandContact.viewFullFields
brandContact.edit
brandContact.upload
brandContact.exportMarketFields
brandContact.exportFullFields
brandContact.delete
```

默认角色配置：

| 角色/部门 | 权限 |
|---|---|
| 市场部 | `menu.brand`, `menu.brand.contact`, `brandContact.viewMarketFields`, `brandContact.exportMarketFields` |
| 商品部 | `menu.brand`, `menu.brand.contact`, `brandContact.viewMarketFields`, `brandContact.viewFullFields`, `brandContact.edit`, `brandContact.upload`, `brandContact.exportFullFields`, `brandContact.delete` |
| 超级管理员 | 全部权限 |

如果一个用户同时拥有市场部和商品部权限，后端按更高权限返回完整字段。

## 后端接口

数据读取：

```text
GET /api/brand-data?type=ordering
GET /api/brand-data?type=contact
```

上传：

```text
POST /api/admin/brand-data/upload
```

请求字段：

```ts
{
  type: 'ordering' | 'contact'
  mode: 'merge' | 'replace'
  file: File
}
```

编辑：

```text
PUT /api/admin/brand-data
DELETE /api/admin/brand-data/:id
```

模板与导出：

```text
GET /api/brand-data/template?type=ordering
GET /api/brand-data/template?type=contact
GET /api/brand-data/export?type=ordering
GET /api/brand-data/export?type=contact
```

后端返回字段规则：

- 有 `brandContact.viewFullFields`：返回完整字段。
- 只有 `brandContact.viewMarketFields`：只返回基础信息 + 市场部可见字段。
- 没有查看权限：返回 `403`。

上传、编辑、删除和完整导出必须分别校验对应权限点，不能只依赖页面入口权限。

## 数据存储

第一版沿用订货政策的私有文件存储方式，原因：

- 数据来源就是 Excel。
- 更新频率较低。
- 现有订货政策已经有私有 JSON/Excel 读写模式。
- 改动比迁入 SQLite 更小。

建议目录：

```text
data/private/brand-data/
  ordering/
    data.json
    updated.json
    template.xlsx
    backups/
  contact/
    data.json
    updated.json
    template.xlsx
    backups/
```

`data/private/brand-data` 不进入 Git，不放到 `public/`。

## 页面展示

市场部卡片：

```text
品牌名称
商品部-负责人 / 品牌部-运营负责人
品牌国家 · 类目

合作信息
- 合作折扣
- 是否含票
- 专票
- 普票
- 合作时间

仓库/发货
- 售后地址
- 样衣地址
- 周末发货时间
```

商品部卡片：

```text
品牌名称
商品部-负责人 / 品牌部-运营负责人
品牌国家 · 类目

基础信息
- 主理人
- 商品对接人
- 电话
- 订单邮箱
- 抄送邮箱

付款/开票
- 付款对公信息
- 付款对私信息
- 支付宝信息
- 开票信息
- 对私

合作信息
- 合作折扣
- 是否含票
- 专票
- 普票
- 合作时间

仓库/发货
- 售后地址
- 样衣地址
- 周末发货时间
```

长文本字段保留换行，并提供复制按钮。复制按钮只复制当前用户可见字段。

## 防错设计

- 上传前展示解析预览：新增数量、更新数量、跳过数量、缺失品牌名行数。
- 增量更新不使用空白单元格覆盖旧值。
- 全量替换必须二次确认。
- 上传成功前先写备份，再写新数据。
- 导入失败时保留当前数据不变。
- 所有写操作记录审计日志。

## 测试与验收

- 市场部账号访问品牌对接信息，只能看到基础信息和市场部可见字段。
- 市场部请求接口时，响应体不包含电话、邮箱、付款、开票、对私等敏感字段。
- 商品部账号可以看到完整字段。
- 商品部可以上传样例 Excel 并更新数据。
- 增量更新时，空白单元格不覆盖已有值。
- 全量替换前出现二次确认。
- 无权限用户访问接口返回 `403`。
- 导出文件只包含该用户有权查看的字段。

## 回滚方案

上线前备份：

```text
data/private/brand-data/
```

如果上传导入结果有问题：

1. 在服务器停止新的上传操作。
2. 从 `backups/` 复制上一版 `data.json` 覆盖当前文件。
3. 重启 Academy 服务或刷新页面缓存。
4. 用市场部和商品部账号分别抽查字段可见性。

如果页面改版有问题：

1. 回滚部署前 `.next` 备份。
2. 保留 `data/private/brand-data` 不动。
3. PM2 重启 `yuan-academy`。
