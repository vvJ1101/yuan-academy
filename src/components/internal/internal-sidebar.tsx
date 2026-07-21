'use client'

import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useState, useRef } from 'react'
import { Folder, ChevronDown, ChevronRight, Loader2, ScrollText } from 'lucide-react'
import { PermissionEditor } from '@/components/internal/PermissionEditor'
import { TreeFolder } from '@/components/internal/TreeFolder'
import { BRAND_LINKS, QUICK_LINKS } from '@/components/internal/sidebar-links'

interface FolderItem { id: string; name: string; slug: string; parentId: string | null; companyId: string | null; _count: { documents: number; children: number } }
interface Company { id: string; name: string; slug: string }

export function InternalSidebar({ onClose }: { onClose?: () => void }) {
  const pathname = usePathname() || ''
  const searchParams = useSearchParams()
  const router = useRouter()
  const [folders, setFolders] = useState<FolderItem[]>([])
  const [companies, setCompanies] = useState<Company[]>([])
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [activeId, setActiveId] = useState('')
  const [ctxMenu, setCtxMenu] = useState<any>(null)
  const [permTarget, setPermTarget] = useState<any>(null)
  const [depts, setDepts] = useState<{id:string;name:string;slug:string;companyId:string}[]>([])
  const [allUsers, setAllUsers] = useState<{id:string;name:string;email:string;role:string;departmentId:string}[]>([])
  const [storage, setStorage] = useState<{ usedGB: number; totalGB: number; percent: number }>({ usedGB: 0, totalGB: 100, percent: 0 })
  const ctxMenuRef = useRef<HTMLDivElement>(null)

  // ── Inline create state ──
  const [inlineCreate, setInlineCreate] = useState<{ parentId: string; name: string } | null>(null)
  const [inlineSaving, setInlineSaving] = useState(false)

  // ── Inline rename state ──
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [renameSaving, setRenameSaving] = useState(false)

  const [userPerms, setUserPerms] = useState<string[]>(['*'])
  const [permList, setPermList] = useState<string[]>(['*'])
  const [folderPerms, setFolderPerms] = useState<Record<string, string>>({})

  useEffect(() => {
    fetch('/api/auth/me').then(r=>r.json()).then(u=>{
      if(u?.permissions) setUserPerms(u.permissions)
    }).catch((err: any) => console.warn("[SilentError]", err))
    fetch('/api/user/permissions').then(r=>r.json()).then(d=>{ if(d?.code===0) setPermList(d.data.permissions||[]) }).catch((err: any) => console.warn("[SilentError]", err))

    fetch('/api/folders').then(r => r.json()).then(d => {
      if (d?.folders) {
        setFolders(d.folders)
        const perms: Record<string, string> = {}
        for (const f of d.folders) {
          if (f.userPermission) perms[f.id] = f.userPermission
        }
        setFolderPerms(perms)
      }
      if (d?.storage) setStorage(d.storage)
    }).catch((err: any) => console.warn("[SilentError]", err))
    fetch('/api/companies').then(r => r.json()).then(d => { if (Array.isArray(d)) setCompanies(d) }).catch((err: any) => console.warn("[SilentError]", err))
    fetch('/api/departments').then(r => r.json()).then(d => { if (Array.isArray(d)) setDepts(d) }).catch((err: any) => console.warn("[SilentError]", err))
    fetch('/api/users').then(r => r.json()).then(d => { if (Array.isArray(d)) setAllUsers(d) }).catch((err: any) => console.warn("[SilentError]", err))

    const handleRefresh = () => refreshFolders()
    window.addEventListener('folderRefresh', handleRefresh)
    return () => window.removeEventListener('folderRefresh', handleRefresh)
  }, [])

  const [menuPos, setMenuPos] = useState({ x: 0, y: 0 })

  useEffect(() => {
    if (!ctxMenu) return
    // 先设置初始位置为鼠标位置
    setMenuPos({ x: ctxMenu.x, y: ctxMenu.y })
    // 在 DOM 渲染后测量菜单尺寸并调整边界
    const adjust = () => {
      if (!ctxMenuRef.current) return
      const rect = ctxMenuRef.current.getBoundingClientRect()
      if (rect.width === 0 || rect.height === 0) {
        requestAnimationFrame(adjust)
        return
      }
      const maxX = window.innerWidth - rect.width - 8
      const maxY = window.innerHeight - rect.height - 8
      setMenuPos({
        x: Math.max(8, Math.min(ctxMenu.x, maxX)),
        y: Math.max(8, Math.min(ctxMenu.y, maxY)),
      })
    }
    requestAnimationFrame(adjust)
  }, [ctxMenu])

  async function refreshFolders() {
    const r = await fetch('/api/folders').then(r => r.json())
    if (r?.folders) {
      setFolders(r.folders)
      const perms: Record<string, string> = {}
      for (const f of r.folders) {
        if (f.userPermission) perms[f.id] = f.userPermission
      }
      setFolderPerms(perms)
    }
  }

  function handleNav() { onClose?.() }
  function goToDocuments(spaceId?: string, folderId?: string) {
    // 检查文件夹权限
    const targetId = folderId || spaceId
    if (targetId && folderPerms[targetId] === 'none') {
      alert('您没有访问该文件夹的权限')
      return
    }
    handleNav()
    if (!spaceId) { router.push('/internal/documents'); return }
    const params = new URLSearchParams()
    let rootId = spaceId
    let f = folders.find(x => x.id === rootId)
    if (f && f.parentId) {
      while (f && f.parentId) { rootId = f.parentId; f = folders.find(x => x.id === rootId) }
      params.set('space', rootId); params.set('folder', spaceId)
    } else {
      params.set('space', spaceId)
      if (folderId) params.set('folder', folderId)
    }
    router.push('/internal/documents?' + params.toString())
  }

// ── 权限标签（显示在每个文件夹旁边）──
function PermBadge({ perm }: { perm: string }) {
  const cfg: Record<string, { label: string; cls: string }> = {
    none:  { label: '无权限', cls: 'text-neutral-300 bg-neutral-50' },
    view:  { label: '只读', cls: 'text-emerald-600 bg-emerald-50' },
    edit:  { label: '编辑', cls: 'text-blue-600 bg-blue-50' },
    delete:{ label: '删除', cls: 'text-orange-600 bg-orange-50' },
    admin: { label: '管理', cls: 'text-purple-600 bg-purple-50' },
  }
  const c = cfg[perm] || cfg.none
  return <span className={`text-[0.6rem] px-1 py-[1px] rounded font-medium ${c.cls}`}>{c.label}</span>
}

  const isActive = (href: string) => {
    if (href.includes('?')) return pathname === href.split('?')[0]
    return pathname === href || pathname.startsWith(href + '/')
  }
  const toggle = (id: string) => { setExpanded(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n }) }
  const spaces = folders.filter(f => !f.parentId)
  const companySpaces = (cid: string | null) => spaces.filter(s => cid ? s.companyId === cid : !s.companyId)

  function countDocs(fid: string): number { const f = folders.find(x => x.id === fid); if (!f) return 0; let t = f._count?.documents || 0; folders.filter(x => x.parentId === fid).forEach(c => { t += countDocs(c.id) }); return t }
  const docCounts = new Map<string, number>(); folders.forEach(f => docCounts.set(f.id, countDocs(f.id)))

  function handleCtx(e: React.MouseEvent, f: any) { e.preventDefault(); e.stopPropagation(); setCtxMenu({ x: e.clientX, y: e.clientY, folder: f }) }

  // ═══ Inline Create ═══
  function ctxNewFolder(parentId: string) {
    setCtxMenu(null)
    setInlineCreate({ parentId, name: '新建文件夹' })
    if (parentId) setExpanded(prev => { const n = new Set(prev); n.add(parentId); return n })
  }

  async function saveInlineFolder() {
    if (!inlineCreate || !inlineCreate.name.trim()) { setInlineCreate(null); return }
    setInlineSaving(true)
    try {
      // 虚拟节点转换为真实的 parentId
      let actualParentId: string | null = inlineCreate.parentId
      if (inlineCreate.parentId === 'yuan-root' || inlineCreate.parentId === 'yuan-group') {
        actualParentId = null
      } else if (inlineCreate.parentId.startsWith('company-')) {
        // 公司节点下创建，parentId 为 null（创建知识空间）
        actualParentId = null
      }
      const siblings = folders.filter(f => f.parentId === actualParentId)
      if (siblings.some(f => f.name.toLowerCase() === inlineCreate.name.trim().toLowerCase())) {
        alert('已存在同名文件夹'); setInlineSaving(false); return
      }
      const res = await fetch('/api/folders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: inlineCreate.name.trim(), parentId: actualParentId, inheritPermissions: true }),
      })
      if (res.ok) { await refreshFolders(); setInlineCreate(null) }
      else { const d = await res.json().catch(() => ({})); alert(d.error || '创建失败') }
    } catch { alert('网络错误') }
    setInlineSaving(false)
  }

  function handleInlineKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') { e.preventDefault(); saveInlineFolder() }
    if (e.key === 'Escape') { setInlineCreate(null) }
  }

  // ═══ Inline Rename ═══
  function ctxStartRename(f: any) {
    setCtxMenu(null)
    setRenamingId(f.id)
    setRenameValue(f.name)
  }

  async function saveRename() {
    if (!renamingId || !renameValue.trim() || renameValue.trim() === folders.find(f => f.id === renamingId)?.name) {
      setRenamingId(null); return
    }
    setRenameSaving(true)
    try {
      const res = await fetch('/api/folders', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: renamingId, name: renameValue.trim() }),
      })
      if (res.ok) { await refreshFolders(); setRenamingId(null) }
      else { const d = await res.json().catch(() => ({})); alert(d.error || '重命名失败') }
    } catch { alert('网络错误') }
    setRenameSaving(false)
  }

  function handleRenameKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') { e.preventDefault(); saveRename() }
    if (e.key === 'Escape') { setRenamingId(null) }
  }

  // ═══ Other ctx actions ═══
  async function ctxDelete(f: any) {
    if (!isReal(f.id)) { alert('该节点不可删除'); return }
    if (!confirm('删除「' + f.name + '」？')) return
    await fetch('/api/folders?id=' + f.id, { method: 'DELETE' })
    await refreshFolders(); setCtxMenu(null)
  }
  function ctxPermissions(f: any) {
    if (!isReal(f.id)) { alert('该节点不支持权限管理'); return }
    setCtxMenu(null); setPermTarget({ id: f.id, name: f.name })
  }
  const isReal = (fid: string) => fid !== 'yuan-root' && fid !== 'yuan-group' && !fid.startsWith('company-')

  const navCls = (href: string) => isActive(href) ? 'flex items-center gap-2.5 px-3 py-2 rounded-lg text-[0.82rem] no-underline cursor-pointer bg-[#EBF5FF] text-[#2563EB] font-medium' : 'flex items-center gap-2.5 px-3 py-2 rounded-lg text-[0.82rem] no-underline cursor-pointer text-neutral-600 hover:bg-neutral-50'
  const canSeePermission = (permKey?: string) => {
    if (!permKey) return true
    if (userPerms.includes('*') || permList.includes('*')) return true
    if (userPerms.includes(permKey)) return true
    if (permList.includes(permKey)) return true
    if (permKey === 'admin' && permList.some(p => p.startsWith('admin:'))) return true
    if (permKey === 'menu.brand' && userPerms.some(p => p.startsWith('menu.brand.'))) return true
    if (permKey === 'menu.brand' && permList.some(p => p.startsWith('menu.brand.'))) return true
    return false
  }
  const visibleBrandLinks = BRAND_LINKS.filter(link => canSeePermission(link.permKey) || canSeePermission('menu.brand'))
  const brandOpen = pathname === '/internal/brand'
    || pathname.startsWith('/internal/brand/')
    || pathname === '/internal/policy'
    || pathname.startsWith('/internal/policy/')
  const brandExpanded = brandOpen || expanded.has('brand-data')
  const activeBrandType = pathname === '/internal/policy'
    || pathname.startsWith('/internal/policy/')
    ? 'ordering'
    : pathname === '/internal/brand'
      ? (searchParams.get('type') || 'contact')
      : ''

  return (
    <aside className="w-[260px] h-full bg-white border-r border-neutral-200 flex flex-col overflow-hidden">
      {/* Mobile close */}
      {onClose && (
        <div className="lg:hidden flex items-center justify-between px-4 py-3 border-b border-neutral-100">
          <span className="text-[0.8rem] font-semibold text-neutral-700">导航菜单</span>
          <button onClick={onClose} className="p-1 text-neutral-400 hover:text-neutral-700 rounded-lg hover:bg-neutral-100">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
      )}

      {/* Quick links */}
      <div className="shrink-0 py-2">
        <div className="px-3 mb-2">
          {QUICK_LINKS.filter(l => canSeePermission(l.permKey)).map(l => (
            <Link key={l.href} href={l.href} onClick={handleNav} className={navCls(l.href)}>
              <l.Icon size={16} strokeWidth={1.5} /><span>{l.label}</span>
            </Link>
          ))}
          {visibleBrandLinks.length > 0 && (
            <div className="mt-1">
              <button
                type="button"
                onClick={() => toggle('brand-data')}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[0.82rem] text-neutral-700 ${brandOpen ? 'bg-neutral-50' : 'hover:bg-neutral-50'}`}
              >
                <ScrollText size={16} strokeWidth={1.5} />
                <span className="font-medium">品牌资料</span>
                <ChevronDown size={13} strokeWidth={2} className={`ml-auto transition-transform ${brandExpanded ? '' : '-rotate-90'}`} />
              </button>
              {brandExpanded && (
                <div className="ml-6 mt-1 space-y-0.5 border-l border-neutral-100 pl-2">
                  {visibleBrandLinks.map(link => {
                    const active = activeBrandType === link.type
                    return (
                      <Link
                        key={link.href}
                        href={link.href}
                        onClick={handleNav}
                        className={`block rounded-lg px-3 py-1.5 text-[0.76rem] no-underline ${
                          active
                            ? 'bg-[#EBF5FF] text-[#2563EB] font-medium'
                            : 'text-neutral-500 hover:bg-neutral-50 hover:text-neutral-800'
                        }`}
                      >
                        {link.label}
                      </Link>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>
        <div className="mx-3 border-t border-neutral-100 mb-2" />
        <div className="px-3">
          <p className="text-[0.62rem] font-medium text-neutral-400 uppercase tracking-wider px-3 mb-1 cursor-pointer hover:text-neutral-600" onClick={() => goToDocuments()}>
            知识空间
          </p>
        </div>
      </div>

      {/* Folder tree */}
      <div className="flex-1 overflow-y-auto px-3 pb-2">
        <div className="flex items-center gap-1.5 px-1 py-1.5 text-[0.82rem] font-semibold text-[#111] cursor-pointer" onClick={() => toggle('yuan-root')} onContextMenu={e => handleCtx(e, { id: 'yuan-root', name: 'YUAN SHOWROOM', isSpace: true })}>
          {expanded.has('yuan-root') ? <ChevronDown size={12} strokeWidth={2.5} /> : <ChevronRight size={12} strokeWidth={2.5} />}
          <Folder size={14} strokeWidth={1.5} className="text-[#2563EB]" /><span>YUAN SHOWROOM</span>
        </div>

        {expanded.has('yuan-root') && (
          <div className="ml-2 mt-0.5 border-l border-neutral-100">
            {/* Inline create under yuan-root */}
            {inlineCreate?.parentId === 'yuan-root' && (
              <div className="py-0.5 px-2">
                <div className="flex items-center gap-1.5 px-2 py-1">
                  <Folder size={13} strokeWidth={1.5} className="text-[#60A5FA] opacity-60" />
                  <input autoFocus value={inlineCreate.name}
                    onChange={e => setInlineCreate({ parentId: 'yuan-root', name: e.target.value })}
                    onKeyDown={handleInlineKeyDown} onBlur={saveInlineFolder} disabled={inlineSaving}
                    className="flex-1 text-[0.78rem] px-1.5 py-0.5 border border-[#2563EB] rounded bg-white focus:outline-none focus:ring-1 focus:ring-[#2563EB]/30"
                    onFocus={e => e.target.select()} />
                  {inlineSaving && <Loader2 size={12} strokeWidth={2} className="animate-spin text-neutral-400 shrink-0" />}
                </div>
              </div>
            )}

            {/* ── 集团公共 ── */}
            {companySpaces(null).length > 0 && (
              <div className="mb-1">
                <div className="flex items-center gap-1.5 py-1.5 px-2 text-[0.8rem] font-medium text-neutral-700 cursor-pointer hover:bg-neutral-50 rounded-md"
                  onClick={() => toggle('yuan-group')}
                  onContextMenu={e => handleCtx(e, { id: 'yuan-group', name: '集团公共', isSpace: true })}>
                  {expanded.has('yuan-group') ? <ChevronDown size={12} strokeWidth={2} /> : <ChevronRight size={12} strokeWidth={2} />}
                  <Folder size={14} strokeWidth={1.5} className="text-[#2563EB]" /><span>集团公共</span>
                  <span className="text-[0.62rem] text-neutral-400 ml-auto" title={`${companySpaces(null).reduce((s, sp) => s + (docCounts.get(sp.id) || 0), 0)} 个文档`}>{companySpaces(null).reduce((s, sp) => s + (docCounts.get(sp.id) || 0), 0)}</span>
                </div>
                {/* Inline create under yuan-group */}
                {inlineCreate?.parentId === 'yuan-group' && (
                  <div className="py-0.5 px-2 ml-4">
                    <div className="flex items-center gap-1.5 px-2 py-1">
                      <Folder size={13} strokeWidth={1.5} className="text-[#60A5FA] opacity-60" />
                      <input autoFocus value={inlineCreate.name}
                        onChange={e => setInlineCreate({ parentId: 'yuan-group', name: e.target.value })}
                        onKeyDown={handleInlineKeyDown} onBlur={saveInlineFolder} disabled={inlineSaving}
                        className="flex-1 text-[0.78rem] px-1.5 py-0.5 border border-[#2563EB] rounded bg-white focus:outline-none focus:ring-1 focus:ring-[#2563EB]/30"
                        onFocus={e => e.target.select()} />
                      {inlineSaving && <Loader2 size={12} strokeWidth={2} className="animate-spin text-neutral-400 shrink-0" />}
                    </div>
                  </div>
                )}
                {expanded.has('yuan-group') && companySpaces(null).map(s => (
                  <div key={s.id}>
                    <div onClick={() => goToDocuments(s.id)}
                      onContextMenu={e => handleCtx(e, { id: s.id, name: s.name, isSpace: true })}
                      className="flex items-center gap-1.5 py-1.5 px-2 ml-4 text-[0.78rem] text-neutral-600 cursor-pointer hover:bg-neutral-50 rounded-md">
                      <Folder size={13} strokeWidth={1.5} className="text-[#2563EB]" />{s.name}
                      <PermBadge perm={folderPerms[s.id] || 'none'} />
                      {(docCounts.get(s.id) || 0) > 0 && <span className="text-[0.62rem] text-neutral-400 ml-auto" title={`${docCounts.get(s.id)} 个文档`}>{docCounts.get(s.id)}</span>}
                    </div>
                    {/* Inline create under group space */}
                    {inlineCreate?.parentId === s.id && (
                      <div className="ml-8 py-0.5">
                        <div className="flex items-center gap-1.5 px-2 py-1">
                          <span className="w-[10px] shrink-0" />
                          <Folder size={13} strokeWidth={1.5} className="text-[#60A5FA] opacity-60" />
                          <input autoFocus value={inlineCreate.name}
                            onChange={e => setInlineCreate({ parentId: s.id, name: e.target.value })}
                            onKeyDown={handleInlineKeyDown} onBlur={saveInlineFolder} disabled={inlineSaving}
                            className="flex-1 text-[0.78rem] px-1.5 py-0.5 border border-[#2563EB] rounded bg-white focus:outline-none focus:ring-1 focus:ring-[#2563EB]/30"
                            onFocus={e => e.target.select()} />
                          {inlineSaving && <Loader2 size={12} strokeWidth={2} className="animate-spin text-neutral-400 shrink-0" />}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* ── Company spaces ── */}
            {companies.map(c => {
              const cspaces = companySpaces(c.id)
              const compKey = 'company-' + c.id
              const isOpen = expanded.has(compKey)
              return (
                <div key={c.id} className="mb-1">
                  <div className="flex items-center gap-1.5 py-1.5 px-2 text-[0.8rem] font-medium text-neutral-700 cursor-pointer hover:bg-neutral-50 rounded-md"
                    onClick={() => toggle(compKey)}
                    onContextMenu={e => handleCtx(e, { id: compKey, name: c.name, isSpace: true })}>
                    {isOpen ? <ChevronDown size={12} strokeWidth={2} /> : <ChevronRight size={12} strokeWidth={2} />}
                    <Folder size={14} strokeWidth={1.5} className="text-[#2563EB]" /><span>{c.name}</span>
                    <span className="text-[0.62rem] text-neutral-400 ml-auto" title={`${cspaces.reduce((s, sp) => s + (docCounts.get(sp.id) || 0), 0)} 个文档`}>{cspaces.reduce((s, sp) => s + (docCounts.get(sp.id) || 0), 0)}</span>
                  </div>
                  {/* Inline create under company node */}
                  {inlineCreate?.parentId === compKey && (
                    <div className="py-0.5 px-2 ml-4">
                      <div className="flex items-center gap-1.5 px-2 py-1">
                        <Folder size={13} strokeWidth={1.5} className="text-[#60A5FA] opacity-60" />
                        <input autoFocus value={inlineCreate.name}
                          onChange={e => setInlineCreate({ parentId: compKey, name: e.target.value })}
                          onKeyDown={handleInlineKeyDown} onBlur={saveInlineFolder} disabled={inlineSaving}
                          className="flex-1 text-[0.78rem] px-1.5 py-0.5 border border-[#2563EB] rounded bg-white focus:outline-none focus:ring-1 focus:ring-[#2563EB]/30"
                          onFocus={e => e.target.select()} />
                        {inlineSaving && <Loader2 size={12} strokeWidth={2} className="animate-spin text-neutral-400 shrink-0" />}
                      </div>
                    </div>
                  )}
                  {isOpen && cspaces.map(s => (
                    <TreeFolder key={s.id} folder={s} folderPerms={folderPerms} depth={1} folders={folders}
                      expanded={expanded} activeId={activeId} docCounts={docCounts}
                      onNavigate={goToDocuments} onToggle={toggle} onSetActive={setActiveId} onCtx={handleCtx}
                      inlineCreate={inlineCreate} inlineName={inlineCreate?.name || ''} inlineSaving={inlineSaving}
                      onInlineNameChange={v => setInlineCreate(prev => prev ? { ...prev, name: v } : null)}
                      onInlineSave={saveInlineFolder} onInlineKeyDown={handleInlineKeyDown}
                      renamingId={renamingId} renameValue={renameValue} renameSaving={renameSaving}
                      onRenameStart={(id, name) => { setRenamingId(id); setRenameValue(name) }}
                      onRenameChange={setRenameValue} onRenameSave={saveRename} onRenameKeyDown={handleRenameKeyDown}
                    />
                  ))}
                </div>
              )
            })}
            {spaces.length === 0 && <p className="text-[0.75rem] text-neutral-400 px-2 py-4">暂无知识空间</p>}
          </div>
        )}
      </div>

      {/* Storage bar */}
      <div className="shrink-0 px-4 py-2 border-t border-neutral-100 bg-white">
        <div className="flex items-center justify-between">
          <span className="text-[0.7rem] text-neutral-500 font-medium">存储空间</span>
          <span className="text-[0.7rem] text-neutral-400">{storage.usedGB}GB / {storage.totalGB}GB</span>
        </div>
        <div className="h-1.5 bg-neutral-100 rounded-full overflow-hidden my-1.5">
          <div className="h-full bg-[#2563EB] rounded-full" style={{ width: `${storage.percent}%` }} />
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[0.65rem] text-neutral-400">已使用 {storage.percent}%</span>
          <Link href="/internal/admin" onClick={handleNav} className="text-[0.7rem] text-[#2563EB] hover:text-blue-700 font-medium no-underline">管理</Link>
        </div>
      </div>

      {/* Context menu */}
      {ctxMenu && (
        <>
          <div className="fixed inset-0 z-[60]" onClick={() => setCtxMenu(null)} onContextMenu={e => { e.preventDefault(); setCtxMenu(null) }} />
          {(() => {
            // 虚拟节点不能重命名/删除，只能新建子文件夹
            const isVirtualNode = !isReal(ctxMenu.folder.id)
            const canModify = !isVirtualNode
            return (
              <div ref={ctxMenuRef} className="fixed z-[70] bg-white rounded-lg shadow-lg border border-neutral-200 py-1 min-w-[160px]" style={{ left: `${menuPos.x}px`, top: `${menuPos.y}px` }}>
                <div className="px-3 py-1.5 text-[0.68rem] text-neutral-400 uppercase tracking-wider border-b border-neutral-100">{ctxMenu.folder.name}</div>
                {/* 虚拟节点和真实节点都可以新建子文件夹 */}
                <button onClick={() => ctxNewFolder(ctxMenu.folder.id)} className="w-full text-left px-3 py-2 text-[0.78rem] text-neutral-700 hover:bg-neutral-50 flex items-center gap-2">
                  <Folder size={14} strokeWidth={1.5} className="text-blue-500" />新建子文件夹
                </button>
                {/* 只有真实节点才能重命名和删除 */}
                {canModify && (
                  <button onClick={() => ctxStartRename(ctxMenu.folder)} className="w-full text-left px-3 py-2 text-[0.78rem] text-neutral-700 hover:bg-neutral-50 flex items-center gap-2">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>重命名
                  </button>
                )}
                {canModify && (
                  <button onClick={() => ctxPermissions(ctxMenu.folder)} className="w-full text-left px-3 py-2 text-[0.78rem] text-neutral-700 hover:bg-neutral-50 flex items-center gap-2">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>权限管理
                  </button>
                )}
                {canModify && (
                  <>
                    <div className="border-t border-neutral-100" />
                    <button onClick={() => ctxDelete(ctxMenu.folder)} className="w-full text-left px-3 py-2 text-[0.78rem] text-red-500 hover:bg-red-50 flex items-center gap-2">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>删除
                    </button>
                  </>
                )}
              </div>
            )
          })()}
        </>
      )}

      {permTarget && <PermissionEditor resourceType="folder" resourceId={permTarget.id} resourceName={permTarget.name} companies={companies} depts={depts} users={allUsers} onClose={() => setPermTarget(null)} onSave={() => setPermTarget(null)} />}
    </aside>
  )
}
