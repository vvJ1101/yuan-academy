export interface RoleVO {
  id: string
  name: string
  code: string
  description: string
  dataScope: string
  createTime: string
  status: 'active' | 'disabled'
  userCount: number
}

export type DataScopeType = 'ALL' | 'SELF_AND_CHILDREN' | 'SELF' | 'PERSONAL' | 'CUSTOM'
export const DATA_SCOPE_LABELS: Record<string, string> = {
  ALL: '全部数据', SELF_AND_CHILDREN: '本级及下级', SELF: '仅本级', PERSONAL: '仅本人', CUSTOM: '自定义',
}

export interface MenuNode {
  id: string
  parentId: string | null
  name: string
  type: number       // 1=目录 2=菜单 3=按钮
  permission: string | null
  icon: string | null
  sort: number
  path: string | null
  children?: MenuNode[]
}

export interface UserVO {
  id: string
  name: string
  email: string
  department: string
  addedAt: string
}

export interface ApiResponse<T = unknown> {
  code: number
  message?: string
  data: T
}

export interface PageData<T = unknown> {
  list: T[]
  total: number
}

export interface RoleFormData {
  name: string
  code: string
  description?: string
  status: 'active' | 'disabled'
}
