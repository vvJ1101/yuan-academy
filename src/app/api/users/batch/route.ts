 import { NextRequest, NextResponse } from 'next/server'
 import { prisma } from '@/lib/prisma'
 import { getSessionFromCookies } from '@/lib/auth'
 
 function forbid() { return NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
 
 export async function POST(req: NextRequest) {
   const session = getSessionFromCookies(req.headers.get('cookie'))
   if (!session?.id || session.role !== 'super_admin') return forbid()
 
   const { action, ids } = await req.json()
 
   if (action !== 'delete') {
     return NextResponse.json({ error: '仅支持 delete 操作' }, { status: 400 })
   }
 
   if (!Array.isArray(ids) || ids.length === 0) {
     return NextResponse.json({ error: '请选择要删除的用户' }, { status: 400 })
   }
 
   // 不能删除自己
   const filteredIds = ids.filter(id => id !== session.id)
   const skippedSelf = ids.length - filteredIds.length
 
   // 不能删除其他 super_admin
   const superAdmins = await prisma.user.findMany({
     where: { id: { in: filteredIds }, role: 'super_admin' },
     select: { id: true, name: true },
   })
   const superAdminIds = new Set(superAdmins.map(u => u.id))
   const finalIds = filteredIds.filter(id => !superAdminIds.has(id))
   const skippedSuperAdmin = filteredIds.length - finalIds.length
 
   if (finalIds.length === 0) {
     return NextResponse.json({
       ok: true, deleted: 0,
       skipped: skippedSelf + skippedSuperAdmin,
       message: '没有可删除的用户' +
         (skippedSelf > 0 ? '（不能删除自己）' : '') +
         (skippedSuperAdmin > 0 ? '（不能删除其他超级管理员）' : ''),
     })
   }
 
   // 执行批量删除
   let deleted = 0
   for (const id of finalIds) {
     try {
       await prisma.userCompany.deleteMany({ where: { userId: id } })
       await prisma.auditLog.deleteMany({ where: { userId: id } })
       await prisma.user.delete({ where: { id } })
       deleted++
     } catch (err) {
       console.error(`[批量删除用户] 删除用户 ${id} 失败:`, err)
     }
   }
 
   // 记录审计日志
   try {
     await prisma.auditLog.create({
       data: {
         userId: session.id,
         action: `batch_delete_users:${deleted}个`,
       },
     })
   } catch {
     // 审计日志不能阻塞主流程
   }
 
   return NextResponse.json({
     ok: true,
     deleted,
     skipped: skippedSelf + skippedSuperAdmin,
     message: `成功删除 ${deleted} 个用户` +
       (skippedSelf > 0 ? `，跳过自己 ${skippedSelf} 个` : '') +
       (skippedSuperAdmin > 0 ? `，跳过其他超级管理员 ${skippedSuperAdmin} 个` : ''),
   })
 }
