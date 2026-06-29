export interface Role {
  id: string
  name: string
  code: string
  description: string
  dataScope: DataScope
  status: 'active' | 'disabled'
  createdAt: string
  userCount: number
}

export type DataScope = 'all' | 'self_and_children' | 'self' | 'personal' | 'custom'
export const DATA_SCOPE_LABELS: Record<DataScope, string> = {
  all: '全部数据',
  self_and_children: '本级及下级',
  self: '仅本级',
  personal: '仅本人',
  custom: '自定义',
}

export interface PermissionNode {
  key: string
  title: string
  children?: PermissionNode[]
}

export interface RoleUser {
  id: string
  name: string
  email: string
  department: string
  avatar?: string
  addedAt: string
}

export interface RoleFormData {
  name: string
  code: string
  description: string
  status: 'active' | 'disabled'
}
