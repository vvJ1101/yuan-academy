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

function legacyDataPath(type: BrandDataType, baseDir = defaultDir()): string {
  return join(baseDir, `${type}.json`)
}

function metadataPath(type: BrandDataType, baseDir = defaultDir()): string {
  return join(typeDir(type, baseDir), 'updated.json')
}

function legacyMetadataPath(type: BrandDataType, baseDir = defaultDir()): string {
  return join(baseDir, `${type}.updated.json`)
}

function readJsonIfExists(path: string): Record<string, unknown> {
  if (!existsSync(path)) return {}
  return JSON.parse(readFileSync(path, 'utf8'))
}

export function readBrandPayload<TRecord extends object>(
  type: BrandDataType,
  baseDir = defaultDir(),
): BrandDataPayload<TRecord> {
  const currentPath = existsSync(dataPath(type, baseDir))
    ? dataPath(type, baseDir)
    : legacyDataPath(type, baseDir)
  const raw = JSON.parse(readFileSync(currentPath, 'utf8'))
  if (!Array.isArray(raw)) throw new Error('品牌资料数据格式错误')

  const metadata = {
    ...readJsonIfExists(legacyMetadataPath(type, baseDir)),
    ...readJsonIfExists(metadataPath(type, baseDir)),
  }

  return {
    items: raw as TRecord[],
    updatedAt: typeof metadata.updatedAt === 'string' ? metadata.updatedAt : '',
    updatedBy: typeof metadata.updatedBy === 'string' ? metadata.updatedBy : '',
  }
}

export function writeBrandPayload<TRecord extends object>(
  type: BrandDataType,
  items: TRecord[],
  actor: string,
  baseDir = defaultDir(),
): BrandDataPayload<TRecord> {
  if (!Array.isArray(items)) throw new Error('品牌资料数据格式错误')

  const nestedDir = typeDir(type, baseDir)
  mkdirSync(nestedDir, { recursive: true })

  const nestedCurrent = dataPath(type, baseDir)
  const legacyCurrent = legacyDataPath(type, baseDir)
  if (existsSync(nestedCurrent)) {
    copyFileSync(nestedCurrent, join(nestedDir, 'data.backup.json'))
  } else if (existsSync(legacyCurrent)) {
    copyFileSync(legacyCurrent, join(baseDir, `${type}.backup.json`))
  }

  const metadata = {
    updatedAt: new Date().toISOString(),
    updatedBy: actor || '未知用户',
  }
  writeFileSync(nestedCurrent, JSON.stringify(items, null, 2), 'utf8')
  writeFileSync(metadataPath(type, baseDir), JSON.stringify(metadata, null, 2), 'utf8')

  return { items, ...metadata }
}

export function getBrandTemplatePath(type: BrandDataType, baseDir = defaultDir()): string {
  return join(typeDir(type, baseDir), 'template.xlsx')
}
