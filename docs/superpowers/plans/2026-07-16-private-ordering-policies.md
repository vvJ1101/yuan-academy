# Private Ordering Policies Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep YUAN Academy ordering policies usable for authenticated staff while removing every anonymously accessible policy file from Academy and the public website.

**Architecture:** Academy stores policy data under `data/private/policies`, reads it through a small server-only store, and exposes authenticated Next.js route handlers for policy JSON and the Excel template. Existing write/upload routes reuse the same store and existing RBAC; the public website keeps no policy data.

**Tech Stack:** Next.js 14 App Router, TypeScript, Node.js filesystem APIs, signed JWT sessions with `jose`, Prisma audit log, Node built-in test runner.

## Global Constraints

- Every authenticated Academy user may read policies and download the template.
- Only `super_admin`, or a `dept_admin` in 时胜/品牌部, may edit or upload policies.
- No policy JSON, backup, timestamp, or Excel template may remain under either project's `public/` directory.
- No database schema, page design, login role, or policy field-format change is in scope.
- Do not modify `src/lib/parser.ts`, `src/lib/prompts/*.ts`, `scripts/fts-migrate.ts`, or `src/types/dashboard.ts`.
- Do not deploy production automatically.

---

## File Structure

- Create `src/lib/policy-store.ts`: the only filesystem boundary for private policy reads, writes, backups, metadata, and template paths.
- Create `tests/policy-store.test.mjs`: behavior tests using temporary directories and Node's built-in runner.
- Create `src/app/api/policies/route.ts`: authenticated read endpoint.
- Create `src/app/api/policies/template/route.ts`: authenticated template download endpoint.
- Modify `src/app/api/admin/policy/route.ts`: signed session validation, RBAC, private writes, audit.
- Modify `src/app/api/admin/policy-upload/route.ts`: signed session validation, RBAC, private merge/write, audit.
- Modify `src/app/internal/policy/page.tsx`: load policies and metadata from the protected API.
- Modify `src/app/internal/policy-upload/page.tsx`: download the template through the protected API.
- Modify `.gitignore`: ignore runtime private JSON and backups while allowing a committed `.gitkeep`; never ignore the template that deployment needs.
- Create `data/private/policies/.gitkeep`: preserve the private runtime directory.
- Move the Academy Excel template to `data/private/policies/订货政策-上传模板.xlsx`.
- Seed local private `policies.json` from the website's complete 15-brand source before removing public copies.
- Delete policy-related static files from both projects after verification.

---

### Task 1: Private Policy Store

**Files:**
- Create: `src/lib/policy-store.ts`
- Create: `tests/policy-store.test.mjs`
- Modify: `.gitignore`
- Create: `data/private/policies/.gitkeep`

**Interfaces:**
- Produces `PolicyRecord`, `PolicyPayload`, `readPolicyPayload(baseDir?)`, `writePolicies(policies, actor, baseDir?)`, and `getPolicyTemplatePath(baseDir?)`.
- All later API tasks consume these functions; no route may call `fs` directly for policy data.

- [ ] **Step 1: Write failing store tests**

Create tests that import `../src/lib/policy-store.ts` and verify:

```js
test('readPolicyPayload reads private policies and metadata', async () => {
  const root = await makeFixture([{ brand: 'SEAMEW' }], { updatedAt: '2026-07-16T00:00:00.000Z', updatedBy: '测试员' })
  assert.deepEqual(readPolicyPayload(root), {
    policies: [{ brand: 'SEAMEW' }],
    updatedAt: '2026-07-16T00:00:00.000Z',
    updatedBy: '测试员',
  })
})

test('writePolicies creates metadata and preserves the previous version', async () => {
  const root = await makeFixture([{ brand: '旧品牌' }], {})
  writePolicies([{ brand: '新品牌' }], '管理员', root)
  assert.deepEqual(JSON.parse(await readFile(join(root, 'policies.backup.json'), 'utf8')), [{ brand: '旧品牌' }])
  assert.deepEqual(readPolicyPayload(root).policies, [{ brand: '新品牌' }])
  assert.equal(readPolicyPayload(root).updatedBy, '管理员')
})

test('readPolicyPayload rejects malformed policy data', async () => {
  const root = await mkdtemp(join(tmpdir(), 'yuan-policy-'))
  await writeFile(join(root, 'policies.json'), '{}')
  assert.throws(() => readPolicyPayload(root), /订货政策数据格式错误/)
})
```

- [ ] **Step 2: Run tests and verify RED**

Run: `node --test tests/policy-store.test.mjs`

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `src/lib/policy-store.ts`.

- [ ] **Step 3: Implement the minimal server-only store**

Implement these exact behaviors:

```ts
import { copyFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

export type PolicyRecord = Record<string, unknown>
export interface PolicyPayload {
  policies: PolicyRecord[]
  updatedAt: string
  updatedBy: string
}

const defaultDir = () => join(process.cwd(), 'data', 'private', 'policies')

export function readPolicyPayload(baseDir = defaultDir()): PolicyPayload {
  const policies = JSON.parse(readFileSync(join(baseDir, 'policies.json'), 'utf8'))
  if (!Array.isArray(policies)) throw new Error('订货政策数据格式错误')
  let metadata: Record<string, unknown> = {}
  const metadataPath = join(baseDir, 'policies.updated.json')
  if (existsSync(metadataPath)) metadata = JSON.parse(readFileSync(metadataPath, 'utf8'))
  return {
    policies,
    updatedAt: typeof metadata.updatedAt === 'string' ? metadata.updatedAt : '',
    updatedBy: typeof metadata.updatedBy === 'string' ? metadata.updatedBy : '',
  }
}

export function writePolicies(policies: PolicyRecord[], actor: string, baseDir = defaultDir()): PolicyPayload {
  if (!Array.isArray(policies)) throw new Error('订货政策数据格式错误')
  const current = join(baseDir, 'policies.json')
  if (existsSync(current)) copyFileSync(current, join(baseDir, 'policies.backup.json'))
  const metadata = { updatedAt: new Date().toISOString(), updatedBy: actor || '未知用户' }
  writeFileSync(current, JSON.stringify(policies, null, 2), 'utf8')
  writeFileSync(join(baseDir, 'policies.updated.json'), JSON.stringify(metadata, null, 2), 'utf8')
  return { policies, ...metadata }
}

export function getPolicyTemplatePath(baseDir = defaultDir()): string {
  return join(baseDir, '订货政策-上传模板.xlsx')
}
```

Add `data/private/policies/policies*.json` to `.gitignore`, but keep `.gitkeep` and the Excel template trackable.

- [ ] **Step 4: Run tests and verify GREEN**

Run: `node --test tests/policy-store.test.mjs`

Expected: 3 tests pass, 0 fail.

- [ ] **Step 5: Commit**

```bash
git add src/lib/policy-store.ts tests/policy-store.test.mjs .gitignore data/private/policies/.gitkeep
git commit -m "feat: add private policy store"
```

---

### Task 2: Authenticated Read APIs

**Files:**
- Create: `src/app/api/policies/route.ts`
- Create: `src/app/api/policies/template/route.ts`

**Interfaces:**
- Consumes `getSessionFromCookiesAsync`, `readPolicyPayload`, and `getPolicyTemplatePath`.
- Produces `GET /api/policies` and `GET /api/policies/template`.

- [ ] **Step 1: Add an integration assertion script and verify RED**

Start the current app and run:

```bash
curl -i http://127.0.0.1:3000/api/policies
curl -i http://127.0.0.1:3000/api/policies/template
```

Expected before implementation: both return `404` (middleware may return `401`; if so, verify the route is absent in `.next/routes-manifest.json`).

- [ ] **Step 2: Implement authenticated GET handlers**

Both handlers must call:

```ts
const session = await getSessionFromCookiesAsync(request.headers.get('cookie'))
if (!session?.id) {
  return NextResponse.json({ error: '请先登录' }, { status: 401 })
}
```

The JSON route returns `readPolicyPayload()` with `Cache-Control: private, no-store`. It maps missing files to `404 { error: '订货政策数据不存在' }` and invalid data to `500 { error: '订货政策数据读取失败' }`.

The template route uses `readFileSync(getPolicyTemplatePath())` and returns the correct XLSX content type plus:

```ts
'Content-Disposition': "attachment; filename*=UTF-8''%E8%AE%A2%E8%B4%A7%E6%94%BF%E7%AD%96-%E4%B8%8A%E4%BC%A0%E6%A8%A1%E6%9D%BF.xlsx"
```

- [ ] **Step 3: Verify unauthenticated behavior**

Run the two curl commands again.

Expected: both return `401`; neither response contains policy content or workbook bytes.

- [ ] **Step 4: Verify authenticated behavior**

Log in through `/api/auth/login`, save the session cookie, then request both endpoints.

Expected: policy API returns `200` with 15 policies; template returns `200` with XLSX content type and attachment disposition.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/policies/route.ts src/app/api/policies/template/route.ts
git commit -m "feat: protect policy reads behind authentication"
```

---

### Task 3: Secure Writes, Uploads, and Audit

**Files:**
- Modify: `src/app/api/admin/policy/route.ts`
- Modify: `src/app/api/admin/policy-upload/route.ts`
- Modify: `src/lib/audit.ts`

**Interfaces:**
- Consumes `getSessionFromCookiesAsync`, `canEditPolicy`, `readPolicyPayload`, and `writePolicies`.
- Produces `logPolicyChange(userId, action)` with action `policy:update` or `policy:upload`.

- [ ] **Step 1: Record current authorization failure**

Create valid signed sessions for a staff fixture and an authorized admin fixture. Call both write endpoints with staff credentials.

Expected before the fix: the current routes accept any session containing an `id`; this demonstrates the RBAC regression.

- [ ] **Step 2: Extend audit logging**

Add:

```ts
export async function logPolicyChange(userId: string, action: 'policy:update' | 'policy:upload') {
  try {
    await prisma.auditLog.create({ data: { userId, action } })
  } catch {
    console.error(`[AUDIT] Failed to log ${action} for user ${userId}`)
  }
}
```

- [ ] **Step 3: Replace permissive route authorization**

In both routes use signed async session verification and reject in this order:

```ts
const session = await getSessionFromCookiesAsync(req.headers.get('cookie'))
if (!session?.id) return NextResponse.json({ error: '请先登录' }, { status: 401 })
if (!canEditPolicy(session)) return NextResponse.json({ error: '无权修改订货政策' }, { status: 403 })
```

The PUT route validates `policies` as an array, calls `writePolicies(policies, session.name || '未知用户')`, logs `policy:update`, and returns `{ ok: true, count, updatedAt, updatedBy }` from the stored payload.

The upload route reads existing data with `readPolicyPayload().policies`, performs the current brand merge, calls `writePolicies(merged, session.name || '未知用户')`, and logs `policy:upload`. All errors return concise Chinese messages and appropriate `400`/`500` status codes.

- [ ] **Step 4: Verify permission and write behavior**

Run authenticated curl requests for staff and admin sessions.

Expected: staff receives `403`; admin receives `200`; the private JSON, metadata, backup, and audit row change; no file under `public/` changes.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/admin/policy/route.ts src/app/api/admin/policy-upload/route.ts src/lib/audit.ts
git commit -m "fix: enforce policy write permissions"
```

---

### Task 4: Frontend Cutover and Safe Data Migration

**Files:**
- Modify: `src/app/internal/policy/page.tsx`
- Modify: `src/app/internal/policy-upload/page.tsx`
- Create runtime: `data/private/policies/policies.json`
- Create runtime: `data/private/policies/policies.updated.json`
- Move: `public/showroom/data/订货政策-上传模板.xlsx` to `data/private/policies/订货政策-上传模板.xlsx`

**Interfaces:**
- Consumes the protected read APIs from Task 2.
- Preserves current `Policy` normalization for legacy `ss26`/`aw26` records.

- [ ] **Step 1: Add a static regression check and verify RED**

Run:

```bash
rg -n "/showroom/data/policies|/showroom/data/订货政策" src/app/internal
```

Expected before the change: matches in the policy and upload pages.

- [ ] **Step 2: Seed private data without deleting sources**

Copy the complete 15-brand website policy JSON to `data/private/policies/policies.json`, create metadata naming the migration, copy the Academy template, then verify:

```bash
node -e "const p=require('./data/private/policies/policies.json'); if(p.length!==15) process.exit(1); console.log(p.length)"
```

Expected: `15`.

- [ ] **Step 3: Cut the frontend over**

Replace the two static fetches with one request:

```ts
useEffect(() => {
  fetch('/api/policies', { cache: 'no-store' })
    .then(async response => {
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || '订货政策加载失败')
      setItems(data.policies.map(normalizePolicy))
      if (data.updatedAt) setUpdatedAt(new Date(data.updatedAt).toLocaleString('zh-CN'))
      if (data.updatedBy) setUpdatedBy(data.updatedBy)
    })
    .catch(error => setSaveMsg(error instanceof Error ? error.message : '订货政策加载失败'))
    .finally(() => setLoading(false))
}, [])
```

After a successful save, update timestamp data from the PUT response rather than fetching a static metadata file. Change the upload template link to `/api/policies/template`.

- [ ] **Step 4: Verify the cutover**

Run the `rg` command again.

Expected: no matches. In a logged-in browser, `/internal/policy` shows 15 brands, filters work, and the template download succeeds.

- [ ] **Step 5: Commit trackable frontend and template changes**

```bash
git add src/app/internal/policy/page.tsx src/app/internal/policy-upload/page.tsx data/private/policies/订货政策-上传模板.xlsx
git commit -m "feat: load policies through protected API"
```

Do not commit runtime policy JSON; deploy it as protected operational data.

---

### Task 5: Remove Public Copies and Verify Both Projects

**Files:**
- Delete from Academy: `public/data/policies*.json`, `public/data/订货政策-上传模板.xlsx`, `public/showroom/data/policies*.json`, `public/showroom/data/订货政策-上传模板.xlsx`, `src/data/policies.json`
- Delete from website: `public/data/policies.json`, `public/data/policies.updated.json`, `public/data/policy-template.xlsx`, `src/data/policies.json`

**Interfaces:**
- No consumer may reference deleted paths.

- [ ] **Step 1: Prove private reads work before deletion**

With the Academy app running, verify authenticated `GET /api/policies` returns 15 policies and an authenticated template request returns a valid XLSX.

- [ ] **Step 2: Delete only confirmed policy copies**

Use an explicit file list. Do not remove unrelated files from either `public/data` directory.

- [ ] **Step 3: Run full verification**

Academy:

```bash
node --test tests/policy-store.test.mjs
npm run build
rg -n "public/(showroom/)?data/policies|/showroom/data/policies|src/data/policies" src scripts public -g '!*.md'
```

Website:

```bash
npm run build
find public/data src/data -maxdepth 1 -type f | rg 'policies|policy-template' || true
```

Expected: tests and both builds pass; source scans find no public policy dependency or copy.

- [ ] **Step 4: Verify HTTP behavior**

Run both production servers locally. Expected:

- Academy `/data/policies.json`, `/showroom/data/policies.json`, backup variants, and old template URLs return `404`.
- Website `/data/policies.json` and `/data/policy-template.xlsx` return `404`.
- Academy unauthenticated `/api/policies` and `/api/policies/template` return `401`.
- Academy authenticated endpoints return `200`.

- [ ] **Step 5: Commit cleanup in each repository**

Commit Academy cleanup without staging unrelated `dev-explorer-ide/` or `docs/DEVELOPMENT.md`. The website is not currently a Git repository, so record its modified file list in the final handoff instead of attempting a commit.

---

## Production Follow-up (Not Executed in This Plan)

Before the next Academy deployment, copy the private JSON, metadata, and template to `/var/www/yuan-academy/data/private/policies/`, owned by the Academy process user and not mapped by Nginx. After the new build is healthy, explicitly delete old policy files from both production web roots and purge any CDN cache. Confirm anonymous HTTP requests return `404` before declaring the incident closed.
