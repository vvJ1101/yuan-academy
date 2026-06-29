'use client'

import { useEffect, useState } from 'react'
import { Shield, Search, Plus, Building2, Users, User, X, ChevronDown, ChevronRight } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'

interface Company { id: string; name: string; slug: string }
interface Dept { id: string; name: string; slug: string; companyId: string }
interface UserObj { id: string; name: string; email: string; role: string; departmentId: string }

interface PermEntry {
  key: string; type: 'company' | 'department' | 'user'
  id: string; name: string; sublabel?: string
  permission: string; entryId?: string
  scope?: 'self' | 'self_and_children'
}

const PERM_OPTS = ['view', 'edit', 'delete', 'admin']
const PERM_LABELS: Record<string, string> = { view: '查看', edit: '编辑', delete: '删除', admin: '管理' }
const TYPE_LABELS: Record<string, string> = { company: '公司', department: '部门', user: '用户' }
const TYPE_ICONS: Record<string, any> = { company: Building2, department: Users, user: User }

interface Props {
  resourceType: 'folder' | 'document'
  resourceId: string; resourceName: string
  companies: Company[]; depts: Dept[]; users: UserObj[]
  onClose: () => void; onSave: () => void
}

export function PermissionEditor({ resourceType, resourceId, resourceName, companies, depts, users, onClose, onSave }: Props) {
  const [loading, setLoading] = useState(true)
  const [perms, setPerms] = useState<PermEntry[]>([])
  const [showPicker, setShowPicker] = useState(false)

  // Picker state
  const [pickerNode, setPickerNode] = useState<string | null>(null)
  const [pickerPerm, setPickerPerm] = useState('view')
  const [pickerTab, setPickerTab] = useState<'org' | 'search'>('org')
  const [expanded, setExpanded] = useState<Set<string>>(new Set(companies.map(c => c.id)))
  const [searchQ, setSearchQ] = useState('')

  const isFolder = resourceType === 'folder'
  const apiBase = isFolder ? '/api/folders/permissions' : `/api/documents/${resourceId}/permissions`
  const qp = isFolder ? `folderId=${resourceId}` : `documentId=${resourceId}`

  useEffect(() => {
    fetch(`${apiBase}?${qp}`).then(r => r.json()).then(d => {
      const list: PermEntry[] = (d.permissions || []).map((p: any) => {
        if (p.companyId) return { key: `c-${p.companyId}`, type: 'company' as const, id: p.companyId, name: p.company?.name || '', permission: p.permission, entryId: p.id, scope: 'self_and_children' as const }
        if (p.departmentId) return { key: `d-${p.departmentId}`, type: 'department' as const, id: p.departmentId, name: p.department?.name || '', sublabel: '', permission: p.permission, entryId: p.id, scope: 'self_and_children' as const }
        if (p.userId) return { key: `u-${p.userId}`, type: 'user' as const, id: p.userId, name: p.user?.name || '', sublabel: p.user?.email || '', permission: p.permission, entryId: p.id, scope: 'self' as const }
        return null
      }).filter(Boolean)
      setPerms(list)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [apiBase, qp])

  function addFromPicker() {
    if (!pickerNode) return
    const c = companies.find(x => x.id === pickerNode)
    const d = depts.find(x => x.id === pickerNode)
    const u = users.find(x => x.id === pickerNode)
    if (c && !perms.some(p => p.key === `c-${c.id}`)) setPerms([...perms, { key: `c-${c.id}`, type: 'company', id: c.id, name: c.name, permission: pickerPerm, scope: 'self_and_children' }])
    if (d && !perms.some(p => p.key === `d-${d.id}`)) setPerms([...perms, { key: `d-${d.id}`, type: 'department', id: d.id, name: d.name, permission: pickerPerm, scope: 'self_and_children' }])
    if (u && !perms.some(p => p.key === `u-${u.id}`)) setPerms([...perms, { key: `u-${u.id}`, type: 'user', id: u.id, name: u.name, sublabel: u.email, permission: pickerPerm, scope: 'self' }])
    setPickerNode(null); setShowPicker(false)
  }

  async function removePerm(key: string) {
    const p = perms.find(x => x.key === key)
    if (p?.entryId) await fetch(`${apiBase}?id=${p.entryId}`, { method: 'DELETE' })
    setPerms(prev => prev.filter(x => x.key !== key))
  }

  async function save() {
    for (const p of perms) { if (p.entryId) await fetch(`${apiBase}?id=${p.entryId}`, { method: 'DELETE' }) }
    for (const p of perms) {
      const body: any = { permission: p.permission, [isFolder ? 'folderId' : 'documentId']: resourceId }
      if (p.type === 'company') body.companyId = p.id
      else if (p.type === 'department') body.departmentId = p.id
      else if (p.type === 'user') body.userId = p.id
      await fetch(apiBase, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    }
    onSave(); onClose()
  }

  function renderNode(id: string, name: string, type: 'company' | 'department' | 'user', extra?: string) {
    const isChecked = ['c', 'd', 'u'].some(t => perms.some(p => p.key === `${t}-${id}`))
    const hc = (type === 'company' && depts.filter(d => d.companyId === id).length > 0) || (type === 'department' && users.filter(u => u.departmentId === id).length > 0)
    const isExp = expanded.has(id)
    const Icon = TYPE_ICONS[type]
    return (
      <div key={`${type}-${id}`}>
        <div className="flex items-center gap-1.5 py-1 px-3 text-[0.82rem] rounded-md cursor-pointer hover:bg-neutral-50" onClick={() => {
          if (hc) { const n = new Set(expanded); isExp ? n.delete(id) : n.add(id); setExpanded(n) }
          setPickerNode(id)
        }}>
          <div className="w-4 shrink-0">{hc ? (isExp ? <ChevronDown size={12} /> : <ChevronRight size={12} />) : <span className="w-4" />}</div>
          <Icon size={15} strokeWidth={1.5} className={type === 'company' ? 'text-amber-500' : type === 'department' ? 'text-blue-500' : 'text-neutral-500'} />
          <span className="flex-1 truncate">{name}</span>
          {extra && <span className="text-[0.68rem] text-neutral-400">{extra}</span>}
          {isChecked && <span className="text-[0.68rem] text-green-600">已添加</span>}
        </div>
        {isExp && type === 'company' && depts.filter(d => d.companyId === id).map(d => renderNode(d.id, d.name, 'department'))}
        {isExp && type === 'department' && users.filter(u => u.departmentId === id).map(u => renderNode(u.id, u.name, 'user'))}
      </div>
    )
  }

  if (loading) return <div className="p-10 text-center"><span className="animate-spin inline-block w-4 h-4 border-2 border-neutral-300 border-t-neutral-600 rounded-full" /></div>

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield size={18} strokeWidth={1.5} />
            权限管理 · {resourceName}
          </DialogTitle>
        </DialogHeader>

        {/* Add button */}
        <div className="flex items-center justify-end mb-3">
          <button onClick={() => setShowPicker(true)} className="flex items-center gap-1 px-3 py-1.5 text-[0.78rem] bg-neutral-900 text-white rounded-lg hover:bg-neutral-800">
            <Plus size={14} /> 添加权限
          </button>
        </div>

        {/* Permission list */}
        <div className="border border-neutral-200 rounded-xl overflow-hidden bg-white">
          <div className="grid grid-cols-[1fr_70px_90px_90px_36px] text-[0.72rem] font-medium text-neutral-400 border-b border-neutral-100 bg-neutral-50 px-3">
            <div className="py-2.5">账号/角色</div>
            <div className="py-2.5">类型</div>
            <div className="py-2.5">权限</div>
            <div className="py-2.5">范围</div>
            <div className="py-2.5"></div>
          </div>
          {perms.length === 0 ? (
            <div className="py-10 text-center text-[0.82rem] text-neutral-400">暂无权限设置</div>
          ) : (
            perms.map(p => {
              const Icon = TYPE_ICONS[p.type]
              return (
                <div key={p.key} className="grid grid-cols-[1fr_70px_90px_90px_36px] items-center border-b border-neutral-50 hover:bg-neutral-50/50 px-3">
                  <div className="flex items-center gap-2 py-2.5">
                    <Icon size={15} strokeWidth={1.5} className={p.type === 'company' ? 'text-amber-500' : p.type === 'department' ? 'text-blue-500' : 'text-neutral-500'} />
                    <div>
                      <p className="text-[0.82rem] text-neutral-800">{p.name}</p>
                      {p.sublabel && <p className="text-[0.65rem] text-neutral-400">{p.sublabel}</p>}
                    </div>
                  </div>
                  <div><span className="text-[0.7rem] text-neutral-400 px-2 py-0.5 rounded bg-neutral-50">{TYPE_LABELS[p.type]}</span></div>
                  <div>
                    <select value={p.permission} onChange={e => setPerms(prev => prev.map(x => x.key === p.key ? { ...x, permission: e.target.value } : x))}
                      className="text-[0.72rem] border border-neutral-200 rounded px-1.5 py-1 bg-white focus:outline-none w-full">
                      {PERM_OPTS.map(v => <option key={v} value={v}>{PERM_LABELS[v]}</option>)}
                    </select>
                  </div>
                  <div>
                    <select value={p.scope || 'self'} onChange={e => setPerms(prev => prev.map(x => x.key === p.key ? { ...x, scope: e.target.value as any } : x))}
                      className="text-[0.72rem] border border-neutral-200 rounded px-1.5 py-1 bg-white focus:outline-none w-full">
                      <option value="self">本级</option>
                      <option value="self_and_children" disabled={p.type === 'user'}>本级及子级</option>
                    </select>
                  </div>
                  <div className="flex justify-center py-2.5">
                    <button onClick={() => removePerm(p.key)} className="p-1 text-neutral-400 hover:text-red-500"><X size={14} /></button>
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* Picker */}
        {showPicker && (
          <div className="border border-neutral-200 rounded-xl overflow-hidden mt-3">
            <div className="flex border-b border-neutral-100">
              <button onClick={() => setPickerTab('org')} className={`flex-1 py-2 text-[0.82rem] text-center ${pickerTab === 'org' ? 'bg-white text-neutral-900 border-b-2 border-neutral-900' : 'bg-neutral-50 text-neutral-400'}`}>组织架构</button>
              <button onClick={() => setPickerTab('search')} className={`flex-1 py-2 text-[0.82rem] text-center ${pickerTab === 'search' ? 'bg-white text-neutral-900 border-b-2 border-neutral-900' : 'bg-neutral-50 text-neutral-400'}`}>搜索</button>
            </div>
            {pickerTab === 'org' ? (
              <div className="max-h-48 overflow-y-auto p-1">{companies.map(c => renderNode(c.id, c.name, 'company'))}</div>
            ) : (
              <div className="p-3">
                <div className="relative mb-2">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
                  <input value={searchQ} onChange={e => setSearchQ(e.target.value)} placeholder="搜索公司、部门或用户..." className="w-full pl-9 pr-3 py-2 text-[0.82rem] border border-neutral-200 rounded-lg focus:outline-none" />
                </div>
                <div className="max-h-36 overflow-y-auto space-y-0.5">
                  {[...users, ...depts, ...companies].filter(item => (item as any).name?.toLowerCase().includes(searchQ.toLowerCase())).slice(0, 20).map(item => {
                    const name = (item as any).name; const id = (item as any).id
                    const type = 'slug' in item ? (item as any).slug ? 'company' : 'department' : 'user'
                    const Icon = TYPE_ICONS[type]
                    return (
                      <div key={`${type}-${id}`} className={`flex items-center gap-2 px-3 py-1.5 text-[0.82rem] rounded-md cursor-pointer hover:bg-neutral-50 ${pickerNode === id ? 'bg-blue-50' : ''}`} onClick={() => setPickerNode(id)}>
                        <Icon size={14} className={type === 'company' ? 'text-amber-500' : type === 'department' ? 'text-blue-500' : 'text-neutral-400'} />
                        <span>{name}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
            {pickerNode && (
              <div className="flex items-center gap-2 px-3 py-2 border-t border-neutral-100 bg-neutral-50">
                <select value={pickerPerm} onChange={e => setPickerPerm(e.target.value)} className="text-[0.78rem] border border-neutral-200 rounded px-2 py-1.5 bg-white focus:outline-none">
                  {PERM_OPTS.map(v => <option key={v} value={v}>{PERM_LABELS[v]}</option>)}
                </select>
                <button onClick={addFromPicker} className="px-3 py-1.5 text-[0.78rem] bg-neutral-900 text-white rounded-lg hover:bg-neutral-800">添加</button>
              </div>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-end gap-2 mt-4">
          <button onClick={onClose} className="min-h-[44px] px-5 text-[0.82rem] text-neutral-600 border border-neutral-200 rounded-lg hover:bg-neutral-50">取消</button>
          <button onClick={save} className="min-h-[44px] px-5 text-[0.82rem] text-white bg-neutral-900 rounded-lg hover:bg-neutral-800">保存</button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
