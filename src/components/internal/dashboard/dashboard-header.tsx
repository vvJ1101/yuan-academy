'use client'

import Link from 'next/link'
import { BookOpen, Upload, Star, Clock } from 'lucide-react'
import type { StatsData } from '@/types/dashboard'

const WEEKDAY = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']

interface Props {
  userName: string
  department?: string
  company?: string
  stats: StatsData
}

export function DashboardHeader({ userName, department, company, stats }: Props) {
  const now = new Date()
  const h = now.getHours()
  const greeting = h < 9 ? '早上好' : h < 12 ? '上午好' : h < 14 ? '中午好' : h < 18 ? '下午好' : '晚上好'
  const dateStr = `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日 ${WEEKDAY[now.getDay()]}`

  const statCards = [
    { label: '知识文档', value: stats.totalDocs, color: 'text-neutral-800' },
    { label: '已解析', value: stats.aiParsed, color: 'text-blue-600' },
    { label: '知识空间', value: stats.totalSpaces || 0, color: 'text-neutral-800' },
    { label: '覆盖部门', value: stats.totalDepts || 0, color: 'text-neutral-800' },
  ]

  const quickActions = [
    { icon: BookOpen, label: '文档', href: '/internal/documents' },
    { icon: Upload, label: '上传', href: '/internal/documents' },
    { icon: Star, label: '收藏', href: '/internal/favorites' },
    { icon: Clock, label: '最近', href: '/internal/recent' },
  ]

  return (
    <div className="mb-8">
      {/* Greeting row */}
      <div className="flex items-baseline justify-between mb-6">
        <div>
          <h1 className="text-[1.8rem] font-light tracking-[-0.02em] text-neutral-900">
            {greeting}，{userName}
          </h1>
          <p className="text-[0.8rem] text-neutral-400 mt-1 font-light">
            {[dateStr, department, company].filter(Boolean).join(' · ')}
          </p>
        </div>
        <div className="flex items-center gap-1">
          {quickActions.map(a => (
            <Link
              key={a.label}
              href={a.href}
              className="min-h-[44px] min-w-[44px] flex items-center justify-center text-neutral-300 hover:text-neutral-600 hover:bg-neutral-100 rounded-lg transition-colors no-underline"
              title={a.label}
            >
              <a.icon size={17} strokeWidth={1.5} />
            </Link>
          ))}
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-4 gap-3">
        {statCards.map(s => (
          <div key={s.label} className="bg-white border border-neutral-100 rounded-xl px-4 py-3">
            <p className={`text-[1.4rem] font-semibold tracking-[-0.02em] ${s.color}`}>{s.value}</p>
            <p className="text-[0.68rem] text-neutral-400 mt-0.5 font-light">{s.label}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
