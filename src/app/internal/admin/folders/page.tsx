'use client'

import { useEffect, useState } from 'react'
import { Folder, Loader2, Lock, Pencil, Trash2 } from 'lucide-react'
import { PageHeader } from '@/components/internal/page-header'

interface Folder {
  id: string; name: string; slug: string; parentId: string | null
  companyId: string | null; inheritPermissions: boolean
  _count: { documents: number; children: number }
  company?: { id: string; name: string } | null
}
interface Company { id: string; name: string; slug: string }
interface Dept { id: string; name: string; slug: string; companyId: string }
interface FolderPerm {
  id: string; folderId: string; permission: string
  company?: { id: string; name: string } | null
  department?: { id: string; name: string } | null
}

const permLabels: Record<string, string> = { view: '查看', upload: '上传', edit: '编辑', delete: '删除', admin: '管理' }
const permOptions = ['view', 'upload', 'edit', 'delete', 'admin']

export default function FoldersPage() {
  const [folders, setFolders] = useState<Folder[]>([])
  const [companies, setCompanies] = useState<Company[]>([])
  const [depts, setDepts] = useState<Dept[]>([])
  const [loading, setLoading] = useState(true)

  // Form state
  const [showAdd, setShowAdd] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [parentId, setParentId] = useState<string | null>(null)
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [inherit, setInherit] = useState(true)

  // Permission panel
  const [permFolderId, setPermFolderId] = useState<string | null>(null)
  const [perms, setPerms] = useState<FolderPerm[]>([])
  const [permCompanyId, setPermCompanyId] = useState('')
  const [permDeptId, setPermDeptId] = useState('')
  const [permLevel, setPermLevel] = useState('view')
  const [showPermPanel, setShowPermPanel] = useState(false)

  const loadData = () => {
    Promise.all([
      fetch('/api/folders').then(r => r.json()),
      fetch('/api/companies').then(r => r.json()),
      fetch('/api/departments').then(r => r.json()),
    ]).then(([f, c, d]) => {
      setFolders(f.folders || [])
      if (Array.isArray(c)) setCompanies(c)
      if (Array.isArray(d)) setDepts(d)
      setLoading(false)
    })
  }
  useEffect(() => { loadData() }, [])

  const loadPerms = async (folderId: string) => {
    setPermFolderId(folderId)
    const res = await fetch(`/api/folders/permissions?folderId=${folderId}`)
    const d = await res.json()
    setPerms(d.permissions || [])
    setShowPermPanel(true)
  }

  const addPerm = async () => {
    if (!permFolderId) return
    await fetch('/api/folders/permissions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        folderId: permFolderId,
        companyId: permCompanyId || null,
        departmentId: permDeptId || null,
        permission: permLevel,
      }),
    })
    loadPerms(permFolderId)
  }

  const delPerm = async (id: string) => {
    await fetch(`/api/folders/permissions?id=${id}`, { method: 'DELETE' })
    if (permFolderId) loadPerms(permFolderId)
  }

  const resetForm = () => { setName(''); setParentId(null); setCompanyId(null); setInherit(true); setEditingId(null); setShowAdd(false) }

  const handleSave = async () => {
    if (!name.trim()) return
    if (editingId) {
      await fetch('/api/folders', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: editingId, name: name.trim(), companyId: companyId, inheritPermissions: inherit }),
      })
    } else {
      await fetch('/api/folders', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), parentId, companyId, inheritPermissions: inherit }),
      })
    }
    resetForm(); loadData()
  }

  const handleDelete = async (id: string) => {
    if (!confirm('删除此文件夹？子文件夹和文档将移至上级。')) return
    await fetch(`/api/folders?id=${id}`, { method: 'DELETE' })
    loadData()
  }

  const openEdit = (f: Folder) => {
    setEditingId(f.id); setName(f.name); setParentId(f.parentId); setCompanyId(f.companyId); setInherit(f.inheritPermissions); setShowAdd(true)
  }

  const topLevelFolders = folders.filter(f => !f.parentId)
  const childrenOf = (parentId: string) => folders.filter(f => f.parentId === parentId)

  const deptsForCompany = (cid: string | null) => cid ? depts.filter(d => d.companyId === cid) : depts

  if (loading) return <div className="flex justify-center py-20"><Loader2 size={20} strokeWidth={1.5} className="animate-spin text-[#2563EB]" /></div>

  return (
    <div className="max-w-[960px] mx-auto px-5 md:px-8 py-8">
      <PageHeader title="文件夹管理" backTo="/internal/admin" backLabel="返回管理中心" />
      <div className="flex items-center justify-between mb-6">
        <div><h1 className="text-[1.4rem] font-semibold tracking-[-0.02em] text-[#111]"><Folder size={22} strokeWidth={1.5} className="text-[#2563EB] inline mr-2" />文件夹管理</h1><p className="text-[0.82rem] text-neutral-500 mt-1">{folders.length} 个文件夹</p></div>
        <button onClick={() => { resetForm(); setShowAdd(true) }} className="px-4 py-2 bg-[#2563EB] text-white text-[0.78rem] font-medium rounded-lg hover:bg-blue-600">+ 新建文件夹</button>
      </div>

      {/* Folder Tree */}
      <div className="bg-white border border-neutral-200 rounded-xl overflow-hidden">
        {topLevelFolders.length === 0 ? (
          <p className="px-5 py-12 text-[0.85rem] text-neutral-400 text-center">暂无文件夹，点击上方按钮创建</p>
        ) : (
          topLevelFolders.map(f => <FolderRow key={f.id} folder={f} children={childrenOf(f.id)} level={0} onEdit={openEdit} onDelete={handleDelete} onPermissions={loadPerms} allFolders={folders} />)
        )}
      </div>

      {/* Add/Edit Modal */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh]">
          <div className="absolute inset-0 bg-black/40" onClick={resetForm} />
          <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 p-6">
            <h2 className="text-[1rem] font-semibold text-[#111] mb-5">{editingId ? '编辑文件夹' : '新建文件夹'}</h2>
            <div className="space-y-4">
              <div><label className="block text-[0.72rem] font-medium text-neutral-700 mb-1">名称</label><input type="text" value={name} onChange={e=>setName(e.target.value)} className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-[0.85rem] focus:outline-none focus:border-[#111]" autoFocus /></div>
              <div><label className="block text-[0.72rem] font-medium text-neutral-700 mb-1">父文件夹</label><select value={parentId || ''} onChange={e=>setParentId(e.target.value || null)} className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-[0.85rem]"><option value="">根目录</option>{folders.filter(x=>x.id!==editingId).map(f=><option key={f.id} value={f.id}>{f.name}</option>)}</select></div>
              <div><label className="block text-[0.72rem] font-medium text-neutral-700 mb-1">归属公司</label><select value={companyId || ''} onChange={e=>setCompanyId(e.target.value || null)} className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-[0.85rem]"><option value="">集团级</option>{companies.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
              <div className="flex items-center gap-2"><input type="checkbox" checked={inherit} onChange={e=>setInherit(e.target.checked)} id="inherit" /><label htmlFor="inherit" className="text-[0.8rem] text-neutral-600">继承父文件夹权限</label></div>
              <div className="flex gap-3 pt-2"><button onClick={resetForm} className="flex-1 px-4 py-2 border border-neutral-200 text-neutral-600 text-[0.82rem] rounded-lg hover:bg-neutral-50">取消</button><button onClick={handleSave} className="flex-1 px-4 py-2 bg-[#2563EB] text-white text-[0.82rem] rounded-lg hover:bg-blue-600">{editingId ? '保存' : '创建'}</button></div>
            </div>
          </div>
        </div>
      )}

      {/* Permissions Panel */}
      {showPermPanel && permFolderId && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh]">
          <div className="absolute inset-0 bg-black/40" onClick={()=>setShowPermPanel(false)} />
          <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 p-6">
            <div className="flex items-center justify-between mb-5"><h2 className="text-[1rem] font-semibold text-[#111]">权限设置</h2><button onClick={()=>setShowPermPanel(false)} className="text-neutral-400 hover:text-neutral-700 text-lg">&times;</button></div>

            {/* Existing permissions */}
            <div className="mb-5">
              <p className="text-[0.72rem] font-medium text-neutral-500 uppercase mb-2">已有权限规则</p>
              {perms.length === 0 ? <p className="text-[0.82rem] text-neutral-400">暂无规则</p> : (
                <div className="space-y-1">
                  {perms.map(p=>(
                    <div key={p.id} className="flex items-center justify-between px-3 py-2 bg-neutral-50 rounded-lg">
                      <span className="text-[0.82rem] text-neutral-700">{p.company?.name || p.department?.name || '?'} — {permLabels[p.permission]||p.permission}</span>
                      <button onClick={()=>delPerm(p.id)} className="text-[0.7rem] text-red-400 hover:text-red-600">删除</button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Add new permission */}
            <div className="border-t border-neutral-200 pt-4">
              <p className="text-[0.72rem] font-medium text-neutral-500 uppercase mb-3">添加权限规则</p>
              <div className="flex flex-wrap gap-2 mb-3">
                <select value={permCompanyId} onChange={e=>{setPermCompanyId(e.target.value);setPermDeptId('')}} className="px-2 py-1.5 text-[0.8rem] border border-neutral-200 rounded-lg"><option value="">公司级</option>{companies.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select>
                <span className="text-neutral-300 py-1.5">/</span>
                <select value={permDeptId} onChange={e=>setPermDeptId(e.target.value)} className="px-2 py-1.5 text-[0.8rem] border border-neutral-200 rounded-lg"><option value="">部门级</option>{deptsForCompany(permCompanyId||null).map(d=><option key={d.id} value={d.id}>{d.name}</option>)}</select>
                <span className="text-neutral-300 py-1.5">→</span>
                <select value={permLevel} onChange={e=>setPermLevel(e.target.value)} className="px-2 py-1.5 text-[0.8rem] border border-neutral-200 rounded-lg">{permOptions.map(o=><option key={o} value={o}>{permLabels[o]}</option>)}</select>
              </div>
              <button onClick={addPerm} disabled={!permCompanyId && !permDeptId} className="px-4 py-2 bg-[#2563EB] text-white text-[0.78rem] font-medium rounded-lg hover:bg-blue-600 disabled:opacity-50">添加</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Recursive folder row
function FolderRow({ folder, children, level, onEdit, onDelete, onPermissions, allFolders }: {
  folder: Folder; children: Folder[]; level: number
  onEdit: (f: Folder) => void; onDelete: (id: string) => void; onPermissions: (id: string) => void
  allFolders: Folder[]
}) {
  const [expanded, setExpanded] = useState(true)
  const indent = level * 20

  return (
    <>
      <div className="flex items-center border-b border-neutral-100 last:border-0 hover:bg-neutral-50 transition-colors" style={{ paddingLeft: `${12 + indent}px` }}>
        {children.length > 0 && (
          <button onClick={() => setExpanded(!expanded)} className="p-1 text-neutral-400 hover:text-neutral-600">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={`transition-transform ${expanded ? 'rotate-90' : ''}`}><polyline points="9 18 15 12 9 6" /></svg>
          </button>
        )}
        {children.length === 0 && <span className="w-[22px]" />}
        <Folder size={18} strokeWidth={1.5} className="text-[#2563EB] inline mr-2" />
        <div className="flex-1 py-3 min-w-0">
          <p className="text-[0.85rem] text-[#111] font-medium truncate">{folder.name}</p>
          <p className="text-[0.68rem] text-neutral-400">{folder._count.documents} 文档 · {folder._count.children} 子文件夹</p>
        </div>
        <div className="flex items-center gap-0.5 pr-3 shrink-0">
          <button onClick={() => onPermissions(folder.id)} className="px-2 py-1 text-[0.68rem] text-neutral-400 hover:text-neutral-600 rounded"><Lock size={14} strokeWidth={1.5} /></button>
          <button onClick={() => onEdit(folder)} className="px-2 py-1 text-neutral-400 hover:text-neutral-600 rounded"><Pencil size={14} strokeWidth={1.5} /></button>
          <button onClick={() => onDelete(folder.id)} className="px-2 py-1 text-[0.68rem] text-neutral-400 hover:text-red-600 rounded"><Trash2 size={14} strokeWidth={1.5} /></button>
        </div>
      </div>
      {expanded && children.map(child => (
        <FolderRow key={child.id} folder={child} children={allFolders.filter(f => f.parentId === child.id)} level={level + 1} onEdit={onEdit} onDelete={onDelete} onPermissions={onPermissions} allFolders={allFolders} />
      ))}
    </>
  )
}
