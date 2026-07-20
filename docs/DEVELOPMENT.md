# Academy 本地开发说明

## 基本环境

- 项目：YUAN Academy
- 技术栈：Next.js 14、SQLite、Prisma、Tailwind CSS
- 本地开发端口：`3000`
- 本地数据库：`prisma/dev.db`
- 文档私有文件目录：`data/private/documents/`

启动本地开发环境：

```bash
npm run dev -- --port 3000
```

打开：

```text
http://127.0.0.1:3000
```

测试账号见项目内部协作说明。不要把 `.env*`、SQLite 数据库、上传文件、服务器凭据或真实业务文件提交到 Git。

## 多格式文档阅读器

知识空间文档阅读器第一期支持：

- DOCX：保留原有正文阅读流程。
- PDF：通过受保护文件接口在线阅读。
- PPT/PPTX：上传后转换为 PDF，再进入 PDF 阅读器。
- XLS/XLSX：通过 Excel 只读阅读器在线预览。

权限规则：

- `view`：只能在线预览。
- `edit`、`delete`、`admin`：可以预览、下载、打印；遇到损坏文件时可以替换原文件。
- 所有文件读取都必须经过 `/api/documents/:id/file`，不能用公开静态路径绕过权限。

Excel 阅读器限制：

- 最多转换 20 个 Sheet。
- 每个 Sheet 最多显示 1,000 行、100 列。
- 单个工作簿最多渲染 100,000 个预览单元格。
- 不执行宏、不重新计算公式、不还原复杂图表。

## 本地验证命令

省用量关键验证：

```bash
npm run test:document-files
npm run test:file-access
npm run test:document-processor
npm run test:reader-state
npm run test:excel-preview
npm run typecheck
npx prisma validate
git diff --check
```

完整收尾验证再加：

```bash
npm run build
```

## 本地数据库

本分支创建过本地数据库备份：

```text
prisma/dev.db.before-document-viewer
```

该文件被 `.gitignore` 忽略，只用于本地回滚。不要把真实业务数据库或上传文件复制进仓库。

## 回滚

若只撤销本分支文档阅读器改动，按提交反向 revert；不要删除运行中的 `data/private/` 目录。

Excel 阅读器相关提交必须成对处理：

```bash
git revert 9bda103
git revert df8000a
```

如果已经合并到主分支，再按实际合并提交范围回滚，并先备份 `prisma/dev.db`。
