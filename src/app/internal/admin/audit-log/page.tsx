'use client'

import { useEffect, useState } from 'react'
import { Table, Card, Breadcrumb, Tag, Space } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { Clock, FileText, Download, LogIn, Edit3, Trash2, Shield } from 'lucide-react'

const ACTION_META: Record<string, { label: string; color: string; icon: any }> = {
  view: { label: '查看', color: 'blue', icon: FileText },
  login: { label: '登录', color: 'green', icon: LogIn },
  edit: { label: '编辑', color: 'orange', icon: Edit3 },
  delete: { label: '删除', color: 'red', icon: Trash2 },
  download: { label: '下载', color: 'purple', icon: Download },
  'role:create': { label: '角色新增', color: 'cyan', icon: Shield },
  'role:update': { label: '角色修改', color: 'cyan', icon: Shield },
  'role:delete': { label: '角色删除', color: 'red', icon: Shield },
  'role:permissions': { label: '权限分配', color: 'geekblue', icon: Shield },
  'role:datascope': { label: '数据权限', color: 'geekblue', icon: Shield },
}

export default function AuditLogPage() {
  const [logs, setLogs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/audit').then(r => r.json()).then(d => {
      setLogs(Array.isArray(d) ? d : d.logs || d.data || [])
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  const columns: ColumnsType<any> = [
    { title: '时间', dataIndex: 'createdAt', width: 180, render: (v: string) => v?.replace('T', ' ')?.slice(0, 19) || '-' },
    { title: '操作用户', dataIndex: ['user', 'name'], width: 120 },
    {
      title: '操作类型', dataIndex: 'action', width: 120,
      render: (a: string) => {
        const meta = ACTION_META[a] || ACTION_META[a.split(':')[0]] || { label: a, color: 'default' }
        return <Tag color={meta.color}>{meta.label}</Tag>
      },
    },
    { title: '操作对象', dataIndex: 'documentId', render: (v: string) => v ? v.slice(0, 12) + '...' : '-' },
  ]

  return (
    <Card style={{ margin: 0, borderRadius: 8 }}>
      <Breadcrumb style={{ marginBottom: 16 }} items={[{ title: '系统管理' }, { title: '审计日志' }]} />
      <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
        <Clock size={18} />
        <span style={{ fontSize: 18, fontWeight: 600 }}>操作审计日志</span>
      </div>
      <Table rowKey="id" columns={columns} dataSource={logs} loading={loading}
        pagination={{ pageSize: 50, showSizeChanger: true, showTotal: (t) => `共 ${t} 条` }}
        scroll={{ x: 600 }} size="small" />
    </Card>
  )
}
