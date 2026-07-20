import type { MenuNode } from '@/types/role-management'

export type PermissionModuleKey = 'knowledge' | 'brand' | 'smartApps' | 'admin' | 'other'

export const PERMISSION_MODULES: Array<{ key: PermissionModuleKey; label: string; description: string }> = [
  { key: 'knowledge', label: '知识中心', description: '文档、文件夹、SOP、收藏' },
  { key: 'brand', label: '品牌资料', description: '订货政策、品牌对接信息' },
  { key: 'smartApps', label: '智能应用', description: 'AI、搜索、FAQ' },
  { key: 'admin', label: '系统管理', description: '用户、角色、组织、审计、设置' },
  { key: 'other', label: '其他', description: '未归类权限' },
]

export const PERMISSION_TEMPLATES = {
  marketing: {
    label: '市场部模板',
    description: '品牌对接市场字段 + 订货政策查看',
    keys: ['menu.brand', 'menu.brand.contact', 'brandContact.viewMarketFields', 'menu.brand.ordering', 'brandOrdering.view'],
  },
  product: {
    label: '商品部模板',
    description: '品牌对接完整维护 + 订货政策查看',
    keys: [
      'menu.brand',
      'menu.brand.contact',
      'brandContact.viewFullFields',
      'brandContact.edit',
      'brandContact.upload',
      'brandContact.exportFullFields',
      'menu.brand.ordering',
      'brandOrdering.view',
    ],
  },
  brand: {
    label: '品牌部模板',
    description: '订货政策维护 + 品牌资料查看',
    keys: [
      'menu.brand',
      'menu.brand.ordering',
      'brandOrdering.view',
      'brandOrdering.edit',
      'brandOrdering.upload',
      'brandOrdering.parse',
      'brandOrdering.export',
    ],
  },
  readonly: {
    label: '只读模板',
    description: '基础页面查看 + 收藏 + 搜索',
    keys: [
      'menu.dashboard',
      'menu.documents',
      'menu.recent',
      'menu.favorites',
      'menu.search',
      'favorite.create',
      'favorite.delete',
    ],
  },
} as const

const MODULE_MATCHERS: Record<PermissionModuleKey, string[]> = {
  knowledge: ['menu.documents', 'document.', 'folder.', 'favorite.', 'menu.sop', 'menu.recent', 'menu.favorites', 'menu.policy', 'menu.policyUpload'],
  brand: ['menu.brand', 'brandOrdering.', 'brandContact.'],
  smartApps: ['menu.ai', 'ai.', 'menu.search', 'menu.faq', 'faq.'],
  admin: ['menu.admin', 'user.', 'org.', 'role.', 'analytics.', 'audit.', 'settings.', 'learningPath.', 'account.'],
  other: [],
}

function nodeText(node: MenuNode): string {
  return `${node.name || ''} ${node.permission || ''}`.toLowerCase()
}

function flatten(nodes: MenuNode[]): MenuNode[] {
  return nodes.flatMap(node => [node, ...flatten(node.children || [])])
}

export function getPermissionModuleKey(node: MenuNode): PermissionModuleKey {
  const text = `${node.name || ''} ${node.permission || ''}`
  for (const module of PERMISSION_MODULES) {
    if (module.key === 'other') continue
    if (MODULE_MATCHERS[module.key].some(prefix => text.includes(prefix))) return module.key
    if (module.key === 'brand' && text.includes('品牌')) return 'brand'
    if (module.key === 'knowledge' && (text.includes('知识') || text.includes('文档') || text.includes('SOP'))) return 'knowledge'
    if (module.key === 'smartApps' && (text.includes('AI') || text.includes('FAQ') || text.includes('搜索'))) return 'smartApps'
    if (module.key === 'admin' && (text.includes('管理') || text.includes('用户') || text.includes('角色'))) return 'admin'
  }
  return 'other'
}

export function filterPermissionTree(nodes: MenuNode[], query: string): MenuNode[] {
  const q = query.trim().toLowerCase()
  if (!q) return nodes
  const visit = (node: MenuNode): MenuNode | null => {
    const children = (node.children || []).map(visit).filter((child): child is MenuNode => Boolean(child))
    if (nodeText(node).includes(q) || children.length > 0) {
      return { ...node, children }
    }
    return null
  }
  return nodes.map(visit).filter((node): node is MenuNode => Boolean(node))
}

export function collectPermissionIdsByKeys(nodes: MenuNode[], keys: readonly string[]): string[] {
  const wanted = new Set(keys)
  return flatten(nodes)
    .filter(node => node.permission && wanted.has(node.permission))
    .map(node => node.id)
}

export function getRiskLevel(permission?: string | null): 'none' | 'medium' | 'high' {
  if (!permission) return 'none'
  if (
    permission.includes('delete') ||
    permission.includes('deleteAll') ||
    permission.includes('viewFullFields') ||
    permission.includes('exportFullFields') ||
    permission === 'settings.manage' ||
    permission === 'role.assignPermission' ||
    permission === 'role.assignDataScope'
  ) return 'high'
  if (
    permission.includes('upload') ||
    permission.includes('replace') ||
    permission.includes('edit') ||
    permission.includes('export') ||
    permission.includes('create')
  ) return 'medium'
  return 'none'
}

export function buildPermissionSummary(nodes: MenuNode[], checkedIds: string[]): string[] {
  const checked = new Set(checkedIds)
  const checkedNodes = flatten(nodes).filter(node => checked.has(node.id))
  const permissions = new Set(checkedNodes.map(node => node.permission).filter(Boolean))
  const summary: string[] = []

  if (permissions.has('menu.brand')) summary.push('可进入品牌资料')
  if (permissions.has('menu.brand.ordering') || permissions.has('brandOrdering.view')) summary.push('可查看订货政策')
  if (permissions.has('menu.brand.contact')) summary.push('可进入品牌对接信息')
  if (permissions.has('brandContact.viewMarketFields')) summary.push('可查看品牌对接信息中的市场字段')
  if (permissions.has('brandContact.viewFullFields')) summary.push('可查看品牌对接信息完整字段')
  if (permissions.has('brandContact.edit')) summary.push('可网页编辑品牌对接信息')
  if (permissions.has('brandContact.upload')) summary.push('可上传更新品牌对接信息')
  if (permissions.has('brandOrdering.edit')) summary.push('可编辑订货政策')
  if (permissions.has('brandOrdering.upload')) summary.push('可上传订货政策')

  const highRisk = checkedNodes.filter(node => getRiskLevel(node.permission) === 'high')
  if (highRisk.length > 0) summary.push(`包含 ${highRisk.length} 个高危权限，请保存前复核`)
  if (summary.length === 0) summary.push('暂未选择可识别的业务权限')
  return summary
}
