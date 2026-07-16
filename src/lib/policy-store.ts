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
  if (existsSync(metadataPath)) {
    metadata = JSON.parse(readFileSync(metadataPath, 'utf8'))
  }

  return {
    policies,
    updatedAt: typeof metadata.updatedAt === 'string' ? metadata.updatedAt : '',
    updatedBy: typeof metadata.updatedBy === 'string' ? metadata.updatedBy : '',
  }
}

export function writePolicies(
  policies: PolicyRecord[],
  actor: string,
  baseDir = defaultDir(),
): PolicyPayload {
  if (!Array.isArray(policies)) throw new Error('订货政策数据格式错误')

  const current = join(baseDir, 'policies.json')
  if (existsSync(current)) {
    copyFileSync(current, join(baseDir, 'policies.backup.json'))
  }

  const metadata = {
    updatedAt: new Date().toISOString(),
    updatedBy: actor || '未知用户',
  }
  writeFileSync(current, JSON.stringify(policies, null, 2), 'utf8')
  writeFileSync(
    join(baseDir, 'policies.updated.json'),
    JSON.stringify(metadata, null, 2),
    'utf8',
  )

  return { policies, ...metadata }
}

export function getPolicyTemplatePath(baseDir = defaultDir()): string {
  return join(baseDir, '订货政策-上传模板.xlsx')
}
