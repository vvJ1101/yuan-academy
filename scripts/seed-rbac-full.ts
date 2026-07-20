import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const COMPANY_SLUG = 'shisheng'

async function main() {
  console.log('=== 开始同步 RBAC 权限体系（幂等模式：不删已有数据）===\n')

  // ── 1. 找到公司 ID ──
  const company = await prisma.company.findUnique({ where: { slug: COMPANY_SLUG } })
  if (!company) throw new Error(`公司 ${COMPANY_SLUG} 未找到`)
  const companyId = company.id
  console.log(`✅ 公司: ${company.name} (${companyId})`)

  // ── 2. 获取所有部门和用户 ──
  const depts = await prisma.department.findMany({ where: { companyId } })
  const deptMap = new Map(depts.map(d => [d.slug, d]))
  console.log(`✅ 部门 (${depts.length}个): ${depts.map(d => d.name).join(', ')}`)

  const users = await prisma.user.findMany({
    select: { id: true, name: true, email: true, role: true, departmentId: true, department: { select: { slug: true } } },
  })
  console.log(`✅ 用户 (${users.length}个): ${users.map(u => u.name).join(', ')}`)

  // ── 3. 创建/更新菜单树（幂等）──
  console.log('\n━━━ 同步菜单树（存在则更新，不存在则创建）━━━')

  interface MenuDef {
    name: string
    type: 1 | 2 | 3
    path?: string
    permission?: string
    icon?: string
    sort: number
    children?: MenuDef[]
  }

  const menuTree: MenuDef[] = [
    {
      name: '仪表盘', type: 1, icon: 'dashboard', sort: 1,
      children: [
        { name: '首页', type: 2, path: '/internal/dashboard', permission: 'menu.dashboard', sort: 1 },
      ],
    },
    {
      name: '知识中心', type: 1, icon: 'knowledge', sort: 2,
      children: [
        { name: '我的上传', type: 2, path: '/internal/documents', permission: 'menu.documents', sort: 1 },
        { name: '上传文档', type: 3, permission: 'document.upload', sort: 2 },
        { name: '编辑文档', type: 3, permission: 'document.edit', sort: 3 },
        { name: '删除文档', type: 3, permission: 'document.delete', sort: 4 },
        { name: '下载原文件', type: 3, permission: 'document.downloadOriginal', sort: 5 },
        { name: '打印文档', type: 3, permission: 'document.print', sort: 6 },
        { name: '替换文件', type: 3, permission: 'document.replace', sort: 7 },
        { name: 'AI 解析', type: 3, permission: 'document.aiAnalyze', sort: 8 },
        { name: 'OCR 识别', type: 3, permission: 'document.ocr', sort: 9 },
        { name: '查看历史版本', type: 3, permission: 'document.historyView', sort: 10 },
        { name: '批量管理文档', type: 3, permission: 'document.batchManage', sort: 11 },
        { name: '最近访问', type: 2, path: '/internal/recent', permission: 'menu.recent', sort: 12 },
        { name: '我的收藏', type: 2, path: '/internal/favorites', permission: 'menu.favorites', sort: 13 },
        { name: '收藏文档', type: 3, permission: 'favorite.create', sort: 14 },
        { name: '取消收藏', type: 3, permission: 'favorite.delete', sort: 15 },
        { name: 'SOP 流程', type: 2, path: '/internal/sop', permission: 'menu.sop', sort: 16 },
        { name: '订货政策（旧入口兼容）', type: 2, path: '/internal/policy', permission: 'menu.policy', sort: 17 },
        { name: '政策上传（旧入口兼容）', type: 2, path: '/internal/policy-upload', permission: 'menu.policyUpload', sort: 18 },
      ],
    },
    {
      name: '品牌资料', type: 1, icon: 'brand', sort: 3,
      children: [
        { name: '品牌资料入口', type: 2, path: '/internal/brand', permission: 'menu.brand', sort: 1 },
        { name: '订货政策', type: 2, path: '/internal/policy', permission: 'menu.brand.ordering', sort: 2 },
        { name: '查看订货政策', type: 3, permission: 'brandOrdering.view', sort: 3 },
        { name: '编辑订货政策', type: 3, permission: 'brandOrdering.edit', sort: 4 },
        { name: '上传订货政策', type: 3, permission: 'brandOrdering.upload', sort: 5 },
        { name: '解析订货政策', type: 3, permission: 'brandOrdering.parse', sort: 6 },
        { name: '导出订货政策', type: 3, permission: 'brandOrdering.export', sort: 7 },
        { name: '删除订货政策', type: 3, permission: 'brandOrdering.delete', sort: 8 },
        { name: '删除全部订货政策', type: 3, permission: 'brandOrdering.deleteAll', sort: 9 },
        { name: '品牌对接信息', type: 2, path: '/internal/brand?type=contact', permission: 'menu.brand.contact', sort: 10 },
        { name: '查看市场字段', type: 3, permission: 'brandContact.viewMarketFields', sort: 11 },
        { name: '查看完整字段', type: 3, permission: 'brandContact.viewFullFields', sort: 12 },
        { name: '编辑品牌对接信息', type: 3, permission: 'brandContact.edit', sort: 13 },
        { name: '上传品牌对接信息', type: 3, permission: 'brandContact.upload', sort: 14 },
        { name: '导出市场字段', type: 3, permission: 'brandContact.exportMarketFields', sort: 15 },
        { name: '导出完整字段', type: 3, permission: 'brandContact.exportFullFields', sort: 16 },
      ],
    },
    {
      name: '智能应用', type: 1, icon: 'ai', sort: 4,
      children: [
        { name: 'AI 搜索', type: 2, path: '/internal/ai', permission: 'menu.ai', sort: 1 },
        { name: 'AI 对话', type: 3, permission: 'ai.chat', sort: 2 },
        { name: 'AI 搜索操作', type: 3, permission: 'ai.search', sort: 3 },
        { name: 'AI 推荐', type: 3, permission: 'ai.recommend', sort: 4 },
        { name: 'AI 风险分析', type: 3, permission: 'ai.risk', sort: 5 },
        { name: 'FAQ', type: 2, path: '/internal/faq', permission: 'menu.faq', sort: 6 },
        { name: '新建 FAQ', type: 3, permission: 'faq.create', sort: 7 },
        { name: '编辑 FAQ', type: 3, permission: 'faq.edit', sort: 8 },
        { name: '删除 FAQ', type: 3, permission: 'faq.delete', sort: 9 },
        { name: '全局搜索', type: 2, path: '/internal/search', permission: 'menu.search', sort: 10 },
      ],
    },
    {
      name: '系统管理', type: 1, icon: 'admin', sort: 5,
      children: [
        { name: '管理中心', type: 2, path: '/internal/admin', permission: 'menu.admin', sort: 0 },
        { name: '用户管理', type: 2, path: '/internal/admin/users', permission: 'menu.admin.users', sort: 1 },
        { name: '新建用户', type: 3, permission: 'user.create', sort: 2 },
        { name: '编辑用户', type: 3, permission: 'user.edit', sort: 3 },
        { name: '删除用户', type: 3, permission: 'user.delete', sort: 4 },
        { name: '批量删除用户', type: 3, permission: 'user.batchDelete', sort: 5 },
        { name: '分配用户公司', type: 3, permission: 'user.assignCompany', sort: 6 },
        { name: '重置用户密码', type: 3, permission: 'user.resetPassword', sort: 7 },
        { name: '角色管理', type: 2, path: '/internal/admin/role-permissions', permission: 'menu.admin.roles', sort: 8 },
        { name: '权限管理（旧入口兼容）', type: 2, path: '/internal/admin/role-permissions', permission: 'menu.admin.permissions', sort: 9 },
        { name: '新建角色', type: 3, permission: 'role.create', sort: 10 },
        { name: '编辑角色', type: 3, permission: 'role.edit', sort: 11 },
        { name: '删除角色', type: 3, permission: 'role.delete', sort: 12 },
        { name: '分配菜单/按钮权限', type: 3, permission: 'role.assignPermission', sort: 13 },
        { name: '分配数据权限', type: 3, permission: 'role.assignDataScope', sort: 14 },
        { name: '选择角色用户', type: 3, permission: 'role.assignUser', sort: 15 },
        { name: '移除角色用户', type: 3, permission: 'role.removeUser', sort: 16 },
        { name: '文件夹管理', type: 2, path: '/internal/admin/folders', permission: 'menu.admin.folders', sort: 17 },
        { name: '新建文件夹', type: 3, permission: 'folder.create', sort: 18 },
        { name: '编辑文件夹', type: 3, permission: 'folder.edit', sort: 19 },
        { name: '删除文件夹', type: 3, permission: 'folder.delete', sort: 20 },
        { name: '管理文件夹权限', type: 3, permission: 'folder.permissionManage', sort: 21 },
        { name: '组织架构', type: 2, path: '/internal/admin/org', permission: 'menu.admin.org', sort: 22 },
        { name: '新建公司', type: 3, permission: 'org.companyCreate', sort: 23 },
        { name: '编辑公司', type: 3, permission: 'org.companyEdit', sort: 24 },
        { name: '删除公司', type: 3, permission: 'org.companyDelete', sort: 25 },
        { name: '新建部门', type: 3, permission: 'org.departmentCreate', sort: 26 },
        { name: '编辑部门', type: 3, permission: 'org.departmentEdit', sort: 27 },
        { name: '删除部门', type: 3, permission: 'org.departmentDelete', sort: 28 },
        { name: '学习路径', type: 2, path: '/internal/admin/learning-paths', permission: 'menu.admin.learningPaths', sort: 29 },
        { name: '新建学习路径', type: 3, permission: 'learningPath.create', sort: 30 },
        { name: '编辑学习路径', type: 3, permission: 'learningPath.edit', sort: 31 },
        { name: '删除学习路径', type: 3, permission: 'learningPath.delete', sort: 32 },
        { name: '统计分析', type: 2, path: '/internal/admin/analytics', permission: 'menu.admin.analytics', sort: 33 },
        { name: '查看统计分析', type: 3, permission: 'analytics.view', sort: 34 },
        { name: '审计日志', type: 2, path: '/internal/admin/audit-log', permission: 'menu.admin.audit', sort: 35 },
        { name: '查看审计日志', type: 3, permission: 'audit.view', sort: 36 },
        { name: '系统设置', type: 2, path: '/internal/admin/settings', permission: 'menu.admin.settings', sort: 37 },
        { name: '管理系统设置', type: 3, permission: 'settings.manage', sort: 38 },
        { name: '修改本人密码', type: 3, permission: 'account.changePassword', sort: 39 },
      ],
    },
  ]

  const menuPermissionMap = new Map<string, string>()

  async function upsertMenu(def: MenuDef, parentId?: string): Promise<string> {
    // Find existing by permission (type 2/3) or by name+type+parent (type 1 group headers)
    let existing: any = null
    if (def.permission) {
      existing = await prisma.sysMenu.findFirst({ where: { permission: def.permission } })
    } else if (def.type === 1) {
      existing = await prisma.sysMenu.findFirst({ where: { name: def.name, parentId: null, type: 1 } })
    }

    let menu: any
    if (existing) {
      menu = await prisma.sysMenu.update({
        where: { id: existing.id },
        data: {
          name: def.name, path: def.path ?? null,
          permission: def.permission ?? null, icon: def.icon ?? null,
          sort: def.sort, parentId: parentId ?? null, status: 1,
        },
      })
      console.log(`  ↻ 更新菜单「${def.name}」(id=${menu.id})`)
    } else {
      menu = await prisma.sysMenu.create({
        data: {
          name: def.name, type: def.type, path: def.path ?? null,
          permission: def.permission ?? null, icon: def.icon ?? null,
          sort: def.sort, parentId: parentId ?? null, status: 1,
        },
      })
      console.log(`  ✚ 新增菜单「${def.name}」(id=${menu.id})`)
    }

    if (def.permission) menuPermissionMap.set(def.permission, menu.id)
    if (def.children) {
      for (const child of def.children) {
        await upsertMenu(child, menu.id)
      }
    }
    return menu.id
  }

  for (const top of menuTree) {
    await upsertMenu(top)
  }

  console.log(`✅ 菜单树同步完成 (共 ${menuPermissionMap.size} 个权限点)`)

  // ── 4. 创建/更新部门角色（幂等：upsert by unique code）──
  console.log('\n━━━ 创建/更新角色 ━━━')

  type DeptPerms = {
    knowledge: string[]
    brand: string[]
    smartApps: string[]
    admin: string[]
  }

  const basicKnowledgePerms = [
    'menu.documents', 'menu.recent', 'menu.favorites', 'menu.sop',
    'favorite.create', 'favorite.delete',
  ]
  const documentEditorPerms = [
    'document.upload', 'document.edit', 'document.downloadOriginal',
    'document.print', 'document.replace', 'document.aiAnalyze', 'document.ocr',
  ]
  const documentAdminPerms = [
    ...documentEditorPerms,
    'document.delete', 'document.historyView', 'document.batchManage',
    'folder.create', 'folder.edit', 'folder.delete', 'folder.permissionManage',
  ]
  const aiReaderPerms = ['menu.ai', 'menu.search', 'ai.chat', 'ai.search', 'ai.recommend']
  const faqAdminPerms = ['menu.faq', 'faq.create', 'faq.edit', 'faq.delete']
  const brandMarketPerms = [
    'menu.brand', 'menu.brand.contact',
    'brandContact.viewMarketFields', 'brandContact.exportMarketFields',
  ]
  const brandFullPerms = [
    'menu.brand', 'menu.brand.contact',
    'brandContact.viewFullFields', 'brandContact.edit', 'brandContact.upload',
    'brandContact.exportFullFields',
  ]
  const orderingAdminPerms = [
    'menu.brand.ordering', 'menu.policy', 'menu.policyUpload',
    'brandOrdering.view', 'brandOrdering.edit', 'brandOrdering.upload',
    'brandOrdering.parse', 'brandOrdering.export', 'brandOrdering.delete',
  ]
  const systemAdminPerms = [
    'menu.admin', 'menu.admin.users', 'menu.admin.roles', 'menu.admin.permissions',
    'menu.admin.folders', 'menu.admin.org', 'menu.admin.learningPaths',
    'menu.admin.analytics', 'menu.admin.audit', 'menu.admin.settings',
    'user.create', 'user.edit', 'user.delete', 'user.batchDelete', 'user.assignCompany', 'user.resetPassword',
    'role.create', 'role.edit', 'role.delete', 'role.assignPermission',
    'role.assignDataScope', 'role.assignUser', 'role.removeUser',
    'org.companyCreate', 'org.companyEdit', 'org.companyDelete',
    'org.departmentCreate', 'org.departmentEdit', 'org.departmentDelete',
    'learningPath.create', 'learningPath.edit', 'learningPath.delete',
    'analytics.view', 'audit.view', 'settings.manage', 'account.changePassword',
  ]

  const deptRoleConfig: Record<string, { name: string; description: string; permissions: DeptPerms }> = {
    hr: {
      name: '人力资源', description: '人力资源部门 - 系统全面管理权限',
      permissions: {
        knowledge: [...basicKnowledgePerms, ...documentAdminPerms],
        brand: [...brandFullPerms, ...orderingAdminPerms],
        smartApps: [...aiReaderPerms, ...faqAdminPerms, 'ai.risk'],
        admin: systemAdminPerms,
      },
    },
    finance: {
      name: '财务部', description: '财务部门 - 文档查阅与 AI 搜索权限',
      permissions: {
        knowledge: basicKnowledgePerms,
        brand: ['menu.brand', 'menu.brand.ordering', 'brandOrdering.view'],
        smartApps: [...aiReaderPerms, 'menu.faq'],
        admin: [],
      },
    },
    brand: {
      name: '品牌部', description: '品牌部门 - 知识全面管理权限（文档、政策上传与管理）',
      permissions: {
        knowledge: [...basicKnowledgePerms, ...documentAdminPerms],
        brand: [...brandFullPerms, ...orderingAdminPerms],
        smartApps: [...aiReaderPerms, ...faqAdminPerms],
        admin: [],
      },
    },
    product: {
      name: '产品部', description: '产品部门 - 文档查阅与 AI 搜索权限',
      permissions: {
        knowledge: [...basicKnowledgePerms, ...documentEditorPerms],
        brand: [...brandFullPerms, ...orderingAdminPerms],
        smartApps: [...aiReaderPerms, 'menu.faq'],
        admin: [],
      },
    },
    marketing: {
      name: '市场部', description: '市场部门 - 品牌对接市场字段查看，不可管理完整内容',
      permissions: {
        knowledge: ['menu.recent', 'menu.favorites', 'favorite.create', 'favorite.delete'],
        brand: [...brandMarketPerms, 'menu.brand.ordering', 'brandOrdering.view'],
        smartApps: [],
        admin: [],
      },
    },
    showroom: {
      name: '展厅部', description: '展厅部门 - 文档查阅与 AI 搜索权限',
      permissions: {
        knowledge: basicKnowledgePerms,
        brand: [],
        smartApps: aiReaderPerms,
        admin: [],
      },
    },
    partner: {
      name: '合作伙伴', description: '合作伙伴 - 有限文档查阅权限',
      permissions: {
        knowledge: ['menu.documents', 'menu.recent', 'menu.favorites', 'favorite.create', 'favorite.delete'],
        brand: [],
        smartApps: ['menu.ai', 'menu.search', 'ai.chat', 'ai.search'],
        admin: [],
      },
    },
  }

  const dashboardPerm = 'menu.dashboard'
  const createdRoles: { slug: string; roleId: string }[] = []

  for (const [slug, config] of Object.entries(deptRoleConfig)) {
    const dept = deptMap.get(slug)
    if (!dept) {
      console.warn(`⚠️ 部门 ${slug} 未找到，跳过角色创建`)
      continue
    }

    const roleCode = `DEPT_${slug.toUpperCase()}`
    const role = await prisma.sysRole.upsert({
      where: { code: roleCode },
      update: { name: config.name, description: config.description },
      create: {
        name: config.name, code: roleCode,
        description: config.description, dataScope: 2, status: 1,
      },
    })

    // Replace role-menu assignments (删旧加新，保证跟配置一致)
    const rolePermKeys = new Set<string>()
    rolePermKeys.add(dashboardPerm)
    for (const key of config.permissions.knowledge) rolePermKeys.add(key)
    for (const key of config.permissions.brand) rolePermKeys.add(key)
    for (const key of config.permissions.smartApps) rolePermKeys.add(key)
    for (const key of config.permissions.admin) rolePermKeys.add(key)

    await prisma.sysRoleMenu.deleteMany({ where: { roleId: role.id } })
    for (const permKey of Array.from(rolePermKeys)) {
      const menuId = menuPermissionMap.get(permKey)
      if (!menuId) {
        console.warn(`⚠️ 权限 ${permKey} 未找到对应菜单 ID`)
        continue
      }
      await prisma.sysRoleMenu.create({ data: { roleId: role.id, menuId } })
    }

    createdRoles.push({ slug, roleId: role.id })
    console.log(`✅ 角色「${config.name}」(${roleCode}) — ${rolePermKeys.size} 个权限`)
  }

  // ── 5. 按部门分配用户到角色（幂等：不删已有，只补充）──
  console.log('\n━━━ 分配用户到角色 ━━━')

  let assignedCount = 0
  let skippedCount = 0
  for (const user of users) {
    if (user.role === 'super_admin') {
      console.log(`⏭️  ${user.name} (${user.email}) 是 super_admin，跳过`)
      continue
    }

    const userDeptSlug = user.department?.slug
    if (!userDeptSlug) {
      console.log(`⚠️  ${user.name} (${user.email}) 没有归属部门，跳过`)
      continue
    }

    const roleEntry = createdRoles.find(r => r.slug === userDeptSlug)
    if (!roleEntry) {
      console.log(`⚠️  ${user.name} (${user.email}) 部门 ${userDeptSlug} 无对应角色`)
      continue
    }

    // Only create if not already assigned (幂等关键!)
    const existing = await prisma.sysUserRole.findFirst({
      where: { userId: user.id, roleId: roleEntry.roleId }
    })
    if (!existing) {
      await prisma.sysUserRole.create({ data: { userId: user.id, roleId: roleEntry.roleId } })
      assignedCount++
      console.log(`✅ ${user.name} (${user.email}) → ${deptRoleConfig[userDeptSlug]?.name || userDeptSlug}`)
    } else {
      skippedCount++
    }
  }

  console.log(`\n━━━ 完成 ━━━`)
  console.log(`📊 菜单: ${menuPermissionMap.size} 个权限点`)
  console.log(`📊 角色: ${createdRoles.length} 个`)
  console.log(`📊 新分配用户: ${assignedCount} 人`)
  console.log(`📊 跳过已有: ${skippedCount} 人`)
}

main()
  .catch(e => {
    console.error('❌ 初始化失败:', e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
