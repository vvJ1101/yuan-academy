'use client'

import { useEffect, useState } from 'react'
import { Wrench, Loader2, Database, Users, Folder, Building2, Clock, HardDrive } from 'lucide-react'
import { PageHeader } from '@/components/internal/page-header'

interface Stats {
  totalDocs: number; totalUsers: number; totalCompanies: number
  totalDepts: number; totalFolders: number; dbSizeMB: number
}

interface LogEntry { id: string; user: string; document: string; action: string; time: string }

export default function SettingsPage() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      fetch('/api/dashboard').then(r => r.json()).catch(() => ({})),
      fetch('/api/users').then(r => r.json()).catch(() => []),
      fetch('/api/companies').then(r => r.json()).catch(() => []),
      fetch('/api/departments').then(r => r.json()).catch(() => []),
      fetch('/api/folders').then(r => r.json()).catch(() => ({})),
      fetch('/api/audit').then(r => r.json()).catch(() => []),
    ]).then(([dash, users, companies, depts, folderData, auditLogs]) => {
      setStats({
        totalDocs: dash.docCount || 0,
        totalUsers: Array.isArray(users) ? users.length : 0,
        totalCompanies: Array.isArray(companies) ? companies.length : 0,
        totalDepts: Array.isArray(depts) ? depts.length : 0,
        totalFolders: folderData?.folders?.length || 0,
        dbSizeMB: folderData?.storage?.usedGB ? Math.round((folderData.storage.usedGB) * 1024) : 0,
      })
      if (Array.isArray(auditLogs)) setLogs(auditLogs.slice(0, 10))
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 size={18} strokeWidth={1} className="animate-spin text-neutral-400" />
      </div>
    )
  }

  const metricCards = [
    { icon: Database, label: '文档总数', value: stats?.totalDocs || 0, color: 'text-blue-600' },
    { icon: Users, label: '用户总数', value: stats?.totalUsers || 0, color: 'text-emerald-600' },
    { icon: Building2, label: '公司数', value: stats?.totalCompanies || 0, color: 'text-purple-600' },
    { icon: Users, label: '部门数', value: stats?.totalDepts || 0, color: 'text-amber-600' },
    { icon: Folder, label: '知识空间', value: stats?.totalFolders || 0, color: 'text-rose-600' },
    { icon: HardDrive, label: '数据库', value: `${stats?.dbSizeMB || 0} MB`, color: 'text-teal-600' },
  ]

  const actionLabels: Record<string, string> = { view: '查看文档', login: '登录系统', download: '下载文档', edit: '编辑文档', create: '创建文档', delete: '删除文档' }

  return (
    <div className="max-w-[800px] mx-auto px-5 md:px-8 py-8">
      <PageHeader title="系统设置" backTo="/internal/admin" backLabel="返回管理中心" />
      <h1 className="text-[1.4rem] font-semibold tracking-[-0.02em] text-[#111] mb-1 flex items-center gap-2">
        <Wrench size={20} strokeWidth={1.5} className="text-neutral-700" />系统设置
      </h1>
      <p className="text-[0.85rem] text-neutral-500 mb-8">系统运行状态与基础配置</p>

      {/* System Overview */}
      <section className="mb-8">
        <h2 className="text-[0.85rem] font-semibold text-[#111] mb-4">系统概览</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {metricCards.map(m => (
            <div key={m.label} className="bg-white border border-neutral-200 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <m.icon size={15} strokeWidth={1.5} className={m.color} />
                <span className="text-[0.7rem] text-neutral-500">{m.label}</span>
              </div>
              <p className="text-[1.4rem] font-semibold text-neutral-800">{m.value}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Storage */}
      <section className="mb-8">
        <h2 className="text-[0.85rem] font-semibold text-[#111] mb-4">存储空间</h2>
        <div className="bg-white border border-neutral-200 rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[0.82rem] text-neutral-600">数据库文件</span>
            <span className="text-[0.82rem] font-semibold text-neutral-800">{stats?.dbSizeMB || 0} MB</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[0.82rem] text-neutral-600">上传文件目录</span>
            <span className="text-[0.72rem] text-neutral-400">—</span>
          </div>
          <div className="mt-3 pt-3 border-t border-neutral-100">
            <div className="flex items-center justify-between">
              <span className="text-[0.72rem] text-neutral-400">数据库位置</span>
              <span className="text-[0.72rem] font-mono text-neutral-500">prisma/dev.db</span>
            </div>
          </div>
        </div>
      </section>

      {/* Recent Activity */}
      <section>
        <h2 className="text-[0.85rem] font-semibold text-[#111] mb-4">最近操作</h2>
        <div className="bg-white border border-neutral-200 rounded-xl overflow-hidden">
          {logs.length > 0 ? (
            logs.map((log, i) => (
              <div key={log.id} className={`flex items-center justify-between px-5 py-3 ${i > 0 ? 'border-t border-neutral-100' : ''}`}>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[0.82rem] text-neutral-800 font-medium">{log.user}</span>
                    <span className="text-[0.68rem] px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-500">{actionLabels[log.action] || log.action}</span>
                  </div>
                  <p className="text-[0.72rem] text-neutral-400 mt-0.5 truncate">{log.document}</p>
                </div>
                <div className="ml-4 shrink-0 flex items-center gap-1.5">
                  <Clock size={12} strokeWidth={1.5} className="text-neutral-300" />
                  <span className="text-[0.68rem] text-neutral-400">{new Date(log.time).toLocaleString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                </div>
              </div>
            ))
          ) : (
            <div className="px-5 py-12 text-center">
              <p className="text-[0.85rem] text-neutral-400">暂无操作记录，或权限不足</p>
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
