# Academy 多格式文档阅读器本地 QA

记录日期：2026-07-20
范围：本地开发环境，仅验证 Academy 知识空间文档阅读器；未推送 GitHub，未部署生产。

## 功能范围

- PDF：受保护在线阅读，支持页面导航、缩放、旋转、搜索、缩略图、全屏、编辑权限下载和打印。
- PPT/PPTX：上传后转换为 PDF，并复用 PDF 阅读器。
- XLS/XLSX：受保护只读预览，支持 Sheet 切换、首行固定、当前 Sheet 搜索和大表格截断提示。
- 替换上传：复用统一处理器，替换前保留历史快照，并继续执行权限和审计。
- 容量统计：统计实际原文件，避免把预览文件重复计算。

## 权限边界

- `view` 权限可以预览，不显示下载、打印、替换入口。
- `edit`、`delete`、`admin` 权限可以下载、打印，并在损坏文件状态下替换原文件。
- 文件直链必须经过 `/api/documents/:id/file` 权限检查；复制 URL 不能绕过服务端权限。
- 错误信息使用中文短提示，不向前端暴露本地路径、堆栈、Cookie 或密钥。

## 已执行自动验证

以下命令在本地 worktree `/Users/vv/Documents/YUAN开发/yuan-academy/.worktrees/academy-document-viewer` 执行：

| 命令 | 结果 |
| --- | --- |
| `npm run test:excel-preview` | 16/16 通过 |
| `npm run test:file-access` | 10/10 通过 |
| `npm run test:reader-state` | 28/28 通过 |
| `npm run test:document-files` | 8/8 通过 |
| `npm run test:document-processor` | 15/15 通过 |
| `npm run typecheck` | 通过 |
| `npx prisma validate` | 通过 |
| `git diff --check` | 通过 |
| `npm run build` | 通过，45/45 页面生成 |

## 依赖记录

- PDF/PPT 阅读：`react-pdf@10.2.0`，依赖 `pdfjs-dist@5.4.296`。
- Excel 阅读：官方 SheetJS tarball `xlsx@0.20.3`。
- `xlsx` 解析依赖只进入 Excel 动态阅读器块；登录页和仪表盘不加载 Excel 阅读器块。
- `xlsx@0.18.5` 的两项高危审计问题已通过升级到官方 `0.20.3` 消除。
- 浏览器 Excel 预览额外限制 25 MiB；超过该上限时保留原文件，但不在浏览器内解析。

## 本地样例要求

人工验收只使用合成文件，不使用公司真实资料：

- 一份原生 PDF。
- 一份 PPTX。
- 一份旧版 PPT。
- 一份多 Sheet XLSX。
- 一份损坏文件。

样例文件应放在 Git 忽略目录，例如 `用户素材/` 或临时目录，不提交到仓库。

## 已知限制

- PPT/PPTX 的页面还原质量取决于 LibreOffice 转换效果。
- Excel 第一版为只读预览，不支持在线编辑、图表完整还原、宏执行或公式重新计算。
- 超大 Excel 会按 20 Sheet、1,000 行、100 列、100,000 单元格上限截断展示。
- 第一阶段不做 AI 摘要、OCR、页码引用和全文跳页搜索。

## 回滚方案

- 若只撤销 Excel 阅读器，反向 revert `9bda103` 与 `df8000a`。
- 若撤销整个阅读器分支，按本分支提交顺序反向 revert，先备份 `prisma/dev.db`。
- 不要删除 `data/private/`，其中可能包含本地上传文件。
- 数据库本地备份路径：`prisma/dev.db.before-document-viewer`。
