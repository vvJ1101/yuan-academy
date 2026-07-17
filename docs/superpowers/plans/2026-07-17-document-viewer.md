# Academy Document Viewer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build secure, friendly local-development readers for PDF/PPT and Excel while repairing multi-format upload, replacement, download, and storage accounting.

**Architecture:** A typed file-service layer owns validation, paths, metadata, conversion, and protected streaming. PDF and converted PPT share a dynamically loaded `react-pdf` reader; Excel uses the existing `xlsx` package in a separate client reader. Route handlers remain permission boundaries, while pure helpers carry most behavior and are covered by Node tests.

**Tech Stack:** Next.js 14 App Router, React 18, TypeScript 5, Prisma 5, SQLite, Tailwind CSS, Mozilla PDF.js through `react-pdf`, existing `xlsx`, LibreOffice CLI.

## Global Constraints

- Work only in `.worktrees/academy-document-viewer` on `codex/academy-document-viewer`.
- Deploy only to the local development environment; do not push GitHub or deploy production.
- Preserve the copied pre-existing document-center changes and commit only reviewed feature files.
- Do not modify `src/lib/parser.ts`, `src/lib/prompts/*.ts`, `scripts/fts-migrate.ts`, or `src/types/dashboard.ts`.
- `view` can preview; `edit`, `delete`, and `admin` can preview, download, and print.
- Every POST/PUT/DELETE path must enforce permission, create required history, and call `audit.ts`.
- All user-facing failures are concise Chinese; failed form submissions retain entered values.
- Do not add a dependency until its purpose, alternative, license, installed size, and build-size effect are reported.
- Use test-first implementation and make one independently reversible commit per task.

---

### Task 1: File metadata model and validation service

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `src/lib/document-files.ts`
- Create: `src/lib/__tests__/document-files.test.ts`
- Modify: `package.json`

**Interfaces:**
- Produces: `DocumentFileType`, `ProcessingStatus`, `ValidatedUpload`, `validateUploadFile()`, `getOriginalFilePath()`, `getPreviewFilePath()`, `canDownloadPermission()`.
- Produces Document fields: `originalFileName`, `fileType`, `mimeType`, `fileSize`, `processingStatus`, `processingError`, `previewPath`.

- [ ] **Step 1: Copy the local database for isolated development**

Run:

```bash
cp ../../prisma/dev.db prisma/dev.db
cp prisma/dev.db prisma/dev.db.before-document-viewer
```

Expected: both ignored SQLite files exist only in the isolated worktree; the main workspace database is unchanged.

- [ ] **Step 2: Write failing validation and permission tests**

Cover PDF/PPT/PPTX/XLS/XLSX/DOCX acceptance, executable/ZIP rejection for online processing, MIME mismatch rejection, 100 MB limit, safe extension normalization, path construction, and download permission levels.

Representative assertions:

```ts
assert.equal(validateUploadFile({ name: '培训.pptx', type: PPTX_MIME, size: 1024 }).fileType, 'pptx')
assert.throws(() => validateUploadFile({ name: 'attack.exe', type: 'application/octet-stream', size: 10 }), /不支持/)
assert.equal(canDownloadPermission('view'), false)
assert.equal(canDownloadPermission('edit'), true)
```

Run: `npm run test:document-files`

Expected: FAIL because `document-files.ts` and the script do not exist.

- [ ] **Step 3: Add nullable metadata fields with safe defaults**

Add to `Document`:

```prisma
originalFileName String   @default("")
fileType         String   @default("docx")
mimeType         String   @default("application/octet-stream")
fileSize         Int      @default(0)
processingStatus String   @default("ready")
processingError  String?
previewPath      String?
```

Run: `npx prisma format && npx prisma db push && npx prisma generate`

Expected: local schema updates without deleting existing data.

- [ ] **Step 4: Implement the pure file service**

Use explicit extension/MIME maps, `basename()` for displayed names, `join(process.cwd(), 'data', 'private', 'documents', docId)` for new private storage, and a 100 MB maximum. Return Chinese validation errors and never accept a caller-provided filesystem path.

- [ ] **Step 5: Add test and typecheck scripts**

Add:

```json
"typecheck": "tsc --noEmit --pretty false",
"test:document-files": "TS_NODE_COMPILER_OPTIONS='{\"module\":\"CommonJS\",\"moduleResolution\":\"Node\"}' node --test -r ts-node/register src/lib/__tests__/document-files.test.ts"
```

- [ ] **Step 6: Verify and commit**

Run: `npm run test:document-files && npm run typecheck && npx prisma validate && git diff --check`

Expected: tests pass, TypeScript and Prisma exit 0, no whitespace errors in task files.

Commit: `git commit -m "feat: add document file metadata service"`

---

### Task 2: Secure preview/download streaming API

**Files:**
- Create: `src/lib/document-file-access.ts`
- Create: `src/lib/__tests__/document-file-access.test.ts`
- Create: `src/app/api/documents/[id]/file/route.ts`
- Modify: `src/app/api/documents/[id]/download/route.ts`
- Modify: `src/lib/audit.ts`
- Modify: `package.json`

**Interfaces:**
- Consumes: metadata/path helpers from Task 1.
- Produces: `parseByteRange(rangeHeader, size)`, `buildFileResponseHeaders()`, `resolveDocumentFileAccess()`.
- Produces API: `GET /api/documents/:id/file?variant=preview|original&disposition=inline|attachment&purpose=read|print`.

- [ ] **Step 1: Write failing Range and access tests**

Cover no Range, `bytes=0-999`, suffix range, invalid range, viewer preview, viewer download denial, editor download, missing file, and unknown variant.

Representative assertion:

```ts
assert.deepEqual(parseByteRange('bytes=0-999', 5000), { start: 0, end: 999 })
assert.equal(resolveDocumentFileAccess({ permission: 'view', variant: 'original' }).allowed, false)
```

Run: `npm run test:file-access`

Expected: FAIL because access helpers do not exist.

- [ ] **Step 2: Implement streaming helpers**

Return 206 with `Content-Range`, `Accept-Ranges: bytes`, accurate `Content-Length`, a validated MIME, and `Cache-Control: private, no-store`. Reject multi-range requests in the first version with 416.

- [ ] **Step 3: Implement the protected route**

Handler order: verified session → Document lookup → `getDocumentPermission` → variant/purpose permission → file existence → Range streaming → audit. Preview accepts `view`; for Excel, preview intentionally streams the original workbook inline because rendering occurs in the protected client reader. Original attachment and `purpose=print` require `edit` or stronger. Return Chinese 401/403/404/416 responses.

- [ ] **Step 4: Redirect the legacy download endpoint through the same service**

Remove the hard-coded `original.docx` path. Preserve the old URL contract while enforcing the stronger `edit` rule and returning the actual filename/MIME.

- [ ] **Step 5: Extend audit actions without exposing paths**

Add `preview`, `download`, and `print` to the audit action union. Store only user ID, document ID, and action; do not log filenames, local paths, cookies, or credentials.

- [ ] **Step 6: Verify and commit**

Run: `npm run test:file-access && npm run test:document-files && npm run typecheck && npm run build`

Expected: all commands pass and the new route appears in the Next route list.

Commit: `git commit -m "feat: protect document preview and download"`

---

### Task 3: Unified upload, conversion, replacement, and storage accounting

**Files:**
- Create: `src/lib/document-processor.ts`
- Create: `src/lib/__tests__/document-processor.test.ts`
- Create: `scripts/migrate-document-files-private.ts`
- Modify: `src/lib/ppt-converter.ts`
- Modify: `src/app/api/documents/route.ts`
- Modify: `src/app/api/documents/[id]/replace/route.ts`
- Modify: `src/app/api/folders/route.ts`
- Modify: `src/lib/audit.ts`

**Interfaces:**
- Consumes: `ValidatedUpload` and private paths from Task 1.
- Produces: `processDocumentFile({ documentId, buffer, upload }): Promise<ProcessResult>`.
- Produces: `calculateDocumentStorage(root): StorageSummary`.

- [ ] **Step 1: Write failing processor tests**

Use temporary directories. Cover PDF ready without conversion, PPTX conversion success, old PPT retaining `.ppt`, LibreOffice missing → failed, original write failure → failed, and storage totals across DOCX/PDF/PPTX/XLSX.

Run: `npm run test:document-processor`

Expected: FAIL because the processor does not exist.

- [ ] **Step 2: Make PPT conversion extension-aware**

Change the converter signature to:

```ts
convertPptToPdf(buffer: Buffer, extension: 'ppt' | 'pptx', docId: string, docDir: string): Promise<ConversionResult>
```

Build `input.${extension}` and locate the matching generated PDF. Sanitize logged errors and retain the 120-second timeout.

- [ ] **Step 3: Implement one processor for upload and replacement**

Write the original file first, update metadata, then produce preview. On failure, keep the original, set `processingStatus='failed'`, store a short Chinese `processingError`, and never return a filesystem path to the client.

- [ ] **Step 4: Refactor new upload**

Require a session before reading multipart data, validate folder upload permission, validate file, create `processing` metadata, call the processor, create audiences, and record `upload`. If the database create succeeds but the original write fails, delete the incomplete Document and related audiences.

- [ ] **Step 5: Refactor replacement upload**

Check document `edit` permission, snapshot the current descriptive content in `DocumentHistory`, remove old derived preview only after the new original is safely staged, call the same processor, and record `edit`. Do not import or call the protected DOCX parser for PPT/PDF/Excel.

- [ ] **Step 6: Fix capacity calculation**

Sum each document's actual stored original file. Keep the 100 GB display ceiling but return exact `usedBytes`; ignore preview derivatives to avoid double counting.

- [ ] **Step 7: Add a dry-run-first legacy file migration**

Create `scripts/migrate-document-files-private.ts` with `--dry-run` as the default and `--apply` as the only write mode. It must discover legacy `public/uploads/documents/<id>/original.*` and `output.pdf`, validate the Document ID, copy to `data/private/documents/<id>/`, update metadata only after checksums match, and leave the public copy untouched until the full migration verifies. A second explicit `--remove-public-after-verify` mode may remove verified public copies; it must refuse removal when any checksum or database update failed.

Run: `npx tsx scripts/migrate-document-files-private.ts --dry-run`

Expected: a count and byte summary with no filesystem or database changes.

- [ ] **Step 8: Verify and commit**

Run: `npm run test:document-processor && npm run test:document-files && npm run typecheck && npm run build`

Expected: all tests and build pass.

Commit: `git commit -m "fix: unify multi-format document processing"`

---

### Task 4: Install and configure the PDF rendering dependency

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `next.config.js`
- Create: `src/components/internal/pdf-reader/pdf-worker.ts`
- Create: `src/components/internal/pdf-reader/reader-state.ts`
- Create: `src/components/internal/pdf-reader/reader-state.test.ts`

**Interfaces:**
- Produces: a client-only PDF.js worker configuration.
- Produces: `readerReducer`, `clampPage`, `nextScale`, and state types used by Task 5.

- [ ] **Step 1: Measure and report dependency impact before installation**

Run:

```bash
npm view react-pdf version license peerDependencies dist.unpackedSize
npm view pdfjs-dist version license dist.unpackedSize
du -sh node_modules
```

Report purpose, direct PDF.js alternative, MIT/Apache licensing, installed-size estimate, and the requirement to lazy-load. Stop for approval if the resolved version does not support React 18 or Next.js 14.

- [ ] **Step 2: Install pinned compatible versions**

Run: `npm install --save-exact react-pdf@10.2.0 pdfjs-dist@5.4.296`

Expected: package and lockfile update without unrelated dependency upgrades. React-PDF 10.2.0 declares React 18 support and directly depends on PDF.js 5.4.296; if the registry resolves different metadata, stop rather than changing versions silently.

- [ ] **Step 3: Write failing reader-state tests**

Cover page clamping, next/previous navigation, 50–300% zoom boundaries, rotation in 90-degree increments, and search result index cycling.

Run: `npm run test:reader-state`

Expected: FAIL because state helpers do not exist.

- [ ] **Step 4: Implement worker and state configuration**

Configure `pdfjs.GlobalWorkerOptions.workerSrc` in the same client module that renders `Document`/`Page`. Do not use an external CDN. Keep state logic dependency-free and pure.

- [ ] **Step 5: Measure baseline build impact**

Run: `npm run build` and record the document-detail route first-load size before Task 5. Verify other routes do not include the PDF viewer chunk.

- [ ] **Step 6: Commit**

Commit: `git commit -m "build: add lazy PDF rendering foundation"`

---

### Task 5: Academy PDF/PPT reader

**Files:**
- Create: `src/components/internal/pdf-reader/pdf-reader.tsx`
- Create: `src/components/internal/pdf-reader/pdf-toolbar.tsx`
- Create: `src/components/internal/pdf-reader/pdf-thumbnails.tsx`
- Create: `src/components/internal/pdf-reader/pdf-search.tsx`
- Modify: `src/app/internal/documents/[id]/page.tsx`

**Interfaces:**
- Consumes: `/api/documents/:id/file?variant=preview` and reader state from Task 4.
- Props: `{ documentId: string; title: string; permission: Permission; fileType: string }`.
- Produces: responsive, client-only PDF/PPT reader.

- [ ] **Step 1: Create a component behavior checklist before JSX**

Write assertions in `reader-state.test.ts` for every toolbar transition and add an explicit permission test mapping `view` to `{ download:false, print:false }` and `edit` to both true.

Run: `npm run test:reader-state`

Expected: new permission assertion fails.

- [ ] **Step 2: Implement the minimal single-page reader**

Dynamically import with `ssr:false`. Render one current page plus adjacent-page prefetch, Chinese loading/error states, and fit-to-width on resize. Fetch through the protected API with same-origin cookies.

- [ ] **Step 3: Add responsive navigation**

Implement 44px previous/next controls, page input, total pages, zoom, rotate, search, fullscreen, and a desktop thumbnail sidebar. On mobile, open thumbnails in a drawer and keep essential navigation in a compact toolbar.

- [ ] **Step 4: Enforce download and print UX**

Only render these controls when `permission` is `edit`, `delete`, or `admin`. Download calls `variant=original&disposition=attachment`; print calls the protected preview response with `purpose=print`, which enforces edit permission and records a print audit event. A 403 displays “你没有下载或打印权限”.

- [ ] **Step 5: Replace iframe/detail-page branching**

PDF and PPT/PPTX with `ready` status render `PdfReader`; `processing` shows progress; `failed` shows a retry/contact-admin state. Preserve the existing Markdown reader for DOCX and unsupported attachments.

- [ ] **Step 6: Verify and commit**

Run: `npm run test:reader-state && npm run typecheck && npm run build`

Expected: tests and build pass; document-detail viewer is lazy-loaded; dashboard and login bundles do not gain the viewer chunk.

Commit: `git commit -m "feat: add Academy PDF and PPT reader"`

---

### Task 6: Excel reader

**Files:**
- Create: `src/lib/excel-preview.ts`
- Create: `src/lib/__tests__/excel-preview.test.ts`
- Create: `src/components/internal/excel-reader.tsx`
- Modify: `src/app/internal/documents/[id]/page.tsx`
- Modify: `package.json`

**Interfaces:**
- Produces: `workbookToPreview(buffer, maxRows=1000): WorkbookPreview`.
- Props: `{ documentId: string; title: string; permission: Permission }`.

- [ ] **Step 1: Write failing workbook tests**

Generate in-memory XLSX fixtures using the existing package. Cover multiple Sheets, empty Sheet, Unicode cells, 1,001 rows truncating to 1,000, and corrupt input returning a Chinese error.

Run: `npm run test:excel-preview`

Expected: FAIL because the preview helper does not exist.

- [ ] **Step 2: Implement bounded workbook conversion**

Return sheet names, rectangular string matrices, original row counts, and `truncated`. Do not evaluate macros or external links. Convert dates and numbers to display strings consistently.

- [ ] **Step 3: Implement the client reader**

Fetch `variant=preview&disposition=inline` with `view` access; the server maps Excel preview to the original workbook without granting attachment download. Switch Sheets, render a sticky first row, provide current-Sheet search and match count, and constrain both axes with `overflow-auto`. Show the 1,000-row notice when truncated.

- [ ] **Step 4: Apply download permission and detail routing**

Only editors see download. XLS/XLSX ready documents render `ExcelReader`; failures preserve the document page and show a retry/contact-admin message.

- [ ] **Step 5: Verify and commit**

Run: `npm run test:excel-preview && npm run typecheck && npm run build`

Expected: tests and build pass.

Commit: `git commit -m "feat: add read-only Excel viewer"`

---

### Task 7: Local integration, visual QA, and documentation

**Files:**
- Modify: `docs/DEVELOPMENT.md`
- Create: `docs/DOCUMENT_VIEWER_LOCAL_QA.md`
- Modify: `docs/superpowers/specs/2026-07-17-document-viewer-design.md` only to record confirmed deviations.

**Interfaces:**
- Consumes: Tasks 1–6.
- Produces: reproducible local setup, QA evidence, and rollback instructions.

- [ ] **Step 1: Prepare non-sensitive sample fixtures**

Use synthetic files only: one PPTX, one legacy PPT, one native PDF, one multi-Sheet XLSX, and one corrupt file. Keep fixtures under an ignored local directory and do not copy company documents into the repository.

- [ ] **Step 2: Start local development**

Run: `npm run dev -- --port 3000`

Expected: Academy opens locally and no production process is changed.

- [ ] **Step 3: Perform role and reader QA**

Verify desktop and mobile widths, thumbnail navigation, page controls, search, zoom, rotate, fullscreen, Sheet switching, sticky header, row cap, viewer denial for download/print, editor success, copied URL denial, replacement upload, conversion failure, and accurate storage totals.

- [ ] **Step 4: Run final automated verification**

Run:

```bash
npm run test:document-files
npm run test:file-access
npm run test:document-processor
npm run test:reader-state
npm run test:excel-preview
npm run typecheck
npx prisma validate
npm run build
git diff --check
```

Expected: every command exits 0 and all tests report 0 failures.

- [ ] **Step 5: Record delivery and rollback**

Document modified files, test evidence, screenshots or observed states, local database backup path, dependency size, known PDF/PPT fidelity limits, and per-commit rollback commands. State explicitly that nothing was pushed or deployed to production.

- [ ] **Step 6: Commit documentation**

Commit: `git commit -m "docs: record local document viewer QA"`
