# Brand Data Hub Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a unified “品牌资料” area that merges ordering policies and brand contact information, with 商品部 full-field maintenance and 市场部 field-limited viewing.

**Architecture:** Reuse the existing private JSON/Excel storage pattern from ordering policies, add a focused brand-data domain layer, and expose one unified `/internal/brand` page. All field-level visibility is enforced in API helpers before JSON leaves the server; frontend visibility is only a UX layer.

**Tech Stack:** Next.js App Router, TypeScript, private filesystem storage under `data/private`, SheetJS `xlsx`, existing Prisma role/menu permissions, Tailwind CSS.

## Global Constraints

- Do not modify `src/lib/parser.ts`, `src/lib/prompts/*.ts`, `scripts/fts-migrate.ts`, or `src/types/dashboard.ts`.
- Store brand data under `data/private/brand-data/`; never under `public/`.
- Market view may see only: 品牌名称, 商品部-负责人, 品牌部-运营负责人, 品牌国家, 类目, 合作折扣, 是否含票, 专票, 普票, 合作时间, 售后地址, 样衣地址, 周末发货时间.
- 商品部 full view may see Excel A-W fields.
- POST/PUT/DELETE must log audit entries.
- Upload default mode is merge; blank cells do not overwrite old values in merge mode.
- Full replacement requires explicit `mode=replace`.
- API filtering must happen server-side.

---

## File Structure

- Create `src/types/brand-data.ts`: shared field names, record types, permission result types.
- Create `src/lib/brand-data-fields.ts`: Excel header mapping, field groups, public/full field projection.
- Create `src/lib/brand-data-store.ts`: private JSON read/write, backup, metadata, template paths.
- Create `src/lib/brand-data-excel.ts`: parse uploaded `.xlsx` into normalized contact records.
- Create `src/lib/brand-data-access.ts`: permission checks for ordering/contact data.
- Create `src/lib/__tests__/brand-data-fields.test.ts`: field projection tests.
- Create `src/lib/__tests__/brand-data-excel.test.ts`: Excel parsing and merge behavior tests.
- Create `src/lib/__tests__/brand-data-store.test.ts`: private storage backup/write tests.
- Create `src/app/api/brand-data/route.ts`: read brand data with server-side field filtering.
- Create `src/app/api/brand-data/template/route.ts`: template download.
- Create `src/app/api/brand-data/export/route.ts`: permission-aware export.
- Create `src/app/api/admin/brand-data/upload/route.ts`: upload/update endpoint.
- Create `src/app/internal/brand/page.tsx`: unified brand data page.
- Create `src/components/internal/brand/brand-tabs.tsx`: ordering/contact tab switch.
- Create `src/components/internal/brand/contact-card.tsx`: role-aware contact card.
- Create `src/components/internal/brand/upload-dialog.tsx`: reusable upload dialog.
- Modify `src/components/internal/internal-sidebar.tsx`: replace `订货政策` and `政策上传` links with collapsible `品牌资料`.
- Modify `src/app/internal/policy/page.tsx`: either re-export/redirect to `/internal/brand?type=ordering` or keep as compatibility redirect.
- Modify `src/app/internal/policy-upload/page.tsx`: redirect to `/internal/brand?type=ordering&upload=1`.
- Modify `prisma/seed.ts`: seed new menu permission points for brand data.
- Update `docs/DEVELOPMENT.md`: document brand data upload and permission behavior.

---

### Task 1: Field Model and Server-Side Projection

**Files:**
- Create: `src/types/brand-data.ts`
- Create: `src/lib/brand-data-fields.ts`
- Test: `src/lib/__tests__/brand-data-fields.test.ts`

**Interfaces:**
- Produces `BrandDataType = 'ordering' | 'contact'`
- Produces `BrandContactRecord`
- Produces `CONTACT_FIELD_GROUPS`
- Produces `projectContactRecord(record, view): Partial<BrandContactRecord>`
- Produces `getContactExportHeaders(view): string[]`

- [ ] **Step 1: Write failing projection tests**

Add `src/lib/__tests__/brand-data-fields.test.ts`:

```ts
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { projectContactRecord, getContactExportHeaders } from '../brand-data-fields'
import type { BrandContactRecord } from '@/types/brand-data'

const record: BrandContactRecord = {
  brandName: 'REFOUND TEN',
  merchandisingOwner: '商品负责人',
  brandOperationOwner: '运营负责人',
  country: '中国',
  category: '服装',
  designer: 'FFung',
  contactPerson: 'Yaki',
  phone: '15521382508',
  orderEmail: 'sales@refoundten.cn',
  ccEmail: 'lujflu@163.com',
  publicPaymentInfo: '对公',
  privatePaymentInfo: '对私账号',
  alipayInfo: '支付宝',
  invoiceInfo: '开票资料',
  cooperationDiscount: '系统订单折扣为准',
  taxIncluded: '不含票',
  specialInvoice: '/',
  normalInvoice: '/',
  privatePaymentMethod: '支付宝',
  cooperationTime: '已结束',
  afterSalesAddress: '售后地址',
  sampleAddress: '样衣地址',
  weekendShippingTime: '周六正常发，周日不发',
}

test('market projection includes basic fields and yellow fields only', () => {
  const projected = projectContactRecord(record, 'market')
  assert.equal(projected.brandName, 'REFOUND TEN')
  assert.equal(projected.merchandisingOwner, '商品负责人')
  assert.equal(projected.brandOperationOwner, '运营负责人')
  assert.equal(projected.cooperationDiscount, '系统订单折扣为准')
  assert.equal('phone' in projected, false)
  assert.equal('orderEmail' in projected, false)
  assert.equal('publicPaymentInfo' in projected, false)
  assert.equal('invoiceInfo' in projected, false)
  assert.equal('privatePaymentMethod' in projected, false)
})

test('full projection includes sensitive merchandising fields', () => {
  const projected = projectContactRecord(record, 'full')
  assert.equal(projected.phone, '15521382508')
  assert.equal(projected.orderEmail, 'sales@refoundten.cn')
  assert.equal(projected.publicPaymentInfo, '对公')
  assert.equal(projected.invoiceInfo, '开票资料')
  assert.equal(projected.privatePaymentMethod, '支付宝')
})

test('market export headers match the allowed market view', () => {
  assert.deepEqual(getContactExportHeaders('market'), [
    '品牌名称',
    '商品部-负责人',
    '品牌部-运营负责人',
    '品牌国家',
    '类目',
    '合作折扣',
    '是否含票',
    '专票',
    '普票',
    '合作时间',
    '售后地址',
    '样衣地址',
    '周末发货时间',
  ])
})
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
TS_NODE_COMPILER_OPTIONS='{"module":"CommonJS","moduleResolution":"Node"}' node --test -r ts-node/register src/lib/__tests__/brand-data-fields.test.ts
```

Expected: FAIL because `brand-data-fields` does not exist.

- [ ] **Step 3: Implement field types**

Create `src/types/brand-data.ts`:

```ts
export type BrandDataType = 'ordering' | 'contact'
export type ContactView = 'market' | 'full'

export interface BrandContactRecord {
  brandName: string
  merchandisingOwner: string
  brandOperationOwner: string
  country: string
  category: string
  designer: string
  contactPerson: string
  phone: string
  orderEmail: string
  ccEmail: string
  publicPaymentInfo: string
  privatePaymentInfo: string
  alipayInfo: string
  invoiceInfo: string
  cooperationDiscount: string
  taxIncluded: string
  specialInvoice: string
  normalInvoice: string
  privatePaymentMethod: string
  cooperationTime: string
  afterSalesAddress: string
  sampleAddress: string
  weekendShippingTime: string
}

export interface BrandDataPayload<TRecord> {
  items: TRecord[]
  updatedAt: string
  updatedBy: string
}
```

- [ ] **Step 4: Implement projection helper**

Create `src/lib/brand-data-fields.ts`:

```ts
import type { BrandContactRecord, ContactView } from '@/types/brand-data'

export const CONTACT_FIELD_LABELS: Record<keyof BrandContactRecord, string> = {
  brandName: '品牌名称',
  merchandisingOwner: '商品部-负责人',
  brandOperationOwner: '品牌部-运营负责人',
  country: '品牌国家',
  category: '类目',
  designer: '主理人',
  contactPerson: '商品对接人',
  phone: '电话',
  orderEmail: '订单邮箱',
  ccEmail: '抄送邮箱',
  publicPaymentInfo: '付款对公信息',
  privatePaymentInfo: '付款对私信息',
  alipayInfo: '支付宝信息',
  invoiceInfo: '开票信息',
  cooperationDiscount: '合作折扣',
  taxIncluded: '是否含票',
  specialInvoice: '专票',
  normalInvoice: '普票',
  privatePaymentMethod: '对私',
  cooperationTime: '合作时间',
  afterSalesAddress: '售后地址',
  sampleAddress: '样衣地址',
  weekendShippingTime: '周末发货时间',
}

export const CONTACT_FIELD_GROUPS = {
  basic: ['brandName', 'merchandisingOwner', 'brandOperationOwner', 'country', 'category'],
  market: ['cooperationDiscount', 'taxIncluded', 'specialInvoice', 'normalInvoice', 'cooperationTime', 'afterSalesAddress', 'sampleAddress', 'weekendShippingTime'],
  fullOnly: ['designer', 'contactPerson', 'phone', 'orderEmail', 'ccEmail', 'publicPaymentInfo', 'privatePaymentInfo', 'alipayInfo', 'invoiceInfo', 'privatePaymentMethod'],
} as const satisfies Record<string, readonly (keyof BrandContactRecord)[]>

export const CONTACT_ALL_FIELDS = [
  ...CONTACT_FIELD_GROUPS.basic,
  ...CONTACT_FIELD_GROUPS.fullOnly.slice(0, 9),
  ...CONTACT_FIELD_GROUPS.market.slice(0, 4),
  'privatePaymentMethod',
  ...CONTACT_FIELD_GROUPS.market.slice(4),
] as const satisfies readonly (keyof BrandContactRecord)[]

export function getContactFields(view: ContactView): readonly (keyof BrandContactRecord)[] {
  if (view === 'full') return CONTACT_ALL_FIELDS
  return [...CONTACT_FIELD_GROUPS.basic, ...CONTACT_FIELD_GROUPS.market]
}

export function projectContactRecord(record: BrandContactRecord, view: ContactView): Partial<BrandContactRecord> {
  const projected: Partial<BrandContactRecord> = {}
  for (const field of getContactFields(view)) projected[field] = record[field]
  return projected
}

export function getContactExportHeaders(view: ContactView): string[] {
  return getContactFields(view).map(field => CONTACT_FIELD_LABELS[field])
}
```

- [ ] **Step 5: Run test to verify it passes**

Run:

```bash
TS_NODE_COMPILER_OPTIONS='{"module":"CommonJS","moduleResolution":"Node"}' node --test -r ts-node/register src/lib/__tests__/brand-data-fields.test.ts
```

Expected: 3 tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/types/brand-data.ts src/lib/brand-data-fields.ts src/lib/__tests__/brand-data-fields.test.ts
git commit -m "feat: define brand contact field permissions"
```

---

### Task 2: Private Brand Data Store

**Files:**
- Create: `src/lib/brand-data-store.ts`
- Test: `src/lib/__tests__/brand-data-store.test.ts`

**Interfaces:**
- Consumes `BrandDataType`, `BrandDataPayload`
- Produces `readBrandPayload<T>(type, baseDir?)`
- Produces `writeBrandPayload<T>(type, items, actor, baseDir?)`
- Produces `getBrandTemplatePath(type, baseDir?)`

- [ ] **Step 1: Write failing store tests**

Create `src/lib/__tests__/brand-data-store.test.ts`:

```ts
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { readBrandPayload, writeBrandPayload, getBrandTemplatePath } from '../brand-data-store'

test('writes contact payload with metadata and backup', async () => {
  const root = await mkdtemp(join(tmpdir(), 'brand-store-'))
  try {
    await writeFile(join(root, 'contact.json'), JSON.stringify([{ brandName: 'Old' }]))
    const payload = writeBrandPayload('contact', [{ brandName: 'New' }], '管理员', root)
    assert.equal(payload.items[0].brandName, 'New')
    assert.equal(payload.updatedBy, '管理员')
    assert.equal(existsSync(join(root, 'contact.backup.json')), true)

    const read = readBrandPayload('contact', root)
    assert.equal(read.items[0].brandName, 'New')
    assert.equal(read.updatedBy, '管理员')
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('template path is inside requested private base dir', async () => {
  assert.equal(getBrandTemplatePath('contact', '/safe/root'), '/safe/root/contact/template.xlsx')
})
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
TS_NODE_COMPILER_OPTIONS='{"module":"CommonJS","moduleResolution":"Node"}' node --test -r ts-node/register src/lib/__tests__/brand-data-store.test.ts
```

Expected: FAIL because store module does not exist.

- [ ] **Step 3: Implement private store**

Create `src/lib/brand-data-store.ts`:

```ts
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { BrandDataPayload, BrandDataType } from '@/types/brand-data'

const defaultDir = () => join(process.cwd(), 'data', 'private', 'brand-data')

function typeDir(type: BrandDataType, baseDir = defaultDir()): string {
  return join(baseDir, type)
}

function dataPath(type: BrandDataType, baseDir = defaultDir()): string {
  return join(typeDir(type, baseDir), 'data.json')
}

function metadataPath(type: BrandDataType, baseDir = defaultDir()): string {
  return join(typeDir(type, baseDir), 'updated.json')
}

export function readBrandPayload<TRecord extends Record<string, unknown>>(
  type: BrandDataType,
  baseDir = defaultDir(),
): BrandDataPayload<TRecord> {
  const raw = JSON.parse(readFileSync(dataPath(type, baseDir), 'utf8'))
  if (!Array.isArray(raw)) throw new Error('品牌资料数据格式错误')
  let metadata: Record<string, unknown> = {}
  if (existsSync(metadataPath(type, baseDir))) {
    metadata = JSON.parse(readFileSync(metadataPath(type, baseDir), 'utf8'))
  }
  return {
    items: raw as TRecord[],
    updatedAt: typeof metadata.updatedAt === 'string' ? metadata.updatedAt : '',
    updatedBy: typeof metadata.updatedBy === 'string' ? metadata.updatedBy : '',
  }
}

export function writeBrandPayload<TRecord extends Record<string, unknown>>(
  type: BrandDataType,
  items: TRecord[],
  actor: string,
  baseDir = defaultDir(),
): BrandDataPayload<TRecord> {
  if (!Array.isArray(items)) throw new Error('品牌资料数据格式错误')
  const dir = typeDir(type, baseDir)
  mkdirSync(dir, { recursive: true })
  const current = dataPath(type, baseDir)
  if (existsSync(current)) copyFileSync(current, join(dir, 'data.backup.json'))
  const metadata = { updatedAt: new Date().toISOString(), updatedBy: actor || '未知用户' }
  writeFileSync(current, JSON.stringify(items, null, 2), 'utf8')
  writeFileSync(metadataPath(type, baseDir), JSON.stringify(metadata, null, 2), 'utf8')
  return { items, ...metadata }
}

export function getBrandTemplatePath(type: BrandDataType, baseDir = defaultDir()): string {
  return join(typeDir(type, baseDir), 'template.xlsx')
}
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
TS_NODE_COMPILER_OPTIONS='{"module":"CommonJS","moduleResolution":"Node"}' node --test -r ts-node/register src/lib/__tests__/brand-data-store.test.ts
```

Expected: 2 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/brand-data-store.ts src/lib/__tests__/brand-data-store.test.ts
git commit -m "feat: add private brand data store"
```

---

### Task 3: Excel Parser and Merge Rules

**Files:**
- Create: `src/lib/brand-data-excel.ts`
- Test: `src/lib/__tests__/brand-data-excel.test.ts`

**Interfaces:**
- Consumes `BrandContactRecord`
- Produces `parseBrandContactWorkbook(buffer): BrandContactRecord[]`
- Produces `mergeBrandContactRecords(existing, incoming, mode)`

- [ ] **Step 1: Write failing parser tests**

Create `src/lib/__tests__/brand-data-excel.test.ts`:

```ts
import assert from 'node:assert/strict'
import { test } from 'node:test'
import * as XLSX from 'xlsx'
import { mergeBrandContactRecords, parseBrandContactWorkbook } from '../brand-data-excel'

function workbookBuffer() {
  const rows = [
    ['品牌名称', '商品部-负责人', '品牌部-运营负责人', '品牌国家', '类目', '主理人', '商品对接人', '电话', '订单邮箱', '抄送邮箱', '付款对公信息', '付款对私信息', '支付宝信息', '开票信息', '合作折扣', '是否含票', '专票', '普票', '对私', '合作时间', '售后地址', '样衣地址', '周末发货时间'],
    ['REFOUND TEN', '商品A', '市场A', '中国', '服装', 'FFung', 'Yaki', '155', 'sales@example.com', 'cc@example.com', '对公', '对私', '支付宝', '开票', '4折', '不含票', '/', '/', '支付宝', '已结束', '售后', '样衣', '周六发'],
    ['', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', ''],
  ]
  const sheet = XLSX.utils.aoa_to_sheet(rows)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, sheet, '工作表2')
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer
}

test('parses contact workbook by Chinese headers', () => {
  const records = parseBrandContactWorkbook(workbookBuffer())
  assert.equal(records.length, 1)
  assert.equal(records[0].brandName, 'REFOUND TEN')
  assert.equal(records[0].merchandisingOwner, '商品A')
  assert.equal(records[0].brandOperationOwner, '市场A')
  assert.equal(records[0].phone, '155')
  assert.equal(records[0].cooperationDiscount, '4折')
})

test('merge mode does not overwrite existing non-empty values with blanks', () => {
  const merged = mergeBrandContactRecords(
    [{ brandName: 'REFOUND TEN', phone: '155', orderEmail: 'old@example.com' } as any],
    [{ brandName: 'REFOUND TEN', phone: '', orderEmail: 'new@example.com' } as any],
    'merge',
  )
  assert.equal(merged[0].phone, '155')
  assert.equal(merged[0].orderEmail, 'new@example.com')
})
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
TS_NODE_COMPILER_OPTIONS='{"module":"CommonJS","moduleResolution":"Node"}' node --test -r ts-node/register src/lib/__tests__/brand-data-excel.test.ts
```

Expected: FAIL because parser module does not exist.

- [ ] **Step 3: Implement parser and merge**

Create `src/lib/brand-data-excel.ts`:

```ts
import * as XLSX from 'xlsx'
import type { BrandContactRecord } from '@/types/brand-data'
import { CONTACT_FIELD_LABELS } from '@/lib/brand-data-fields'

type UploadMode = 'merge' | 'replace'

const EMPTY_CONTACT: BrandContactRecord = Object.fromEntries(
  Object.keys(CONTACT_FIELD_LABELS).map(key => [key, '']),
) as unknown as BrandContactRecord

const FIELD_BY_HEADER = new Map(
  Object.entries(CONTACT_FIELD_LABELS).map(([field, label]) => [label, field as keyof BrandContactRecord]),
)

function text(value: unknown): string {
  return value === null || value === undefined ? '' : String(value).trim()
}

export function parseBrandContactWorkbook(buffer: Buffer): BrandContactRecord[] {
  const workbook = XLSX.read(buffer, { type: 'buffer' })
  const sheetName = workbook.SheetNames[0]
  if (!sheetName) throw new Error('Excel 中没有工作表')
  const rows = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[sheetName], { header: 1, raw: false, defval: '' })
  const headers = (rows[0] || []).map(text)
  const indexes = headers.map(header => FIELD_BY_HEADER.get(header) || null)
  const records: BrandContactRecord[] = []
  for (const row of rows.slice(1)) {
    const record = { ...EMPTY_CONTACT }
    indexes.forEach((field, index) => {
      if (field) record[field] = text(row[index])
    })
    if (record.brandName) records.push(record)
  }
  return records
}

export function mergeBrandContactRecords(
  existing: BrandContactRecord[],
  incoming: BrandContactRecord[],
  mode: UploadMode,
): BrandContactRecord[] {
  if (mode === 'replace') return incoming
  const byBrand = new Map(existing.map(item => [item.brandName.trim().toLowerCase(), { ...item }]))
  for (const item of incoming) {
    const key = item.brandName.trim().toLowerCase()
    const current = byBrand.get(key)
    if (!current) {
      byBrand.set(key, item)
      continue
    }
    for (const field of Object.keys(CONTACT_FIELD_LABELS) as (keyof BrandContactRecord)[]) {
      if (field === 'brandName') continue
      if (item[field]) current[field] = item[field]
    }
  }
  return Array.from(byBrand.values())
}
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
TS_NODE_COMPILER_OPTIONS='{"module":"CommonJS","moduleResolution":"Node"}' node --test -r ts-node/register src/lib/__tests__/brand-data-excel.test.ts
```

Expected: 2 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/brand-data-excel.ts src/lib/__tests__/brand-data-excel.test.ts
git commit -m "feat: parse brand contact spreadsheets"
```

---

### Task 4: Permission Helpers and API Routes

**Files:**
- Create: `src/lib/brand-data-access.ts`
- Create: `src/app/api/brand-data/route.ts`
- Create: `src/app/api/admin/brand-data/upload/route.ts`
- Create: `src/app/api/brand-data/template/route.ts`
- Create: `src/app/api/brand-data/export/route.ts`

**Interfaces:**
- Consumes store/parser/projection helpers
- Produces API responses with filtered fields

- [ ] **Step 1: Implement access helper**

Create `src/lib/brand-data-access.ts`:

```ts
import type { SessionClaims } from '@/lib/session'
import type { ContactView } from '@/types/brand-data'

function has(session: SessionClaims, permission: string): boolean {
  return session.permissions?.includes('*') || session.permissions?.includes(permission)
}

export function getContactView(session: SessionClaims): ContactView | null {
  if (session.role === 'super_admin' || has(session, 'brandContact.viewFullFields')) return 'full'
  if (has(session, 'brandContact.viewMarketFields')) return 'market'
  return null
}

export function canUploadContact(session: SessionClaims): boolean {
  return session.role === 'super_admin' || has(session, 'brandContact.upload')
}

export function canExportContact(session: SessionClaims, view: ContactView): boolean {
  if (session.role === 'super_admin') return true
  if (view === 'full') return has(session, 'brandContact.exportFullFields')
  return has(session, 'brandContact.exportMarketFields')
}
```

- [ ] **Step 2: Implement read API**

Create `src/app/api/brand-data/route.ts` with this behavior:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromCookies } from '@/lib/auth'
import { getContactView } from '@/lib/brand-data-access'
import { projectContactRecord } from '@/lib/brand-data-fields'
import { readBrandPayload } from '@/lib/brand-data-store'
import type { BrandContactRecord } from '@/types/brand-data'

export async function GET(req: NextRequest) {
  const session = await getSessionFromCookies(req.headers.get('cookie'))
  if (!session) return NextResponse.json({ error: '请先登录' }, { status: 401 })
  const type = new URL(req.url).searchParams.get('type') || 'ordering'
  if (type !== 'contact') return NextResponse.json({ error: '资料类型暂未接入统一接口' }, { status: 400 })
  const view = getContactView(session)
  if (!view) return NextResponse.json({ error: '无权查看品牌对接信息' }, { status: 403 })
  try {
    const payload = readBrandPayload<BrandContactRecord>('contact')
    return NextResponse.json({
      items: payload.items.map(item => projectContactRecord(item, view)),
      view,
      updatedAt: payload.updatedAt,
      updatedBy: payload.updatedBy,
    })
  } catch {
    return NextResponse.json({ items: [], view, updatedAt: '', updatedBy: '' })
  }
}
```

- [ ] **Step 3: Implement upload API**

Create `src/app/api/admin/brand-data/upload/route.ts` with this behavior:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromCookies } from '@/lib/auth'
import { canUploadContact } from '@/lib/brand-data-access'
import { mergeBrandContactRecords, parseBrandContactWorkbook } from '@/lib/brand-data-excel'
import { readBrandPayload, writeBrandPayload } from '@/lib/brand-data-store'
import { logPolicyChange } from '@/lib/audit'
import type { BrandContactRecord } from '@/types/brand-data'

export async function POST(req: NextRequest) {
  const session = await getSessionFromCookies(req.headers.get('cookie'))
  if (!session) return NextResponse.json({ error: '请先登录' }, { status: 401 })
  if (!canUploadContact(session)) return NextResponse.json({ error: '无权上传品牌对接信息' }, { status: 403 })
  const form = await req.formData().catch(() => null)
  if (!form) return NextResponse.json({ error: '上传请求格式错误' }, { status: 400 })
  const type = String(form.get('type') || '')
  const mode = String(form.get('mode') || 'merge') === 'replace' ? 'replace' : 'merge'
  const file = form.get('file')
  if (type !== 'contact') return NextResponse.json({ error: '资料类型无效' }, { status: 400 })
  if (!(file instanceof File)) return NextResponse.json({ error: '请选择 Excel 文件' }, { status: 400 })
  const incoming = parseBrandContactWorkbook(Buffer.from(await file.arrayBuffer()))
  const existing = mode === 'merge'
    ? readBrandPayload<BrandContactRecord>('contact').items
    : []
  const merged = mergeBrandContactRecords(existing, incoming, mode)
  const payload = writeBrandPayload('contact', merged, session.name || session.email || session.id)
  await logPolicyChange(session.id, 'brandContact:upload')
  return NextResponse.json({ addedOrUpdated: incoming.length, total: payload.items.length, updatedAt: payload.updatedAt })
}
```

If `readBrandPayload` throws on first upload, catch it and use `[]`.

- [ ] **Step 4: Implement template and export API**

Use `getBrandTemplatePath('contact')` for templates. For export, read payload, project with `market` or `full`, and generate a workbook with `xlsx` headers from `getContactExportHeaders(view)`. Return `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`.

- [ ] **Step 5: Run checks**

Run:

```bash
npm run typecheck
```

Expected: no TypeScript errors.

- [ ] **Step 6: Commit**

```bash
git add src/lib/brand-data-access.ts src/app/api/brand-data src/app/api/admin/brand-data
git commit -m "feat: add brand data APIs"
```

---

### Task 5: Unified Brand Page and Upload Dialog

**Files:**
- Create: `src/app/internal/brand/page.tsx`
- Create: `src/components/internal/brand/brand-tabs.tsx`
- Create: `src/components/internal/brand/contact-card.tsx`
- Create: `src/components/internal/brand/upload-dialog.tsx`

**Interfaces:**
- Consumes `GET /api/brand-data?type=contact`
- Consumes `POST /api/admin/brand-data/upload`

- [ ] **Step 1: Create contact card**

Create `src/components/internal/brand/contact-card.tsx`:

```tsx
'use client'

type ContactItem = Record<string, string>

function Line({ label, value }: { label: string; value?: string }) {
  if (!value) return null
  return <p className="text-[0.74rem] leading-relaxed"><span className="font-medium text-neutral-900">{label}：</span><span className="text-neutral-700 whitespace-pre-line">{value}</span></p>
}

export function ContactCard({ item, view }: { item: ContactItem; view: 'market' | 'full' }) {
  return (
    <article className="rounded-xl border border-neutral-200 bg-white p-4 space-y-3">
      <div>
        <h3 className="text-[0.95rem] font-semibold text-neutral-900">{item.brandName || '未命名品牌'}</h3>
        <p className="text-[0.7rem] text-neutral-500">{item.merchandisingOwner || '—'} / {item.brandOperationOwner || '—'} · {item.country || '—'} · {item.category || '—'}</p>
      </div>
      {view === 'full' && (
        <section className="rounded-lg bg-neutral-50 p-3 space-y-1">
          <p className="text-[0.72rem] font-semibold text-neutral-800">对接信息</p>
          <Line label="主理人" value={item.designer} />
          <Line label="商品对接人" value={item.contactPerson} />
          <Line label="电话" value={item.phone} />
          <Line label="订单邮箱" value={item.orderEmail} />
          <Line label="抄送邮箱" value={item.ccEmail} />
        </section>
      )}
      {view === 'full' && (
        <section className="rounded-lg bg-amber-50/60 p-3 space-y-1">
          <p className="text-[0.72rem] font-semibold text-neutral-800">付款 / 开票</p>
          <Line label="付款对公信息" value={item.publicPaymentInfo} />
          <Line label="付款对私信息" value={item.privatePaymentInfo} />
          <Line label="支付宝信息" value={item.alipayInfo} />
          <Line label="开票信息" value={item.invoiceInfo} />
          <Line label="对私" value={item.privatePaymentMethod} />
        </section>
      )}
      <section className="rounded-lg bg-blue-50/60 p-3 space-y-1">
        <p className="text-[0.72rem] font-semibold text-[#2563EB]">合作信息</p>
        <Line label="合作折扣" value={item.cooperationDiscount} />
        <Line label="是否含票" value={item.taxIncluded} />
        <Line label="专票" value={item.specialInvoice} />
        <Line label="普票" value={item.normalInvoice} />
        <Line label="合作时间" value={item.cooperationTime} />
      </section>
      <section className="rounded-lg bg-emerald-50/60 p-3 space-y-1">
        <p className="text-[0.72rem] font-semibold text-emerald-700">仓库 / 发货</p>
        <Line label="售后地址" value={item.afterSalesAddress} />
        <Line label="样衣地址" value={item.sampleAddress} />
        <Line label="周末发货时间" value={item.weekendShippingTime} />
      </section>
    </article>
  )
}
```

- [ ] **Step 2: Create unified page**

Create `src/app/internal/brand/page.tsx` as a client page that:

- Reads `type` from `useSearchParams`.
- Defaults to `contact` for first implementation if ordering migration is deferred.
- Fetches `/api/brand-data?type=contact`.
- Displays search and filters for `brandName`, `country`, `category`.
- Shows upload button only when `view === 'full'`; upload errors still rely on API permission.

- [ ] **Step 3: Create upload dialog**

Create `src/components/internal/brand/upload-dialog.tsx` with:

- File input `.xlsx`.
- Mode radio: merge/replace.
- Replace mode confirmation text: `我确认全量替换当前品牌对接信息`.
- Submit `FormData` fields `type=contact`, `mode`, `file`.
- Preserve selected file and user input on upload error.

- [ ] **Step 4: Run checks**

Run:

```bash
npm run typecheck
npm run build
```

Expected: both pass.

- [ ] **Step 5: Commit**

```bash
git add src/app/internal/brand src/components/internal/brand
git commit -m "feat: add brand data page"
```

---

### Task 6: Navigation, Redirects, and Permission Seeds

**Files:**
- Modify: `src/components/internal/internal-sidebar.tsx`
- Modify: `src/app/internal/policy/page.tsx`
- Modify: `src/app/internal/policy-upload/page.tsx`
- Modify: `prisma/seed.ts`
- Update: `docs/DEVELOPMENT.md`

**Interfaces:**
- Uses permissions `menu.brand`, `menu.brand.ordering`, `menu.brand.contact`.

- [ ] **Step 1: Update sidebar**

Replace the two policy quick links with one collapsible group:

```tsx
const BRAND_LINKS = [
  { href: '/internal/brand?type=ordering', label: '订货政策', permKey: 'menu.brand.ordering' },
  { href: '/internal/brand?type=contact', label: '品牌对接信息', permKey: 'menu.brand.contact' },
]
```

Render the group when `permList` includes `menu.brand` or the user is admin. Keep `政策上传` out of the left sidebar.

- [ ] **Step 2: Add compatibility redirects**

For `/internal/policy`, redirect to `/internal/brand?type=ordering`.

For `/internal/policy-upload`, redirect to `/internal/brand?type=ordering&upload=1`.

If preserving the old policy UI inside the new page takes longer, keep old `/internal/policy` page temporarily and add a visible link from `/internal/brand?type=ordering`; do not break existing dashboard links.

- [ ] **Step 3: Seed menu permissions**

Add menu permissions in `prisma/seed.ts`:

```ts
'menu.brand',
'menu.brand.ordering',
'menu.brand.contact',
'brandContact.viewMarketFields',
'brandContact.viewFullFields',
'brandContact.upload',
'brandContact.exportMarketFields',
'brandContact.exportFullFields',
```

Assign full brand contact permissions to super/admin roles. Assign market view only to the configured 市场部 role when role data exists; otherwise document manual assignment in admin.

- [ ] **Step 4: Update docs**

Append to `docs/DEVELOPMENT.md`:

```md
### 品牌资料中心

品牌资料统一入口为 `/internal/brand`。`type=contact` 展示品牌对接信息，市场部接口只返回基础信息与黄色字段，商品部/管理员可查看完整字段并上传 Excel。品牌资料文件存储在 `data/private/brand-data/`，不得提交 Git 或放入 `public/`。
```

- [ ] **Step 5: Run checks**

Run:

```bash
npm run typecheck
npm run build
```

Expected: both pass.

- [ ] **Step 6: Commit**

```bash
git add src/components/internal/internal-sidebar.tsx src/app/internal/policy/page.tsx src/app/internal/policy-upload/page.tsx prisma/seed.ts docs/DEVELOPMENT.md
git commit -m "feat: unify brand data navigation"
```

---

### Task 7: Final Verification and Production Handoff

**Files:**
- No new source files unless verification finds a defect.

- [ ] **Step 1: Run full relevant tests**

Run:

```bash
npm run test:document-files
TS_NODE_COMPILER_OPTIONS='{"module":"CommonJS","moduleResolution":"Node"}' node --test -r ts-node/register src/lib/__tests__/brand-data-fields.test.ts src/lib/__tests__/brand-data-store.test.ts src/lib/__tests__/brand-data-excel.test.ts
npm run typecheck
npm run build
```

Expected: all commands exit 0.

- [ ] **Step 2: Manual permission QA**

Create or use test accounts with:

- Market permissions: `brandContact.viewMarketFields`, `brandContact.exportMarketFields`.
- Full permissions: `brandContact.viewFullFields`, `brandContact.upload`, `brandContact.exportFullFields`.

Expected:

- Market API response does not contain `phone`, `orderEmail`, `publicPaymentInfo`, `invoiceInfo`, or `privatePaymentMethod`.
- Full API response contains those fields.
- Market page has no upload button.
- Full page can upload the sample Excel.

- [ ] **Step 3: Deployment prep**

Before production:

```bash
ssh root@120.79.162.27 "cd /var/www/yuan-academy && cp -r data/private/brand-data /var/backups/yuan-academy-brand-data-$(date +%Y%m%d-%H%M%S) 2>/dev/null || true && cp prisma/dev.db /var/backups/yuan-academy-$(date +%Y%m%d-%H%M%S)-before-brand-data.db"
```

- [ ] **Step 4: Commit final docs if changed**

```bash
git status --short
git add <changed-files>
git commit -m "docs: update brand data rollout notes"
```

Only run the commit if files changed.

