'use client'

import { useEffect, useState } from 'react'
import { PageHeader } from '@/components/internal/page-header'

interface User {
  id: string; email: string; name: string; role: string
  companyId: string | null; company: { id: string; name: string; slug: string } | null
  departmentId: string | null; department: { name: string; slug: string } | null
  createdAt: string
}

const roleLabels: Record<string, string> = {
  super_admin: '超级管理员', dept_admin: '部门管理员', staff: '普通员工',
}

interface Dept {
  id: string; name: string; slug: string
  companyId: string; company: { id: string; name: string; slug: string }
}

interface CompanyItem {
  id: string; name: string; slug: string
}

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([])
  const [departments, setDepartments] = useState<Dept[]>([])
  const [companies, setCompanies] = useState<CompanyItem[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState({ email: '', name: '', password: '', role: 'staff', companyId: '', departmentId: '' })
  const [companyIds, setCompanyIds] = useState<string[]>([]) // multi-company
  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState<'success' | 'error'>('success')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [batchDeleting, setBatchDeleting] = useState(false)

  async function loadData() {
    try {
      const [usersRes, deptsRes, companiesRes] = await Promise.all([
        fetch('/api/users'),
        fetch('/api/departments'),
        fetch('/api/companies'),
      ])
      const usersData = await usersRes.json()
      const deptsData = await deptsRes.json()
      const companiesData = await companiesRes.json()
      if (Array.isArray(usersData)) setUsers(usersData)
      if (Array.isArray(deptsData)) setDepartments(deptsData)
      if (Array.isArray(companiesData)) setCompanies(companiesData)
    } catch (err: any) {
      setUsers([])
      setMessageType('error'); setMessage('加载失败: ' + (err?.message || ''))
    }
    setLoading(false)
  }

  useEffect(() => { loadData() }, [])

  function resetForm() {
    setForm({ email: '', name: '', password: '', role: 'staff', companyId: '', departmentId: '' })
    setCompanyIds([])
    setEditingId(null)
    setShowForm(false)
  }

  // Filter departments by selected company
  const filteredDepts = form.companyId
    ? departments.filter(d => d.companyId === form.companyId)
    : departments

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setMessage('')

    if (editingId) {
      const res = await fetch('/api/users', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingId, name: form.name, role: form.role,
          companyId: form.companyId || null,
          departmentId: form.departmentId || null,
          companyIds,
          ...(form.password ? { password: form.password } : {}),
        }),
      })
      if (res.ok) {
        loadData(); resetForm()
        setMessageType('success'); setMessage('用户已更新')
      } else {
        let d: any = {}
        try { d = await res.json() } catch {}
        setMessageType('error'); setMessage(d.error || '更新失败')
      }
    } else {
      try {
        const res = await fetch('/api/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...form, companyIds }),
        })
        const d = await res.json()
        if (res.ok) {
          loadData(); resetForm()
          setMessageType('success'); setMessage('用户创建成功')
        } else {
          setMessageType('error'); setMessage(d.error || '创建失败')
        }
      } catch (err: any) {
        setMessageType('error')
        setMessage('创建失败: ' + (err?.message || String(err)))
      }
    }
  }

  function startEdit(u: User) {
    setForm({
      email: u.email, name: u.name, password: '',
      role: u.role, companyId: u.companyId || '', departmentId: u.departmentId || '',
    })
    // Fetch user's multi-company memberships
    fetch(`/api/users/${u.id}/companies`).then(r=>r.json()).then(d=>{
      if (d?.companyIds) setCompanyIds(d.companyIds)
      else setCompanyIds([])
    }).catch(()=>setCompanyIds([]))
    setEditingId(u.id)
    setShowForm(true)
  }

  async function handleDelete(id: string) {
    if (!confirm('确定删除该用户？')) return
    await fetch(`/api/users?id=${id}`, { method: 'DELETE' })
    loadData()
  }

  // 批量删除
  async function handleBatchDelete() {
    const ids = Array.from(selectedIds)
    if (ids.length === 0) return
    if (!confirm(`确定要删除选中的 ${ids.length} 个用户？此操作不可撤销。`)) return
    setBatchDeleting(true)
    try {
      const res = await fetch('/api/users/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', ids }),
      })
      const data = await res.json()
      if (res.ok) {
        setMessageType('success')
        setMessage(data.message || `成功删除 ${data.deleted} 个用户`)
      } else {
        setMessageType('error')
        setMessage(data.error || '批量删除失败')
      }
      setSelectedIds(new Set())
      loadData()
    } catch (err: any) {
      setMessageType('error')
      setMessage('批量删除失败: ' + (err?.message || String(err)))
    }
    setBatchDeleting(false)
  }

  function toggleSelect(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleSelectAll() {
    if (selectedIds.size === users.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(users.map(u => u.id)))
    }
  }

  if (loading) return <div className="p-8 text-[0.85rem] text-neutral-400">加载中...</div>

  return (
    <div className="p-4 md:p-8 lg:p-10 max-w-4xl">
      <PageHeader title="用户管理" backTo="/internal/admin" backLabel="返回管理中心" />
      <div className="flex items-center justify-between mb-6 md:mb-8">
        <div>
          <h1 className="text-[1.3rem] md:text-[1.5rem] font-semibold tracking-[-0.02em] text-neutral-900 mb-1">用户管理</h1>
          <p className="text-[0.8rem] md:text-[0.85rem] text-neutral-500 font-normal">{users.length} 个用户</p>
        </div>
        <button onClick={() => { resetForm(); setShowForm(!showForm) }}
          className="px-4 py-2 bg-[#2563EB] text-white text-[0.8rem] font-medium rounded-lg hover:bg-blue-600 transition-colors">
          {showForm ? '取消' : '新建用户'}
        </button>
      </div>

      {/* 批量操作栏 */}
      {selectedIds.size > 0 && (
      <div className="mb-4 flex items-center gap-3 px-4 py-3 bg-amber-50 border border-amber-200 rounded-lg">
        <span className="text-[0.82rem] text-amber-800 font-normal">
          已选择 <strong>{selectedIds.size}</strong> 个用户
        </span>
        <button
          onClick={handleBatchDelete}
          disabled={batchDeleting}
          className="px-4 py-1.5 bg-red-500 text-white text-[0.78rem] font-medium rounded-lg hover:bg-red-600 disabled:opacity-50 transition-colors"
        >
          {batchDeleting ? '删除中...' : '批量删除'}
        </button>
        <button
          onClick={() => setSelectedIds(new Set())}
          className="px-3 py-1.5 text-[0.78rem] text-neutral-600 hover:text-neutral-900 transition-colors"
        >
         取消选择
        </button>
      </div>
      )}

      {message && (
        <div className={`mb-4 p-3 text-[0.82rem] rounded-lg font-normal ${
          messageType === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'
        }`}>
          {messageType === 'success' ? '✓ ' : '✗ '}{message}
        </div>
      )}

      {/* Create/Edit form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="mb-8 p-5 bg-white border border-neutral-200 rounded-xl space-y-4">
          <h2 className="text-[0.9rem] font-semibold text-neutral-900">{editingId ? '编辑用户' : '新建用户'}</h2>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-[0.7rem] font-medium text-neutral-700 mb-1">邮箱</label>
              <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })}
                className="w-full px-3 py-2 border border-neutral-300 rounded-md text-[0.82rem] focus:outline-none focus:border-neutral-900 font-normal"
                required disabled={!!editingId} />
            </div>
            <div>
              <label className="block text-[0.7rem] font-medium text-neutral-700 mb-1">姓名</label>
              <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                className="w-full px-3 py-2 border border-neutral-300 rounded-md text-[0.82rem] focus:outline-none focus:border-neutral-900 font-normal" />
            </div>
            <div>
              <label className="block text-[0.7rem] font-medium text-neutral-700 mb-1">密码{editingId ? '（留空不修改）' : ''}</label>
              <input type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })}
                className="w-full px-3 py-2 border border-neutral-300 rounded-md text-[0.82rem] focus:outline-none focus:border-neutral-900 font-normal"
                required={!editingId} />
            </div>
            <div>
              <label className="block text-[0.7rem] font-medium text-neutral-700 mb-1">角色</label>
              <select value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}
                className="w-full px-3 py-2 border border-neutral-300 rounded-md text-[0.82rem] bg-white focus:outline-none focus:border-neutral-900 font-normal">
                {Object.entries(roleLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[0.7rem] font-medium text-neutral-700 mb-1">公司</label>
              <select
                value={form.companyId}
                onChange={e => setForm({ ...form, companyId: e.target.value, departmentId: '' })}
                className="w-full px-3 py-2 border border-neutral-300 rounded-md text-[0.82rem] bg-white focus:outline-none focus:border-neutral-900 font-normal"
              >
                <option value="">无公司</option>
                {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[0.7rem] font-medium text-neutral-700 mb-1">部门</label>
              <select value={form.departmentId} onChange={e => setForm({ ...form, departmentId: e.target.value })}
                className="w-full px-3 py-2 border border-neutral-300 rounded-md text-[0.82rem] bg-white focus:outline-none focus:border-neutral-900 font-normal">
                <option value="">无部门</option>
                {filteredDepts.map(d => <option key={d.id} value={d.id}>{d.name}{d.company ? ` (${d.company.name})` : ''}</option>)}
              </select>
            </div>
          </div>
          {/* Multi-company selector */}
          <div>
            <label className="block text-[0.7rem] font-medium text-neutral-700 mb-2">所属公司（可多选）</label>
            <div className="flex flex-wrap gap-2">
              {companies.map(c => (
                <label key={c.id} className="flex items-center gap-1.5 px-3 py-1.5 border border-neutral-200 rounded-lg text-[0.78rem] cursor-pointer hover:border-neutral-400 transition-colors">
                  <input type="checkbox" checked={companyIds.includes(c.id)} onChange={e=>{
                    if(e.target.checked) setCompanyIds([...companyIds,c.id])
                    else setCompanyIds(companyIds.filter(id=>id!==c.id))
                  }} className="w-3 h-3" />
                  {c.name}
                </label>
              ))}
            </div>
          </div>
          <button type="submit" className="px-5 py-2 bg-[#2563EB] text-white text-[0.8rem] font-medium rounded-lg hover:bg-blue-600 transition-colors">
            {editingId ? '保存修改' : '创建用户'}
          </button>
        </form>
      )}

      {/* User list */}
      <div className="bg-white border border-neutral-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-[0.8rem] md:text-[0.85rem]">
            <thead>
              <tr className="bg-neutral-50 border-b border-neutral-200">
                <th className="w-10 px-3 py-3">
                  <input
                    type="checkbox"
                    checked={users.length > 0 && selectedIds.size === users.length}
                    onChange={toggleSelectAll}
                    className="w-3.5 h-3.5"
                  />
                </th>
                <th className="text-left px-4 py-3 font-semibold text-neutral-700 text-[0.75rem]">用户</th>
                <th className="text-left px-4 py-3 font-semibold text-neutral-700 text-[0.75rem] hidden md:table-cell">角色</th>
                <th className="text-left px-4 py-3 font-semibold text-neutral-700 text-[0.75rem] hidden md:table-cell">公司</th>
                <th className="text-left px-4 py-3 font-semibold text-neutral-700 text-[0.75rem] hidden md:table-cell">部门</th>
                <th className="text-left px-4 py-3 font-semibold text-neutral-700 text-[0.75rem] hidden md:table-cell">创建时间</th>
                <th className="text-right px-4 py-3 font-semibold text-neutral-700 text-[0.75rem]">操作</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id} className="border-b border-neutral-100 hover:bg-neutral-50">
                  <td className="px-3 py-3">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(u.id)}
                      onChange={() => toggleSelect(u.id)}
                      className="w-3.5 h-3.5"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-neutral-800">{u.name}</p>
                    <p className="text-[0.7rem] text-neutral-400">{u.email}</p>
                    <div className="md:hidden mt-1 flex gap-2">
                      <span className="text-[0.65rem] text-neutral-500 bg-neutral-100 px-1.5 py-0.5 rounded">{roleLabels[u.role]}</span>
                      {u.company && <span className="text-[0.65rem] text-neutral-500 bg-neutral-100 px-1.5 py-0.5 rounded">{u.company.name}</span>}
                      {u.department && <span className="text-[0.65rem] text-neutral-500 bg-neutral-100 px-1.5 py-0.5 rounded">{u.department.name}</span>}
                    </div>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <span className="text-[0.7rem] bg-neutral-100 px-2 py-0.5 rounded text-neutral-600">{roleLabels[u.role]}</span>
                  </td>
                  <td className="px-4 py-3 text-neutral-600 hidden md:table-cell">{u.company?.name || '-'}</td>
                  <td className="px-4 py-3 text-neutral-600 hidden md:table-cell">{u.department?.name || '-'}</td>
                  <td className="px-4 py-3 text-neutral-500 hidden md:table-cell text-[0.75rem]">
                    {new Date(u.createdAt).toLocaleDateString('zh-CN')}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => startEdit(u)} className="text-[0.72rem] text-neutral-600 hover:text-neutral-900 mr-3">编辑</button>
                    <button onClick={() => handleDelete(u.id)} className="text-[0.72rem] text-red-500 hover:text-red-700">删除</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
