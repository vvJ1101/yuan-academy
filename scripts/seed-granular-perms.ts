import { prisma } from '../src/lib/prisma'

async function main() {
  await prisma.sysRoleMenu.deleteMany()
  await prisma.sysMenu.deleteMany()
  console.log('Cleared')

  const menus = [
    // Dashboard
    { id: 'm-dash', name: '仪表盘', type: 2, sort: 1, path: '/internal/dashboard', permission: 'dashboard:view' },

    // Knowledge Center
    { id: 'm-know', name: '知识中心', type: 1, sort: 2 },
    { id: 'm-know-list', name: '文档列表', type: 2, sort: 1, parentId: 'm-know', path: '/internal/documents', permission: 'knowledge:list' },
    { id: 'm-know-view', name: '查看详情', type: 3, sort: 2, parentId: 'm-know', permission: 'knowledge:view' },
    { id: 'm-know-upload', name: '上传文档', type: 3, sort: 3, parentId: 'm-know', permission: 'knowledge:upload' },
    { id: 'm-know-edit', name: '编辑文档', type: 3, sort: 4, parentId: 'm-know', permission: 'knowledge:edit' },
    { id: 'm-know-delete', name: '删除文档', type: 3, sort: 5, parentId: 'm-know', permission: 'knowledge:delete' },
    { id: 'm-know-ai', name: 'AI分析', type: 3, sort: 6, parentId: 'm-know', permission: 'knowledge:ai' },

    // Policy
    { id: 'm-policy', name: '订货政策', type: 2, sort: 3, path: '/internal/policy', permission: 'policy:view' },
    { id: 'm-policy-edit', name: '在线编辑', type: 3, sort: 1, parentId: 'm-policy', permission: 'policy:edit' },
    { id: 'm-policy-upload', name: '上传Excel', type: 3, sort: 2, parentId: 'm-policy', permission: 'policy:upload' },
    { id: 'm-policy-delete', name: '删除政策', type: 3, sort: 3, parentId: 'm-policy', permission: 'policy:delete' },

    // SOP
    { id: 'm-sop', name: 'SOP流程', type: 2, sort: 4, path: '/internal/sop', permission: 'sop:view' },

    // FAQ
    { id: 'm-faq', name: 'FAQ管理', type: 2, sort: 5, path: '/internal/faq', permission: 'faq:view' },
    { id: 'm-faq-add', name: '新增FAQ', type: 3, sort: 1, parentId: 'm-faq', permission: 'faq:create' },
    { id: 'm-faq-edit', name: '编辑FAQ', type: 3, sort: 2, parentId: 'm-faq', permission: 'faq:edit' },
    { id: 'm-faq-delete', name: '删除FAQ', type: 3, sort: 3, parentId: 'm-faq', permission: 'faq:delete' },

    // AI
    { id: 'm-ai', name: 'AI助手', type: 2, sort: 6, path: '/internal/ai', permission: 'ai:chat' },
    { id: 'm-ai-recommend', name: 'AI推荐', type: 3, sort: 1, parentId: 'm-ai', permission: 'ai:recommend' },
    { id: 'm-ai-risk', name: '风险分析', type: 3, sort: 2, parentId: 'm-ai', permission: 'ai:risk' },

    // Workspace

    // Personal
    { id: 'm-personal', name: '个人中心', type: 1, sort: 8 },
    { id: 'm-personal-fav', name: '我的收藏', type: 2, sort: 1, parentId: 'm-personal', path: '/internal/favorites', permission: 'personal:favorites' },
    { id: 'm-personal-recent', name: '最近访问', type: 2, sort: 2, parentId: 'm-personal', path: '/internal/recent', permission: 'personal:recent' },

    // Admin
    { id: 'm-admin', name: '管理中心', type: 1, sort: 99 },
    { id: 'm-admin-org', name: '组织架构', type: 2, sort: 1, parentId: 'm-admin', path: '/internal/admin/org', permission: 'admin:org:view' },
    { id: 'm-admin-users', name: '用户管理', type: 2, sort: 2, parentId: 'm-admin', path: '/internal/admin/users', permission: 'admin:users:list' },
    { id: 'm-admin-users-add', name: '新增用户', type: 3, sort: 1, parentId: 'm-admin-users', permission: 'admin:users:create' },
    { id: 'm-admin-users-edit', name: '编辑用户', type: 3, sort: 2, parentId: 'm-admin-users', permission: 'admin:users:edit' },
    { id: 'm-admin-users-del', name: '删除用户', type: 3, sort: 3, parentId: 'm-admin-users', permission: 'admin:users:delete' },
    { id: 'm-admin-folders', name: '文件夹管理', type: 2, sort: 3, parentId: 'm-admin', path: '/internal/admin/folders', permission: 'admin:folders:list' },
    { id: 'm-admin-folders-add', name: '新建文件夹', type: 3, sort: 1, parentId: 'm-admin-folders', permission: 'admin:folders:create' },
    { id: 'm-admin-folders-edit', name: '编辑文件夹', type: 3, sort: 2, parentId: 'm-admin-folders', permission: 'admin:folders:edit' },
    { id: 'm-admin-folders-del', name: '删除文件夹', type: 3, sort: 3, parentId: 'm-admin-folders', permission: 'admin:folders:delete' },
    { id: 'm-admin-analytics', name: '数据分析', type: 2, sort: 4, parentId: 'm-admin', path: '/internal/admin/analytics', permission: 'admin:analytics:view' },
    { id: 'm-admin-learning', name: '学习路径', type: 2, sort: 5, parentId: 'm-admin', path: '/internal/admin/learning-paths', permission: 'admin:learning:list' },
    { id: 'm-admin-settings', name: '系统设置', type: 2, sort: 6, parentId: 'm-admin', path: '/internal/admin/settings', permission: 'admin:settings' },
    { id: 'm-admin-roles', name: '角色权限', type: 2, sort: 7, parentId: 'm-admin', path: '/internal/admin/role-permissions', permission: 'admin:roles:list' },
    { id: 'm-admin-roles-assign', name: '分配权限', type: 3, sort: 1, parentId: 'm-admin-roles', permission: 'admin:roles:assign' },
    { id: 'm-admin-roles-del', name: '删除角色', type: 3, sort: 2, parentId: 'm-admin-roles', permission: 'admin:roles:delete' },
  ]

  for (const m of menus) {
    await prisma.sysMenu.create({ data: m as any })
  }
  console.log(`Created ${menus.length} menus`)

  const role = await prisma.sysRole.findUnique({ where: { code: 'SUPER_ADMIN' } })
  if (role) {
    const all = await prisma.sysMenu.findMany({ select: { id: true } })
    for (const m of all) {
      await prisma.sysRoleMenu.create({ data: { roleId: role.id, menuId: m.id } })
    }
    console.log(`Assigned ${all.length} menus to SUPER_ADMIN`)
  }

  await prisma.$disconnect()
}

main().catch(console.error)
