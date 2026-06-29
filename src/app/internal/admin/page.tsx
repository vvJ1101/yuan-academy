'use client'

import Link from 'next/link'
import { Folder, Users, BookOpen, BarChart3, GraduationCap, MessageSquare, Wrench, Building2, Upload, Shield, Clock } from 'lucide-react'
import { PageHeader } from '@/components/internal/page-header'

const adminCards = [
  { href: '/internal/admin/org', icon: Building2, title: '组织架构', desc: '管理公司、部门结构与层级关系', color: 'bg-indigo-50 border-indigo-100' },
  { href: '/internal/admin/folders', icon: Folder, title: '文件夹管理', desc: '管理知识库目录结构与访问权限', color: 'bg-slate-50 border-slate-200' },
  { href: '/internal/admin/users', icon: Users, title: '用户管理', desc: '管理员工账号、角色与权限', color: 'bg-blue-50 border-blue-100' },
  { href: '/internal/documents', icon: BookOpen, title: '文档管理', desc: '上传、编辑、AI 解析知识文档', color: 'bg-green-50 border-green-100' },
  { href: '/internal/admin/analytics', icon: BarChart3, title: '数据分析', desc: '跨部门访问统计与使用分析', color: 'bg-purple-50 border-purple-100' },
  { href: '/internal/admin/learning-paths', icon: GraduationCap, title: '学习路径', desc: '创建与管理部门学习计划', color: 'bg-amber-50 border-amber-100' },
  { href: '/internal/faq', icon: MessageSquare, title: 'FAQ 管理', desc: '常见问题增删改查', color: 'bg-rose-50 border-rose-100' },
  { href: '/internal/policy-upload', icon: Upload, title: '政策更新', desc: '品牌订货政策上传与更新', color: 'bg-teal-50 border-teal-100' },
  { href: '/internal/admin/role-permissions', icon: Shield, title: '角色权限', desc: '角色管理与权限分配', color: 'bg-violet-50 border-violet-100' },
  { href: '/internal/admin/settings', icon: Wrench, title: '系统设置', desc: '基础配置与维护', color: 'bg-gray-50 border-gray-200' },
  { href: '/internal/admin/audit-log', icon: Clock, title: '审计日志', desc: '用户操作与系统变更记录', color: 'bg-sky-50 border-sky-100' },
]

export default function AdminPage() {
  return (
    <div className="max-w-[800px] mx-auto px-5 md:px-8 py-8">
      <PageHeader title="管理中心" backTo="/internal/dashboard" backLabel="返回首页" />
      <h1 className="text-[1.4rem] font-semibold tracking-[-0.02em] text-[#111] mb-1">管理中心</h1>
      <p className="text-[0.85rem] text-neutral-500 mb-8">系统管理与配置</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {adminCards.map(card => (
          <Link key={card.href} href={card.href}
            className={`flex items-start gap-4 p-5 rounded-xl border transition-all hover:shadow-sm no-underline ${card.color} hover:scale-[1.01]`}>
            <card.icon size={22} strokeWidth={1.5} className="text-neutral-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-[0.9rem] font-semibold text-[#111]">{card.title}</p>
              <p className="text-[0.78rem] text-neutral-500 mt-1">{card.desc}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
