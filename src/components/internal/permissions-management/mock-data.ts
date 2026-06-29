import type { Role, PermissionNode, RoleUser } from './types'

export const MOCK_ROLES: Role[] = [
  { id: '1', name: '超级管理员', code: 'IT技术', description: '拥有系统全部操作权限', dataScope: 'self_and_children', status: 'active', createdAt: '2021-02-05 17:11:52', userCount: 2 },
  { id: '2', name: '市场部', code: '市场客户经理', description: '', dataScope: 'self_and_children', status: 'active', createdAt: '2025-05-06 15:31:27', userCount: 5 },
  { id: '3', name: '商品部', code: '商品采购', description: '', dataScope: 'self_and_children', status: 'active', createdAt: '2025-05-06 15:31:39', userCount: 3 },
  { id: '4', name: '品牌部', code: '品牌运营', description: '', dataScope: 'self_and_children', status: 'active', createdAt: '2025-05-08 15:02:34', userCount: 4 },
  { id: '5', name: '财务部', code: '财务部', description: '财务相关操作权限', dataScope: 'self_and_children', status: 'active', createdAt: '2025-08-12 16:33:26', userCount: 0 },
]

export const MOCK_PERMISSION_TREE: PermissionNode[] = [
  {
    key: 'system', title: '系统管理',
    children: [
      { key: 'system:user', title: '用户管理', children: [
        { key: 'system:user:create', title: '新增用户' },
        { key: 'system:user:edit', title: '编辑用户' },
        { key: 'system:user:delete', title: '删除用户' },
      ]},
      { key: 'system:role', title: '角色管理', children: [
        { key: 'system:role:assign', title: '分配权限' },
        { key: 'system:role:data-scope', title: '数据权限' },
      ]},
    ],
  },
  {
    key: 'order', title: '订单管理',
    children: [
      { key: 'order:list', title: '订单列表', children: [
        { key: 'order:list:export', title: '导出订单' },
        { key: 'order:list:view', title: '查看详情' },
      ]},
      { key: 'order:refund', title: '退款管理', children: [
        { key: 'order:refund:approve', title: '审核退款' },
      ]},
    ],
  },
  { key: 'content', title: '内容管理', children: [
    { key: 'content:article', title: '文章管理' },
    { key: 'content:category', title: '分类管理' },
  ]},
  { key: 'finance', title: '财务管理', children: [
    { key: 'finance:invoice', title: '发票管理' },
    { key: 'finance:report', title: '财务报表' },
  ]},
]

export const MOCK_ROLE_PERMISSIONS: Record<string, string[]> = {
  '1': ['system', 'system:user', 'system:user:create', 'system:user:edit', 'system:user:delete', 'system:role', 'system:role:assign', 'system:role:data-scope', 'order', 'order:list', 'order:list:export', 'order:list:view', 'order:refund', 'order:refund:approve', 'content', 'content:article', 'content:category', 'finance', 'finance:invoice', 'finance:report'],
  '2': ['system:user', 'system:user:create', 'system:user:edit'],
  '3': ['order:list', 'order:list:view'],
  '4': ['content', 'content:article', 'content:category'],
  '5': ['finance', 'finance:invoice', 'finance:report'],
}

export const MOCK_ROLE_USERS: Record<string, RoleUser[]> = {
  '1': [
    { id: 'u1', name: '张三', email: 'zhangsan@yuanshowroom.com', department: 'IT技术', addedAt: '2021-02-05 17:11:52' },
    { id: 'u2', name: '李四', email: 'lisi@yuanshowroom.com', department: 'IT技术', addedAt: '2021-03-10 09:30:00' },
  ],
  '2': [
    { id: 'u3', name: '王五', email: 'wangwu@yuanshowroom.com', department: '市场部', addedAt: '2025-05-06 15:31:27' },
  ],
}

export const MOCK_ALL_USERS: RoleUser[] = [
  { id: 'u1', name: '张三', email: 'zhangsan@yuanshowroom.com', department: 'IT技术', addedAt: '2021-02-05 17:11:52' },
  { id: 'u2', name: '李四', email: 'lisi@yuanshowroom.com', department: 'IT技术', addedAt: '2021-03-10 09:30:00' },
  { id: 'u3', name: '王五', email: 'wangwu@yuanshowroom.com', department: '市场部', addedAt: '2025-05-06 15:31:27' },
  { id: 'u4', name: '赵六', email: 'zhaoliu@yuanshowroom.com', department: '商品部', addedAt: '2025-05-06 15:31:27' },
  { id: 'u5', name: '孙七', email: 'sunqi@yuanshowroom.com', department: '品牌部', addedAt: '2025-05-08 15:02:34' },
  { id: 'u6', name: '周八', email: 'zhouba@yuanshowroom.com', department: '财务部', addedAt: '2025-08-12 16:33:26' },
]
