import * as XLSX from 'xlsx'
import type { BrandContactRecord } from '@/types/brand-data'
import { CONTACT_FIELD_LABELS } from './brand-data-fields'

export type BrandDataUploadMode = 'merge' | 'replace'

const EMPTY_CONTACT: BrandContactRecord = Object.fromEntries(
  Object.keys(CONTACT_FIELD_LABELS).map(key => [key, '']),
) as unknown as BrandContactRecord

const FIELD_BY_HEADER = new Map(
  Object.entries(CONTACT_FIELD_LABELS).map(([field, label]) => [
    label,
    field as keyof BrandContactRecord,
  ]),
)

function text(value: unknown): string {
  return value === null || value === undefined ? '' : String(value).trim()
}

export function parseBrandContactWorkbook(buffer: Buffer): BrandContactRecord[] {
  const workbook = XLSX.read(buffer, { type: 'buffer' })
  const sheetName = workbook.SheetNames[0]
  if (!sheetName) throw new Error('Excel 中没有工作表')

  const rows = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[sheetName], {
    header: 1,
    raw: false,
    defval: '',
  })
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
  mode: BrandDataUploadMode,
): BrandContactRecord[] {
  if (mode === 'replace') return incoming

  const byBrand = new Map(
    existing.map(item => [item.brandName.trim().toLowerCase(), { ...EMPTY_CONTACT, ...item }]),
  )

  for (const item of incoming) {
    const key = item.brandName.trim().toLowerCase()
    const current = byBrand.get(key)
    if (!current) {
      byBrand.set(key, { ...EMPTY_CONTACT, ...item })
      continue
    }

    for (const field of Object.keys(CONTACT_FIELD_LABELS) as (keyof BrandContactRecord)[]) {
      if (field === 'brandName') continue
      if (item[field]) current[field] = item[field]
    }
  }

  return Array.from(byBrand.values())
}
