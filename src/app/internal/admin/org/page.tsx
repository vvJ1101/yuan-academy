'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { PageHeader } from '@/components/internal/page-header'
import { Building2, Users, Plus, Pencil, Trash2, FolderTree, ChevronRight, ChevronDown } from 'lucide-react'

interface Company {
  id: string; name: string; slug: string; description?: string
  _count: { departments: number; users: number }
}

interface Department {
  id: string; name: string; slug: string; companyId: string
  company: { id: string; name: string; slug: string }
  _count: { users: number }
}

export default function OrgPage() {
  const [companies, setCompanies] = useState<Company[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [loading, setLoading] = useState(true)

  // Company form
  const [showCompForm, setShowCompForm] = useState(false)
  const [editingComp, setEditingComp] = useState<Company | null>(null)
  const [compForm, setCompForm] = useState({ name: '', slug: '', description: '' })

  // Department form
  const [showDeptForm, setShowDeptForm] = useState(false)
  const [editingDept, setEditingDept] = useState<Department | null>(null)
  const [deptForm, setDeptForm] = useState({ name: '', slug: '', companyId: '', description: '' })

  const [message, setMessage] = useState('')
  const [msgType, setMsgType] = useState<'success' | 'error'>('success')
  const [expandedComp, setExpandedComp] = useState<Set<string>>(new Set())

  async function loadData() {
    try {
      const [cRes, dRes] = await Promise.all([
        fetch('/api/companies'),
        fetch('/api/departments'),
      ])
      const cData = await cRes.json()
      const dData = await dRes.json()
      if (Array.isArray(cData)) setCompanies(cData)
      if (Array.isArray(dData)) setDepartments(dData)
    } catch {
      setMsgType('error'); setMessage('加载失败')
    }
    setLoading(false)
  }

  useEffect(() => { loadData() }, [])

  function showMsg(t: 'success' | 'error', m: string) {
    setMsgType(t); setMessage(m)
    setTimeout(() => setMessage(''), 3000)
  }

  // ── Company CRUD ──
  function openNewComp() {
    setEditingComp(null)
    setCompForm({ name: '', slug: '', description: '' })
    setShowCompForm(true)
  }
  function openEditComp(c: Company) {
    setEditingComp(c)
    setCompForm({ name: c.name, slug: c.slug, description: c.description || '' })
    setShowCompForm(true)
  }
  async function saveComp(e: React.FormEvent) {
    e.preventDefault()
    const method = editingComp ? 'PUT' : 'POST'
    const body = editingComp ? { id: editingComp.id, ...compForm } : compForm
    try {
      const res = await fetch('/api/companies', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (res.ok) {
        showMsg('success', editingComp ? '公司已更新' : '公司已创建')
        setShowCompForm(false)
        loadData()
      } else {
        showMsg('error', data.error || '操作失败')
      }
    } catch {
      showMsg('error', '网络错误')
    }
  }
  async function deleteComp(c: Company) {
    if (!confirm(`确定删除公司「${c.name}」？此操作将同时删除所有关联部门和用户。`)) return
    try {
      const res = await fetch(`/api/companies?id=${c.id}`, { method: 'DELETE' })
      if (res.ok) { showMsg('success', '公司已删除'); loadData() }
      else { const d = await res.json().catch(() => ({})); showMsg('error', d.error || '删除失败') }
    } catch {
      showMsg('error', '网络错误')
    }
  }

  // ── Department CRUD ──
  function openNewDept(companyId?: string) {
    setEditingDept(null)
    setDeptForm({ name: '', slug: '', companyId: companyId || (companies[0]?.id || ''), description: '' })
    setShowDeptForm(true)
  }
  function openEditDept(d: Department) {
    setEditingDept(d)
    setDeptForm({ name: d.name, slug: d.slug, companyId: d.companyId, description: '' })
    setShowDeptForm(true)
  }
  async function saveDept(e: React.FormEvent) {
    e.preventDefault()
    const method = editingDept ? 'PUT' : 'POST'
    const body = editingDept ? { id: editingDept.id, ...deptForm } : deptForm
    try {
      const res = await fetch('/api/departments', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (res.ok) {
        showMsg('success', editingDept ? '部门已更新' : '部门已创建')
        setShowDeptForm(false)
        loadData()
      } else {
        showMsg('error', data.error || '操作失败')
      }
    } catch {
      showMsg('error', '网络错误')
    }
  }
  async function deleteDept(d: Department) {
    if (!confirm(`确定删除部门「${d.name}」？`)) return
    try {
      const res = await fetch(`/api/departments?id=${d.id}`, { method: 'DELETE' })
      if (res.ok) { showMsg('success', '部门已删除'); loadData() }
      else { const d2 = await res.json().catch(() => ({})); showMsg('error', d2.error || '删除失败') }
    } catch {
      showMsg('error', '网络错误')
    }
  }

  function toggleComp(id: string) {
    setExpandedComp(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  function deptsByCompany(companyId: string) {
    return departments.filter(d => d.companyId === companyId)
  }

  const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div className="mb-3">
      <label className="block text-[0.72rem] font-medium text-neutral-600 mb-1">{label}</label>
      {children}
    </div>
  )

  const inputCls = "w-full px-3 py-2 border border-neutral-300 rounded-lg text-[0.85rem] focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:border-transparent"

  if (loading) {
    return (
      <div className="max-w-[960px] mx-auto px-5 md:px-8 py-8">
        <PageHeader title="组织架构" backTo="/internal/admin" backLabel="返回管理中心" />
        <div className="space-y-3 mt-8">
          {[1,2,3].map(i => <div key={i} className="h-[72px] bg-neutral-100 rounded-xl animate-pulse" />)}
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-[960px] mx-auto px-5 md:px-8 py-8">
      <PageHeader title="组织架构" backTo="/internal/admin" backLabel="返回管理中心" />

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-[1.4rem] font-semibold tracking-[-0.02em] text-[#111]">组织架构</h1>
          <p className="text-[0.85rem] text-neutral-500 mt-1">管理公司、部门与用户</p>
        </div>
        <Link href="/internal/admin/users"
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#2563EB] text-white text-[0.8rem] font-medium rounded-lg hover:bg-blue-600 transition-colors no-underline">
          <Users size={15} strokeWidth={1.5} />
          用户管理
        </Link>
      </div>

      {message && (
        <div className={`mb-4 px-4 py-2.5 rounded-lg text-[0.8rem] font-medium ${
          msgType === 'success' ? 'bg-green-50 text-green-700 border border-green-100' : 'bg-red-50 text-red-600 border border-red-100'
        }`}>
          {message}
        </div>
      )}

      {/* ═══ Companies Section ═══ */}
      <section className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="inline-flex items-center gap-1.5 text-[0.72rem] font-medium text-neutral-400 uppercase tracking-wider">
            <Building2 size={14} strokeWidth={1.5} />
            公司 ({companies.length})
          </h2>
          <button onClick={openNewComp}
            className="inline-flex items-center gap-1 px-3 py-1.5 text-[0.72rem] font-medium text-[#2563EB] bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors">
            <Plus size={13} strokeWidth={1.5} />
            添加公司
          </button>
        </div>

        <div className="space-y-2">
          {companies.map(c => {
            const compDepts = deptsByCompany(c.id)
            const isExpanded = expandedComp.has(c.id)
            return (
              <div key={c.id} className="bg-white rounded-xl border border-neutral-200 overflow-hidden shadow-sm">
                <div className="flex items-center gap-3 px-4 py-3.5">
                  <button onClick={() => toggleComp(c.id)}
                    className="p-0.5 text-neutral-400 hover:text-neutral-700 transition-colors">
                    {isExpanded ? <ChevronDown size={16} strokeWidth={1.5} /> : <ChevronRight size={16} strokeWidth={1.5} />}
                  </button>
                  <Building2 size={18} strokeWidth={1.5} className="text-[#2563EB] shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[0.9rem] font-semibold text-neutral-800">{c.name}</p>
                    <p className="text-[0.7rem] text-neutral-400">{c.slug}</p>
                  </div>
                  <div className="flex items-center gap-3 text-[0.72rem] text-neutral-400">
                    <span className="inline-flex items-center gap-1"><FolderTree size={12} strokeWidth={1.5} />{compDepts.length} 部门</span>
                    <span className="inline-flex items-center gap-1"><Users size={12} strokeWidth={1.5} />{c._count.users} 人</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => openNewDept(c.id)}
                      className="p-1.5 text-neutral-400 hover:text-[#2563EB] hover:bg-blue-50 rounded-lg transition-colors"
                      title="添加部门">
                      <Plus size={15} strokeWidth={1.5} />
                    </button>
                    <button onClick={() => openEditComp(c)}
                      className="p-1.5 text-neutral-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                      title="编辑公司">
                      <Pencil size={14} strokeWidth={1.5} />
                    </button>
                    <button onClick={() => deleteComp(c)}
                      className="p-1.5 text-neutral-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="删除公司">
                      <Trash2 size={14} strokeWidth={1.5} />
                    </button>
                  </div>
                </div>

                {/* Expanded: Department list */}
                {isExpanded && compDepts.length > 0 && (
                  <div className="border-t border-neutral-100 bg-neutral-50/50">
                    {compDepts.map(d => (
                      <div key={d.id} className="flex items-center gap-3 px-4 py-2.5 ml-10 border-b border-neutral-100 last:border-b-0">
                        <FolderTree size={14} strokeWidth={1.5} className="text-neutral-400 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-[0.82rem] font-medium text-neutral-700">{d.name}</p>
                          <p className="text-[0.68rem] text-neutral-400">{d.slug}</p>
                        </div>
                        <span className="text-[0.7rem] text-neutral-400 inline-flex items-center gap-1">
                          <Users size={11} strokeWidth={1.5} />{d._count.users} 人
                        </span>
                        <div className="flex items-center gap-0.5">
                          <button onClick={() => openEditDept(d)}
                            className="p-1.5 text-neutral-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors">
                            <Pencil size={13} strokeWidth={1.5} />
                          </button>
                          <button onClick={() => deleteDept(d)}
                            className="p-1.5 text-neutral-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                            <Trash2 size={13} strokeWidth={1.5} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {isExpanded && compDepts.length === 0 && (
                  <div className="border-t border-neutral-100 bg-neutral-50/30 px-4 py-3 ml-10">
                    <p className="text-[0.75rem] text-neutral-400">暂无部门，点击 + 添加</p>
                  </div>
                )}
              </div>
            )
          })}

          {companies.length === 0 && (
            <div className="text-center py-10 bg-white rounded-xl border border-dashed border-neutral-300">
              <Building2 size={28} strokeWidth={1} className="text-neutral-300 mx-auto mb-2" />
              <p className="text-[0.85rem] text-neutral-500">暂无公司</p>
              <button onClick={openNewComp}
                className="mt-3 px-4 py-2 bg-[#2563EB] text-white text-[0.75rem] font-medium rounded-lg hover:bg-blue-600">
                创建第一个公司
              </button>
            </div>
          )}
        </div>
      </section>

      {/* ═══ Company Form Modal ═══ */}
      {showCompForm && (
        <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4"
          onClick={e => { if (e.target === e.currentTarget) setShowCompForm(false) }}
          onKeyDown={e => { if (e.key === 'Escape') setShowCompForm(false) }}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-[440px] p-6" onClick={e => e.stopPropagation()}>
            <h3 className="text-[1rem] font-semibold text-neutral-800 mb-4">
              {editingComp ? '编辑公司' : '添加公司'}
            </h3>
            <form onSubmit={saveComp}>
              <Field label="公司名称">
                <input type="text" value={compForm.name} onChange={e => setCompForm(p => ({ ...p, name: e.target.value }))}
                  className={inputCls} placeholder="时胜" required />
              </Field>
              <Field label="标识 (slug)">
                <input type="text" value={compForm.slug} onChange={e => setCompForm(p => ({ ...p, slug: e.target.value }))}
                  className={inputCls} placeholder="shisheng" required />
              </Field>
              <Field label="描述（可选）">
                <input type="text" value={compForm.description} onChange={e => setCompForm(p => ({ ...p, description: e.target.value }))}
                  className={inputCls} placeholder="公司简介" />
              </Field>
              <div className="flex items-center gap-2 justify-end mt-5">
                <button type="button" onClick={() => setShowCompForm(false)}
                  className="px-4 py-2 text-[0.8rem] text-neutral-600 bg-neutral-100 rounded-lg hover:bg-neutral-200 transition-colors">
                  取消
                </button>
                <button type="submit"
                  className="px-4 py-2 text-[0.8rem] font-medium text-white bg-[#2563EB] rounded-lg hover:bg-blue-600 transition-colors">
                  {editingComp ? '保存' : '创建'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ═══ Department Form Modal ═══ */}
      {showDeptForm && (
        <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4"
          onClick={e => { if (e.target === e.currentTarget) setShowDeptForm(false) }}
          onKeyDown={e => { if (e.key === 'Escape') setShowDeptForm(false) }}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-[440px] p-6" onClick={e => e.stopPropagation()}>
            <h3 className="text-[1rem] font-semibold text-neutral-800 mb-4">
              {editingDept ? '编辑部门' : '添加部门'}
            </h3>
            <form onSubmit={saveDept}>
              <Field label="所属公司">
                <select value={deptForm.companyId} onChange={e => setDeptForm(p => ({ ...p, companyId: e.target.value }))}
                  className={inputCls} required>
                  {companies.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </Field>
              <Field label="部门名称">
                <input type="text" value={deptForm.name} onChange={e => setDeptForm(p => ({ ...p, name: e.target.value }))}
                  className={inputCls} placeholder="商品部" required />
              </Field>
              <Field label="标识 (slug)">
                <input type="text" value={deptForm.slug} onChange={e => setDeptForm(p => ({ ...p, slug: e.target.value }))}
                  className={inputCls} placeholder="shangpin" required />
              </Field>
              <div className="flex items-center gap-2 justify-end mt-5">
                <button type="button" onClick={() => setShowDeptForm(false)}
                  className="px-4 py-2 text-[0.8rem] text-neutral-600 bg-neutral-100 rounded-lg hover:bg-neutral-200 transition-colors">
                  取消
                </button>
                <button type="submit"
                  className="px-4 py-2 text-[0.8rem] font-medium text-white bg-[#2563EB] rounded-lg hover:bg-blue-600 transition-colors">
                  {editingDept ? '保存' : '创建'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
