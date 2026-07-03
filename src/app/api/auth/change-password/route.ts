 import { NextRequest, NextResponse } from 'next/server'
 import { prisma, getSessionFromCookies } from '@/lib/auth'
 import { compare, hash } from 'bcryptjs'
 
 export async function POST(req: NextRequest) {
   // 1. 身份校验
   const session = getSessionFromCookies(req.headers.get('cookie'))
   if (!session) {
     return NextResponse.json({ error: '请先登录' }, { status: 401 })
   }
 
   // 2. 解析请求体
   const body = await req.json().catch(() => ({}))
   const { currentPassword, newPassword } = body
 
   if (!currentPassword || !newPassword) {
     return NextResponse.json({ error: '当前密码和新密码不能为空' }, { status: 400 })
   }
 
   if (newPassword.length < 6) {
     return NextResponse.json({ error: '新密码至少 6 位' }, { status: 400 })
   }
   if (!/[a-zA-Z]/.test(newPassword)) {
     return NextResponse.json({ error: '新密码必须包含字母' }, { status: 400 })
   }
   if (!/\d/.test(newPassword)) {
     return NextResponse.json({ error: '新密码必须包含数字' }, { status: 400 })
   }
 
   if (currentPassword === newPassword) {
     return NextResponse.json({ error: '新密码不能与当前密码相同' }, { status: 400 })
   }
 
   // 3. 从数据库拉用户（包含密码哈希）
   const user = await prisma.user.findUnique({
     where: { id: session.id },
     select: { id: true, passwordHash: true },
   })
 
   if (!user) {
     return NextResponse.json({ error: '用户不存在' }, { status: 404 })
   }
 
   // 4. 验证当前密码
   const valid = await compare(currentPassword, user.passwordHash)
   if (!valid) {
     return NextResponse.json({ error: '当前密码错误' }, { status: 403 })
   }
 
   // 5. 哈希新密码并更新
   const newHash = await hash(newPassword, 12)
   await prisma.user.update({
     where: { id: user.id },
     data: { passwordHash: newHash },
   })
 
   // 6. 写审计日志
   try {
     await prisma.auditLog.create({
       data: {
         userId: user.id,
         action: 'change_password',
       },
     })
   } catch {
     console.error('[AUDIT] 密码修改审计日志写入失败')
   }
 
   return NextResponse.json({ ok: true, message: '密码修改成功' })
 }
