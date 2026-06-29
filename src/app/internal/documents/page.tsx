'use client'

import { useEffect, useState, useCallback, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Loader2, FileText, Book, Folder, Lock, User, Key, Users, Building2 } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { AiAnalyzer } from '@/components/internal/ai-analyzer'
import { ContextMenu } from '@/components/internal/context-menu'
import { DetailPanel } from '@/components/internal/detail-panel'
import { PermissionEditor } from '@/components/internal/PermissionEditor'

// ── Types ──
interface Doc {
  id: string; title: string; category: string; slug: string
  fullContent: string; condensedContent: string; content?: string
  ownerDeptId?: string | null; ownerDept?: { name: string; slug: string } | null
  audiences?: any[]; folderId: string | null; folder?: { id: string; name: string } | null
  updatedAt: string; author: { name: string }; userPermission?: string | null
  fileSize?: number | null; summary?: string
}
interface Folder { id: string; name: string; slug: string; parentId: string | null; companyId: string | null; inheritPermissions: boolean; _count: { documents: number; children: number } }
interface Company { id: string; name: string; slug: string }
interface Me { id: string; name: string; role: string; departmentId: string; companyId: string; departmentName: string; companyName: string }
interface Dept { id: string; name: string; slug: string; companyId: string }
interface User { id: string; name: string; email: string; role: string; departmentId: string }
interface PermEntry { id: string; companyId: string | null; company?: { id: string; name: string } | null; departmentId: string | null; department?: { id: string; name: string } | null; userId: string | null; user?: { id: string; name: string; email: string } | null; role: string | null; permission: string }

const CAT_LABELS: Record<string, string> = { training: '培训', sop: 'SOP', policy: '政策', reference: '制度', brand: '品牌' }
const CAT_STYLE: Record<string, string> = { sop: 'bg-blue-50 text-blue-700', training: 'bg-emerald-50 text-emerald-700', policy: 'bg-amber-50 text-amber-700', reference: 'bg-slate-100 text-slate-600', brand: 'bg-purple-50 text-purple-700' }
const PERM_LABELS: Record<string, string> = { view: '查看', edit: '编辑', delete: '删除', admin: '管理' }
const PERM_LEVEL: Record<string, number> = { view: 1, edit: 2, delete: 3, admin: 4 }

function fmtDate(iso?: string) { if(!iso) return ''; const n=new Date(); const d=new Date(iso); const diff=n.getTime()-d.getTime(); const days=Math.floor(diff/864e5); if(days===0)return'今天';if(days===1)return'昨天';if(days<7)return`${days}天前`;return d.toLocaleDateString('zh-CN',{month:'short',day:'numeric'}) }
function fmtSize(d: Doc): string { if (d.fileSize) { const b = d.fileSize; if (b < 1024) return `${b} B`; if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`; return `${(b / (1024 * 1024)).toFixed(1)} MB` } const c = d.fullContent || d.condensedContent || ''; const b = new Blob([c]).size; if (b < 1024) return `${b} B`; if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`; return `${(b / (1024 * 1024)).toFixed(1)} MB` }
function permOk(p: string|null, r: string): boolean { if(!p) return false; return (PERM_LEVEL[p]||0) >= (PERM_LEVEL[r]||0) }
function guessType(d: Doc): string { const t = d.title.toLowerCase(); if (t.endsWith('.xlsx') || t.endsWith('.xls')) return 'excel'; if (t.endsWith('.docx') || t.endsWith('.doc')) return 'word'; if (t.endsWith('.pdf')) return 'pdf'; const cat = d.category; if (cat === 'sop') return 'word'; if (cat === 'policy') return 'excel'; if (cat === 'training') return 'word'; if (cat === 'reference') return 'pdf'; if (cat === 'brand') return 'pdf'; return 'other' }
function fileIcon(d: Doc) { const t = guessType(d); if (t === 'excel') return <img src="/images/excel.png" alt="" className="w-6 h-6 object-contain shrink-0" />; if (t === 'word') return <img src="/images/word.png" alt="" className="w-6 h-6 object-contain shrink-0" />; if (t === 'pdf') return <img src="/images/pdf.png" alt="" className="w-6 h-6 object-contain shrink-0" />; return <FileText size={15} strokeWidth={1.5} className="text-neutral-400 shrink-0" /> }
function fileType(d: Doc): string { const t = guessType(d); if (t === 'excel') return 'Excel'; if (t === 'word') return 'Word'; if (t === 'pdf') return 'PDF'; return CAT_LABELS[d.category] || '文档' }

// ═══════════════════════════════════════════
function DocumentsContent() {
  const sp = useSearchParams()
  const [docs, setDocs] = useState<Doc[]>([]); const [folders, setFolders] = useState<Folder[]>([])
  const [me, setMe] = useState<Me | null>(null); const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState(sp.get('search')||'')
  const [sortBy, setSortBy] = useState<'newest'|'oldest'|'name'|'category'>('newest')
  const [spaceFilter, setSpaceFilter] = useState(sp.get('space')||''); const [folderFilter, setFolderFilter] = useState('')
  const [showUpload, setShowUpload] = useState(false); const [upTitle, setUpTitle] = useState('')
  const [upFile, setUpFile] = useState<File | null>(null); const [upFolderId, setUpFolderId] = useState('')
  const [upCat, setUpCat] = useState('sop'); const [upAiParse, setUpAiParse] = useState(true)
  const [upStatus, setUpStatus] = useState<'idle'|'uploading'|'done'|'error'>('idle')
  const [selectedDoc, setSelectedDoc] = useState<Doc|null>(null)
  const [upMsg, setUpMsg] = useState(''); const [upDoc, setUpDoc] = useState<Doc | null>(null)
  const [showAi, setShowAi] = useState(false)
  const [toastMsg, setToastMsg] = useState(''); const [toastType, setToastType] = useState<'success'|'error'>('success')
  const [companies, setCompanies] = useState<Company[]>([]); const [depts, setDepts] = useState<Dept[]>([]); const [users, setUsers] = useState<User[]>([])
  const [ctxMenu, setCtxMenu] = useState<{x:number;y:number;doc:Doc}|null>(null)
  const [sCtx, setSCtx] = useState<{x:number;y:number;space:Folder}|null>(null)
  const [fCtx, setFCtx] = useState<{x:number;y:number;folder:Folder}|null>(null)
  const [moveDoc, setMoveDoc] = useState<Doc | null>(null)
  const [replaceDoc, setReplaceDoc] = useState<Doc | null>(null)
  const [newSpaceOpen, setNewSpaceOpen] = useState(false); const [nsName, setNsName] = useState(''); const [nsCompanyId, setNsCompanyId] = useState('')
  const [permTarget, setPermTarget] = useState<Folder | null>(null)
  const [docPermTarget, setDocPermTarget] = useState<Doc | null>(null)
  const [recDocs, setRecDocs] = useState<any[]>([])
  const [hotDocs, setHotDocs] = useState<any[]>([])
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const isSuper = me?.role === 'super_admin'
  const canUpload = isSuper || me?.role === 'dept_admin'

  // ── Batch selection ──
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [batchMoveOpen, setBatchMoveOpen] = useState(false)
  const [batchDeleting, setBatchDeleting] = useState(false)

  function toggleSelect(id: string) {
    setSelectedIds(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n })
  }
  function selectAll() {
    const manageable = filtered.filter(d => permOk(docPerm(d), 'edit'))
    if (selectedIds.size === manageable.length && manageable.length > 0) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(manageable.map(d => d.id)))
    }
  }
  async function batchDelete() {
    if (selectedIds.size === 0) return
    if (!confirm(`确定删除选中的 ${selectedIds.size} 个文档？此操作不可恢复。`)) return
    setBatchDeleting(true)
    const ids = Array.from(selectedIds)
    await fetch('/api/documents/batch', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'delete', ids }) })
    setSelectedIds(new Set()); setBatchDeleting(false); refresh()
  }
  async function batchMove(fid: string | null) {
    if (selectedIds.size === 0) return
    const ids = Array.from(selectedIds)
    await fetch('/api/documents/batch', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'move', ids, folderId: fid }) })
    setSelectedIds(new Set()); setBatchMoveOpen(false); refresh()
  }

  // ── Data ──
  const loadData = useCallback(()=>{Promise.all([fetch('/api/documents').then(r=>r.json()),fetch('/api/folders').then(r=>r.json()),fetch('/api/companies').then(r=>r.json()),fetch('/api/departments').then(r=>r.json()),fetch('/api/auth/me').then(r=>r.json()),fetch('/api/users').then(r=>r.json()).catch(()=>[])]).then(([d,f,comps,deptList,u,userList])=>{setDocs(Array.isArray(d)?d:[]);setFolders(f?.folders||[]);if(Array.isArray(comps))setCompanies(comps);if(Array.isArray(deptList))setDepts(deptList);if(Array.isArray(userList))setUsers(userList);if(u?.role)setMe(u);setLoading(false)}).catch(()=>setLoading(false))},[])
  useEffect(()=>{loadData()},[loadData])
  // Global ESC handler for all modals
  useEffect(()=>{
    function onKey(e: KeyboardEvent) { if (e.key !== 'Escape') return
      if (showUpload) setShowUpload(false); else if (newSpaceOpen) setNewSpaceOpen(false)
      else if (moveDoc) setMoveDoc(null); else if (showAi) { setShowAi(false); setShowUpload(false); resetUpload() }
      else if (permTarget) setPermTarget(null); else if (docPermTarget) setDocPermTarget(null)
      else if (ctxMenu) setCtxMenu(null); else if (sCtx) setSCtx(null); else if (fCtx) setFCtx(null)
    }
    document.addEventListener('keydown', onKey); return () => document.removeEventListener('keydown', onKey)
  }, [showUpload, newSpaceOpen, moveDoc, showAi, permTarget, docPermTarget, ctxMenu, sCtx, fCtx])
  // Fetch recommendations + hot docs for bottom modules
  useEffect(()=>{
    fetch('/api/recommendations/home').then(r=>r.json()).then(d=>{
      if(d?.popular) setRecDocs(d.popular)
    }).catch(()=>{})
    fetch('/api/dashboard').then(r=>r.json()).then(d=>{
      if(d?.popularDocs) setHotDocs(d.popularDocs)
    }).catch(()=>{})
  },[])
  const refresh = ()=>fetch('/api/documents').then(r=>r.json()).then(d=>{if(Array.isArray(d))setDocs(d)})

  const spaces = folders.filter(f=>!f.parentId)
  useEffect(()=>{if(!loading&&spaces.length>0){if(!spaceFilter){const best=spaces.find(s=>s._count?.documents>0||s._count?.children>0)||spaces[0];setSpaceFilter(best.id)};setExpanded(prev=>{const n=new Set(prev);n.add(spaceFilter||spaces[0].id);return n})}},[loading,spaces.length])
  // Sync spaceFilter from URL param when navigating from sidebar
  useEffect(()=>{const sid=sp.get('space');const fid=sp.get('folder')||'';if(sid&&sid!==spaceFilter){setSpaceFilter(sid);setFolderFilter(fid)}else if(fid!==folderFilter){setFolderFilter(fid)}},[sp.get('space'), sp.get('folder')])

  const spaceFolderIds = new Set<string>()
  function collectIds(pid: string) { folders.filter(f=>f.parentId===pid).forEach(f=>{spaceFolderIds.add(f.id);collectIds(f.id)}) }
  if(spaceFilter){ spaceFolderIds.add(spaceFilter); collectIds(spaceFilter) }

  let filtered = docs.filter(d=>{
    if(search&&!d.title.toLowerCase().includes(search.toLowerCase())) return false
    if(spaceFilter&&!(d.folderId&&spaceFolderIds.has(d.folderId))) return false
    if(folderFilter&&d.folderId!==folderFilter) return false
    return true
  })

  // Sort
  filtered = [...filtered].sort((a, b) => {
    if (sortBy === 'newest') return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    if (sortBy === 'oldest') return new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime()
    if (sortBy === 'name') return (a.title || '').localeCompare(b.title || '', 'zh')
    if (sortBy === 'category') return (a.category || '').localeCompare(b.category || '', 'zh') || new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    return 0
  })

  // Resolve actual space and folder chain from spaceFilter (may point to a subfolder)
  let currentSpace = folders.find(f=>f.id===spaceFilter) || null
  const currentFolder = folders.find(f=>f.id===folderFilter) || null
  // If spaceFilter points to a subfolder (has parentId), walk up to find the actual space
  const extraChain: Folder[] = []
  if (currentSpace && currentSpace.parentId) {
    let f: Folder|undefined = currentSpace
    const chain: Folder[] = []
    while (f) {
      chain.unshift(f)
      f = folders.find(x => x.id === f!.parentId)
      if (!f) break
      if (!f.parentId) { currentSpace = f; break } // found the root space
    }
    // chain[0] is the clicked subfolder, chain has no space (assigned to currentSpace)
    extraChain.push(...chain)
  }
  const uploadTargetId = folderFilter || spaceFilter
  const uploadTargetName = currentFolder?.name || currentSpace?.name || '根目录'

  const breadcrumb: { id?: string; name: string }[] = []
  if (currentSpace) {
    // Insert company name before the space name
    const spaceCompany = companies.find(c => c.id === currentSpace.companyId)
    if (spaceCompany) breadcrumb.push({ id: currentSpace.id, name: spaceCompany.name })
    breadcrumb.push({ id: currentSpace.id, name: currentSpace.name })
  }
  // Add intermediate folders from the space-to-subfolder chain
  extraChain.forEach(f => breadcrumb.push({ id: f.id, name: f.name }))
  if (currentFolder) {
    let f: Folder|undefined = currentFolder
    const chain: Folder[] = []
    while (f) { chain.unshift(f); f = folders.find(x => x.id === f!.parentId); if (f && f.id === spaceFilter) break }
    chain.forEach(f => breadcrumb.push({ id: f.id, name: f.name }))
  }
  // Mark the last breadcrumb item as current location (non-clickable)
  if (breadcrumb.length > 0) {
    const lastIdx = breadcrumb.length - 1
    breadcrumb[lastIdx] = { name: breadcrumb[lastIdx].name }
  }

  function docPerm(d: Doc): string | null { if(isSuper) return 'admin'; return d.userPermission || null }

  const toggleExpand = (id: string) => { setExpanded(prev=>{ const n=new Set(prev); if(n.has(id))n.delete(id);else n.add(id);return n }) }
  const selectSpace = (id: string) => { setSpaceFilter(id); setFolderFilter(''); setSearch('') }
  const resetUpload = ()=>{setUpTitle('');setUpFile(null);setUpFolderId('');setUpCat('sop');setUpAiParse(true);setUpStatus('idle');setUpMsg('');setUpDoc(null)}
  const openUpload = (fid: string) => { resetUpload(); setUpFolderId(fid); setShowUpload(true) }

  async function handleUpload(e:React.FormEvent){e.preventDefault();if(upStatus!=='idle'||!upFile||!upTitle||!upFolderId)return;setUpStatus('uploading');const fd=new FormData();fd.append('file',upFile);fd.append('title',upTitle);fd.append('category',upCat);fd.append('authorId',me?.id||'');fd.append('folderId',upFolderId);try{const res=await fetch('/api/documents',{method:'POST',body:fd});if(res.ok){const u=await res.json();setUpDoc(u);setUpStatus('done');setUpMsg('上传成功');refresh();if(upAiParse)setShowAi(true)}else{const e=await res.json().catch(()=>({}));setUpStatus('error');setUpMsg(e.error||'上传失败')}}catch{setUpStatus('error');setUpMsg('网络错误')}}
  async function createFolder(name:string,parentId:string){if(!name.trim())return;await fetch('/api/folders',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:name.trim(),parentId,inheritPermissions:true})});loadData();setExpanded(prev=>{const n=new Set(prev);n.add(parentId);return n})}
  async function createSpace(){if(!nsName.trim())return;await fetch('/api/folders',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:nsName.trim(),parentId:null,companyId:nsCompanyId||null,inheritPermissions:true})});setNewSpaceOpen(false);setNsName('');setNsCompanyId('');loadData()}
  async function renameFolder(f:Folder){const n=prompt('新名称:',f.name);if(n&&n!==f.name){await fetch('/api/folders',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:f.id,name:n})});loadData()}}
  async function deleteFolder(f:Folder){if(!confirm(`删除「${f.name}」？子文件夹和文件将移至上级目录。`))return;const wasSpace=spaceFilter===f.id;await fetch(`/api/folders?id=${f.id}`,{method:'DELETE'});loadData();refresh();if(wasSpace){const remaining=folders.filter((x:Folder)=>!x.parentId&&x.id!==f.id);setSpaceFilter(remaining[0]?.id||'');setFolderFilter('');setSelectedDoc(null)}else if(folderFilter===f.id){setFolderFilter('')}}
  async function triggerAi(doc:Doc){const res=await fetch(`/api/documents/${doc.id}/analyze`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({title:doc.title,category:doc.category,fullContent:doc.fullContent||doc.content||''})});if(res.ok){refresh();const d=await res.json();setSelectedDoc(d?.document||d)}}
  async function deleteDoc(doc:Doc){if(!confirm(`删除「${doc.title}」？`))return;await fetch(`/api/documents/${doc.id}`,{method:'DELETE'});refresh();setSelectedDoc(null)}
  async function moveDocument(docId:string,fid:string|null){await fetch(`/api/documents/${docId}`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({folderId:fid||null})});refresh();setMoveDoc(null)}

  if(loading)return (
    <div className="flex-1 flex items-center justify-center bg-[#F8F9FA]">
      <div className="text-center"><Loader2 size={20} strokeWidth={1.5} className="animate-spin text-[#2563EB] mx-auto mb-3" /><p className="text-[0.85rem] text-neutral-400">加载中...</p></div>
    </div>
  )

  return (
    <div className="flex-1 flex overflow-hidden">
      {/* ═══ Center: File List ═══ */}
      <div className="flex-1 flex flex-col min-w-0 bg-[#F8F9FA]">
        {/* ═══ Unified Header: Breadcrumb + Toolbar (two rows, no divider) ═══ */}
        <div className="px-6 py-2 bg-white border-b border-neutral-100">
          {/* Row 1: Breadcrumb */}
          <div className="flex items-center gap-1.5 text-[0.82rem] mb-1.5">
            <Link href="/internal/dashboard" className="text-neutral-400 hover:text-[#2563EB] no-underline shrink-0">YUAN SHOWROOM</Link>
            {breadcrumb.map((b, i) => (
              <span key={i} className="flex items-center gap-1.5 min-w-0">
                <span className="text-neutral-300 text-[0.85rem] leading-none">›</span>
                {b.id ? (
                  <button onClick={() => {
                    const f = folders.find(x => x.id === b.id)
                    if (f && !f.parentId) {
                      // Clicked a root space → switch space, clear folder
                      setSpaceFilter(b.id!)
                      setFolderFilter('')
                    } else {
                      // Clicked a subfolder → set folder filter, ensure space points to root
                      setFolderFilter(b.id!)
                      // If spaceFilter is a subfolder, walk up to root
                      let root = spaceFilter
                      let p = folders.find(x => x.id === root)
                      while (p && p.parentId) { root = p.parentId; p = folders.find(x => x.id === root) }
                      setSpaceFilter(root)
                    }
                  }}
                    className="text-neutral-500 hover:text-[#2563EB] transition-colors truncate">
                    {b.name}
                  </button>
                ) : (
                  <span className="text-neutral-700 font-medium truncate">{b.name}</span>
                )}
              </span>
            ))}
            <span className="text-neutral-300 text-[0.7rem] shrink-0 ml-1">{filtered.length} 个文件</span>
          </div>
          {/* Row 2: Toolbar */}
          <div className="flex items-center gap-2.5 flex-wrap">
            {/* Sort */}
            <select value={sortBy} onChange={e => setSortBy(e.target.value as any)}
              className="min-h-[44px] px-2.5 py-1.5 text-[0.72rem] border border-neutral-200 rounded-lg bg-white text-neutral-600 focus:outline-none focus:border-neutral-400 cursor-pointer">
              <option value="newest">最新优先</option>
              <option value="oldest">最早优先</option>
              <option value="name">标题 A-Z</option>
              <option value="category">按分类</option>
            </select>
            {canUpload && (
              <>
                <button onClick={() => currentSpace && openUpload(uploadTargetId)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-[#2563EB] text-white text-[0.72rem] font-medium rounded-lg hover:bg-blue-600 transition-colors shrink-0">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                  上传
                </button>
                <button onClick={() => { const n = prompt('文件夹名称:'); if (n && currentSpace) createFolder(n, folderFilter || spaceFilter) }}
                  className="flex items-center gap-1.5 px-3 py-1.5 border border-neutral-200 text-neutral-600 text-[0.72rem] rounded-lg hover:bg-neutral-50 transition-colors shrink-0">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 5v14M5 12h14"/></svg>
                  新建文件夹
                </button>
                <button className="flex items-center gap-1.5 px-3 py-1.5 border border-neutral-200 text-neutral-600 text-[0.72rem] rounded-lg hover:bg-neutral-50 transition-colors shrink-0">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
                  分享
                </button>
              </>
            )}
            <button className="flex items-center gap-1 px-2.5 py-1.5 border border-neutral-200 text-neutral-600 text-[0.72rem] rounded-lg hover:bg-neutral-50 transition-colors shrink-0">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg>
              更多
            </button>
            <div className="flex-1" />
            <button className="px-2 py-1.5 text-[0.7rem] text-neutral-500 hover:bg-neutral-100 rounded-lg transition-colors flex items-center gap-1 shrink-0">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><line x1="4" y1="6" x2="20" y2="6"/><line x1="4" y1="12" x2="16" y2="12"/><line x1="4" y1="18" x2="12" y2="18"/></svg>
              排序
            </button>
            <button className="px-2 py-1.5 text-[0.7rem] text-neutral-500 hover:bg-neutral-100 rounded-lg transition-colors flex items-center gap-1 shrink-0">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/></svg>
              筛选
            </button>
          </div>
        </div>

        {/* File Table */}
        <div className="flex-1 overflow-y-auto" style={{ minHeight: '260px' }}>
          {!currentSpace ? (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <Book size={48} strokeWidth={1.5} className="mb-4 opacity-20" />
              <p className="text-[0.9rem] text-neutral-500">选择左侧知识空间开始浏览</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <FileText size={48} strokeWidth={1.5} className="mb-4 opacity-20" />
              <p className="text-[0.9rem] text-neutral-500 mb-1">{search ? '没有匹配的文件' : '此目录暂无文件'}</p>
              {!search && canUpload && (
                <button onClick={() => openUpload(uploadTargetId)} className="mt-4 px-5 py-2 bg-[#2563EB] text-white text-[0.78rem] font-medium rounded-lg hover:bg-blue-600">
                  上传文件
                </button>
              )}
            </div>
          ) : (
            <table className="w-full bg-white">
              <thead>
                <tr className="bg-neutral-50 border-b border-neutral-200" style={{ height: '38px' }}>
                  {canUpload && (
                    <th className="text-center px-2 py-2 w-[36px]">
                      <input type="checkbox"
                        checked={selectedIds.size > 0 && selectedIds.size === filtered.filter(d => permOk(docPerm(d), 'edit')).length}
                        onChange={selectAll}
                        className="w-3.5 h-3.5 rounded border-neutral-300 text-[#2563EB] focus:ring-[#2563EB] cursor-pointer" />
                    </th>
                  )}
                  <th className="text-left px-3 py-2 text-[0.72rem] font-semibold text-neutral-600 w-[35%]">名称</th>
                  <th className="text-left px-3 py-2 text-[0.72rem] font-semibold text-neutral-600 w-[15%]">类型</th>
                  <th className="text-left px-3 py-2 text-[0.72rem] font-semibold text-neutral-600 w-[20%]">最近更新</th>
                  <th className="text-left px-3 py-2 text-[0.72rem] font-semibold text-neutral-600 w-[15%]">更新者</th>
                  <th className="text-left px-3 py-2 text-[0.72rem] font-semibold text-neutral-600 w-[10%]">大小</th>
                  <th className="text-left px-3 py-2 text-[0.72rem] font-semibold text-neutral-600 w-[5%]"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(d => {
                  const p = docPerm(d); const canClick = permOk(p, 'view')
                  const isSelected = selectedDoc?.id === d.id
                  const isFolder = d.category === 'folder'
                  return (
                    <tr key={d.id}
                      onClick={() => canClick && setSelectedDoc(d)}
                      onMouseEnter={() => canClick && !selectedDoc && setSelectedDoc(d)}
                      onDoubleClick={() => isFolder && canClick && d.folderId && setFolderFilter(d.folderId)}
                      onContextMenu={e => { e.preventDefault(); e.stopPropagation(); setCtxMenu({ x: e.clientX, y: e.clientY, doc: d }) }}
                      style={{ height: '44px' }}
                      className={`border-b border-neutral-100 transition-colors ${canClick ? 'cursor-pointer' : ''} ${isSelected ? 'bg-[#EBF5FF]' : 'hover:bg-neutral-50'}`}
                    >
                      {canUpload && (
                        <td className="text-center px-2" onClick={e => e.stopPropagation()}>
                          <input type="checkbox"
                            checked={selectedIds.has(d.id)}
                            disabled={!permOk(docPerm(d), 'edit')}
                            onChange={() => toggleSelect(d.id)}
                            className="w-3.5 h-3.5 rounded border-neutral-300 text-[#2563EB] focus:ring-[#2563EB] cursor-pointer disabled:opacity-20 disabled:cursor-not-allowed" />
                        </td>
                      )}
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          <span className={`shrink-0 ${!canClick ? 'opacity-30' : ''}`}>
                            {fileIcon(d)}
                          </span>
                          <div className="min-w-0 flex items-center gap-2">
                            {canClick ? (
                              <Link href={`/internal/docs/${d.audiences?.[0]?.department?.slug || d.ownerDept?.slug || 'doc'}/${encodeURIComponent(d.slug)}`}
                                onClick={e => e.stopPropagation()}
                                className="text-[0.78rem] font-medium text-neutral-900 hover:text-[#2563EB] no-underline truncate block">
                                {d.title}
                              </Link>
                            ) : (
                              <span className="text-[0.78rem] text-neutral-300 truncate block select-none inline-flex items-center gap-1">{d.title} <Lock size={11} strokeWidth={1.5} /></span>
                            )}
                            {(d as any).hasAiSummary && (
                              <span className="text-[0.65rem] px-2 py-0.5 rounded-full font-medium bg-[#EBF5FF] text-[#2563EB] shrink-0 whitespace-nowrap">AI 解析</span>
                            )}
                            {p && (
                              <span className={`text-[0.65rem] px-2 py-0.5 rounded-full font-medium shrink-0 whitespace-nowrap ${
                                p === 'admin' ? 'bg-amber-50 text-amber-600' :
                                p === 'edit' ? 'bg-blue-50 text-blue-600' :
                                'bg-neutral-50 text-neutral-500'
                              }`}>
                                {PERM_LABELS[p] || p}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <span className="text-[0.72rem] text-neutral-500">{fileType(d)}</span>
                      </td>
                      <td className="px-3 py-2">
                        <span className="text-[0.72rem] text-neutral-500">{d.updatedAt ? new Date(d.updatedAt).toLocaleString('zh-CN', { year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit', hour12:false }) : '—'}</span>
                      </td>
                      <td className="px-3 py-2">
                        <span className="text-[0.72rem] text-neutral-500">{d.author?.name || '—'}</span>
                      </td>
                      <td className="px-3 py-2">
                        <span className="text-[0.72rem] text-neutral-500">{fmtSize(d)}</span>
                      </td>
                      <td className="px-3 py-2 text-right">
                        <button onClick={e => { e.stopPropagation(); setCtxMenu({ x: e.clientX, y: e.clientY, doc: d }) }}
                          className="p-1.5 text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 rounded-lg transition-colors">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/></svg>
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* ═══ Batch Action Bar ═══ */}
        {selectedIds.size > 0 && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 px-5 py-3 bg-[#111] text-white rounded-xl shadow-2xl">
            <span className="text-[0.78rem] font-medium">已选 {selectedIds.size} 项</span>
            <div className="w-px h-5 bg-white/20" />
            <button onClick={() => setBatchMoveOpen(true)}
              className="px-3 py-1.5 text-[0.75rem] font-medium bg-white/15 hover:bg-white/25 rounded-lg transition-colors">
              移动到...
            </button>
            <button onClick={batchDelete} disabled={batchDeleting}
              className="px-3 py-1.5 text-[0.75rem] font-medium bg-red-500/80 hover:bg-red-500 rounded-lg transition-colors disabled:opacity-50">
              {batchDeleting ? '删除中...' : '批量删除'}
            </button>
            <button onClick={() => setSelectedIds(new Set())}
              className="px-3 py-1.5 text-[0.75rem] text-white/60 hover:text-white transition-colors">
              取消
            </button>
          </div>
        )}

        {/* ═══ Bottom Module 1: Related Documents (from API) ═══ */}
        {currentSpace && filtered.length > 0 && recDocs.length > 0 && (
          <div className="shrink-0 px-6 py-2.5 bg-white border-t border-neutral-100">
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-[0.7rem] font-medium text-neutral-400 uppercase tracking-wider">相关文档推荐</span>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {recDocs.slice(0, 4).map((item: any, i: number) => {
                const t = (item.title||'').toLowerCase()
                const imgType = t.endsWith('.xlsx')||t.endsWith('.xls') ? 'excel' : t.endsWith('.docx')||t.endsWith('.doc') ? 'word' : 'pdf'
                return (
                <Link key={item.id || i} href={`/internal/docs/${item.audienceSlug || 'doc'}/${encodeURIComponent(item.slug || '')}`}
                  className="flex items-center gap-2 p-2 bg-neutral-50 rounded-lg border border-neutral-100 hover:border-[#2563EB]/30 hover:bg-white transition-colors no-underline group">
                  <img src={`/images/${imgType}.png`} alt="" className="w-8 h-8 object-contain shrink-0" />
                  <div className="min-w-0">
                    <p className="text-[0.75rem] font-medium text-neutral-800 truncate group-hover:text-[#2563EB] transition-colors">{item.title}</p>
                    <p className="text-[0.68rem] text-neutral-400">{item.reason || item.department || ''}</p>
                  </div>
                </Link>
                )
              })}
            </div>
          </div>
        )}

        {/* ═══ Bottom Module 2: Hot Documents This Week (from API) ═══ */}
        {currentSpace && filtered.length > 0 && hotDocs.length > 0 && (
          <div className="shrink-0 px-6 py-2.5 bg-neutral-50 border-t border-neutral-100">
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-[0.7rem] font-medium text-neutral-400 uppercase tracking-wider">本周热门文档</span>
            </div>
            <div className="grid grid-cols-5 gap-2">
              {hotDocs.slice(0, 5).map((item: any, i: number) => {
                const vc = item.viewCount || 0
                const heatColor = vc >= 25 ? 'text-red-500' : vc >= 18 ? 'text-orange-400' : 'text-neutral-400'
                return (
                <Link key={item.id || i} href={`/internal/docs/${item.audienceSlug || 'doc'}/${encodeURIComponent(item.slug || '')}`}
                  className="flex flex-col justify-between p-2 bg-white rounded-lg border border-neutral-100 hover:border-[#2563EB]/30 hover:shadow-sm transition-all no-underline group">
                  <p className="text-[0.75rem] font-medium text-neutral-800 group-hover:text-[#2563EB] transition-colors leading-relaxed">{item.title}</p>
                  <div className={`flex items-center gap-1 mt-1.5 text-[0.68rem] ${heatColor}`}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M12 23c-3.3 0-6-2.7-6-6 0-2.4 1.5-4.5 3-6.3V7c0-1.7 1.3-3 3-3s3 1.3 3 3v3.7c1.5 1.8 3 3.9 3 6.3 0 3.3-2.7 6-6 6z"/><path d="M12 5V1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><path d="M8 9c0-1.1.4-2.1 1-2.8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/><path d="M16 9c0-1.1-.4-2.1-1-2.8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>
                    <span>被查看{vc}次</span>
                  </div>
                </Link>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* ═══ Right: Detail Panel (always visible) ═══ */}
      <DetailPanel doc={selectedDoc} onClose={() => setSelectedDoc(null)} />

      {/* ═══ Hidden inputs + Modals ═══ */}
      <input type="file" id="replaceFileInput" accept=".docx" className="hidden" onChange={async e => { const f = e.target.files?.[0]; const target = replaceDoc || ctxMenu?.doc; if (!f || !target) return; const fd = new FormData(); fd.append('file', f); const res = await fetch(`/api/documents/${target.id}/replace`, { method: 'POST', body: fd }); if (res.ok) { refresh(); setToastMsg('覆盖上传成功'); setToastType('success'); setTimeout(() => setToastMsg(''), 3000) } else { const d = await res.json().catch(() => ({})); setToastMsg(d.error || '覆盖失败'); setToastType('error'); setTimeout(() => setToastMsg(''), 3000) } e.target.value = ''; setCtxMenu(null); setReplaceDoc(null) }} />

      {/* Context Menus */}
      {ctxMenu && (() => {
        const p = docPerm(ctxMenu.doc)
        const items: any[] = [
          { label: '打开阅读', onClick: () => { if (!permOk(p, 'view')) return; window.open(`/internal/docs/${ctxMenu.doc.audiences?.[0]?.department?.slug || ctxMenu.doc.ownerDept?.slug || 'doc'}/${encodeURIComponent(ctxMenu.doc.slug)}`, '_blank') } },
        ]
        if (permOk(p, 'edit')) {
          items.push(
            { label: '覆盖上传', onClick: () => document.getElementById('replaceFileInput')?.click() },
            { label: '重命名', onClick: async () => { const n = prompt('新名称:', ctxMenu.doc.title); if (n && n !== ctxMenu.doc.title) { await fetch(`/api/documents/${ctxMenu.doc.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: n }) }); refresh() } } },
            { label: '移动到...', onClick: () => { setMoveDoc(ctxMenu.doc); setCtxMenu(null) } },
            { label: '图片 OCR 识别', onClick: async () => {
              setCtxMenu(null)
              setToastMsg('OCR 识别中，请稍候...'); setToastType('success')
              try {
                const res = await fetch(`/api/documents/${ctxMenu.doc.id}/ocr`, { method: 'POST' })
                const d = await res.json()
                if (res.ok) {
                  setToastMsg(d.totalChars > 0 ? `OCR 完成：识别 ${d.imageCount} 张图片，提取 ${d.totalChars} 字` : (d.message || 'OCR 完成，未检测到文字'))
                  setToastType('success')
                  refresh()
                } else {
                  setToastMsg(d.error || 'OCR 失败'); setToastType('error')
                }
              } catch { setToastMsg('OCR 请求失败'); setToastType('error') }
              setTimeout(() => setToastMsg(''), 4000)
            } },
          )
        }
        if (permOk(p, 'admin')) {
          items.push({ label: '编辑权限', onClick: () => { setDocPermTarget(ctxMenu.doc); setCtxMenu(null) } })
        }
        if (permOk(p, 'delete')) {
          items.push({ label: '删除', onClick: () => deleteDoc(ctxMenu.doc), danger: true })
        }
        return <ContextMenu x={ctxMenu.x} y={ctxMenu.y} onClose={() => setCtxMenu(null)} items={items} />
      })()}

      {/* Modals */}
      <Dialog open={showUpload} onOpenChange={(open) => { if (!open) setShowUpload(false) }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>上传文件</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleUpload} className="space-y-4">
            <div><label className="block text-[0.72rem] font-medium text-neutral-700 mb-1">标题</label><input type="text" value={upTitle} onChange={e => setUpTitle(e.target.value)} className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-[0.85rem] focus:outline-none focus:border-[#2563EB]" required /></div>
            <div><label className="block text-[0.72rem] font-medium text-neutral-700 mb-1">存放位置</label><p className="text-[0.85rem] text-neutral-700 py-2 inline-flex items-center gap-1.5"><Folder size={15} strokeWidth={1.5} />{uploadTargetName}</p></div>
            <div><label className="block text-[0.72rem] font-medium text-neutral-700 mb-1">分类</label><select value={upCat} onChange={e => setUpCat(e.target.value)} className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-[0.85rem]">{Object.entries(CAT_LABELS).map(([k,v]) => <option key={k} value={k}>{v}</option>)}</select></div>
            <div className="flex items-center gap-2"><input type="checkbox" checked={upAiParse} onChange={e => setUpAiParse(e.target.checked)} id="aip" /><label htmlFor="aip" className="text-[0.8rem] text-neutral-600">AI 智能解析</label></div>
            <div><label className="block text-[0.72rem] font-medium text-neutral-700 mb-1">文件 (.docx)</label><input type="file" accept=".docx" onChange={e => { const f = e.target.files?.[0]; if (f) { setUpFile(f); if (!upTitle) setUpTitle(f.name.replace(/\.(docx|doc)$/i, '')) } }} className="w-full text-[0.82rem] file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-[#2563EB] file:text-white" required /></div>
            {upMsg && <div className={`text-[0.78rem] px-3 py-2 rounded-lg ${upStatus === 'done' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>{upMsg}</div>}
            <div className="flex gap-3 pt-2"><button type="button" onClick={() => setShowUpload(false)} className="flex-1 px-4 py-2 border border-neutral-200 rounded-lg text-[0.82rem] hover:bg-neutral-50">取消</button><button type="submit" disabled={upStatus === 'uploading'} className="flex-1 px-4 py-2 bg-[#2563EB] text-white text-[0.82rem] rounded-lg hover:bg-blue-600 disabled:opacity-50">{upStatus === 'uploading' ? '上传中...' : '上传'}</button></div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={newSpaceOpen} onOpenChange={(open) => { if (!open) setNewSpaceOpen(false) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>新建知识空间</DialogTitle>
          </DialogHeader>
          <div className="space-y-4"><div><label className="block text-[0.72rem] font-medium text-neutral-700 mb-1">空间名称</label><input type="text" value={nsName} onChange={e => setNsName(e.target.value)} className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-[0.85rem] focus:outline-none focus:border-[#2563EB]" autoFocus /></div><div><label className="block text-[0.72rem] font-medium text-neutral-700 mb-1">归属公司</label><select value={nsCompanyId} onChange={e => setNsCompanyId(e.target.value)} className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-[0.85rem]"><option value="">集团级</option>{companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div><div className="flex gap-3 pt-2"><button onClick={() => setNewSpaceOpen(false)} className="flex-1 px-4 py-2 border border-neutral-200 rounded-lg text-[0.82rem] hover:bg-neutral-50">取消</button><button onClick={createSpace} disabled={!nsName.trim()} className="flex-1 px-4 py-2 bg-[#2563EB] text-white text-[0.82rem] rounded-lg hover:bg-blue-600 disabled:opacity-50">创建</button></div></div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!moveDoc} onOpenChange={(open) => { if (!open) setMoveDoc(null) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>移动到...</DialogTitle>
          </DialogHeader>
          {moveDoc && <p className="text-[0.78rem] text-neutral-400 -mt-2 mb-4 truncate">{moveDoc.title}</p>}
          <div className="max-h-[320px] overflow-y-auto border border-neutral-200 rounded-lg p-2 space-y-0.5">{spaces.map(f => <MTN key={f.id} f={f} folders={folders} lv={0} sel={moveDoc?.folderId || null} onClick={fid => moveDocument(moveDoc!.id, fid)} />)}</div>
          <div className="flex gap-2 mt-4"><button onClick={() => setMoveDoc(null)} className="flex-1 px-4 py-2 border border-neutral-200 rounded-lg text-[0.82rem] hover:bg-neutral-50">取消</button></div>
        </DialogContent>
      </Dialog>

      {/* Batch Move Dialog */}
      <Dialog open={batchMoveOpen} onOpenChange={(open) => { if (!open) setBatchMoveOpen(false) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>批量移动 {selectedIds.size} 个文档</DialogTitle>
          </DialogHeader>
          <div className="max-h-[320px] overflow-y-auto border border-neutral-200 rounded-lg p-2 space-y-0.5">
            {spaces.map(f => <MTN key={f.id} f={f} folders={folders} lv={0} sel={null} onClick={fid => batchMove(fid)} />)}
            <button onClick={() => batchMove(null)} className="w-full text-left px-3 py-2 text-[0.82rem] text-neutral-500 hover:bg-neutral-50 rounded-md flex items-center gap-2">
              <span className="w-[10px] shrink-0" />
              <span>根目录（无文件夹）</span>
            </button>
          </div>
          <div className="flex gap-2 mt-4">
            <button onClick={() => setBatchMoveOpen(false)} className="flex-1 px-4 py-2 border border-neutral-200 rounded-lg text-[0.82rem] hover:bg-neutral-50">取消</button>
          </div>
        </DialogContent>
      </Dialog>

      {showAi && upDoc && <AiAnalyzer documentId={upDoc.id} documentTitle={upDoc.title} documentCategory={upCat} originalContent={upDoc.fullContent || ''} onClose={() => { setShowAi(false); setShowUpload(false); resetUpload() }} onApply={async (draft) => { await fetch(`/api/documents/${upDoc.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: upDoc.title, condensedContent: draft }) }); setShowAi(false); setShowUpload(false); resetUpload(); refresh() }} />}
      {permTarget && <PermModal folder={permTarget} companies={companies} depts={depts} users={users} onClose={() => setPermTarget(null)} onSave={() => { setPermTarget(null); loadData() }} />}
      {docPermTarget && (
        <PermissionEditor
          resourceType="document"
          resourceId={docPermTarget.id}
          resourceName={docPermTarget.title}
          companies={companies}
          depts={depts}
          users={users}
          onClose={() => setDocPermTarget(null)}
          onSave={() => { setDocPermTarget(null); refresh() }}
        />
      )}

      {/* ═══ Toast ═══ */}
      {toastMsg && (
        <div className={`fixed bottom-4 right-4 rounded-lg px-4 py-2 shadow-lg text-[0.82rem] font-medium z-[100] ${toastType === 'success' ? 'bg-green-700 text-white' : 'bg-red-600 text-white'}`}>
          {toastMsg}
        </div>
      )}
    </div>
  )
}

// ── Move Tree Node ──
function MTN({ f, folders, lv, sel, onClick }: { f: Folder; folders: Folder[]; lv: number; sel: string | null; onClick: (id: string) => void }) {
  const [ex, setEx] = useState(true)
  const kids = folders.filter(x => x.parentId === f.id)
  return <div><button onClick={() => { onClick(f.id); if (kids.length > 0) setEx(!ex) }} className={`w-full text-left px-3 py-2 text-[0.82rem] rounded-md transition-colors flex items-center gap-2 ${sel === f.id ? 'bg-[#2563EB] text-white' : 'text-neutral-600 hover:bg-neutral-50'}`} style={{ paddingLeft: `${12 + lv * 16}px` }}>{kids.length > 0 ? <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className={`shrink-0 transition-transform ${ex ? 'rotate-90' : ''}`}><polyline points="9 18 15 12 9 6" /></svg> : <span className="w-[10px] shrink-0" />}<span className="inline-flex items-center gap-1"><Folder size={14} strokeWidth={1.5} /> {f.name}</span></button>{ex && kids.map(c => <MTN key={c.id} f={c} folders={folders} lv={lv + 1} sel={sel} onClick={onClick} />)}</div>
}

// ── Permission Modal ──
function PermModal({ folder, companies, depts, users, onClose, onSave }: { folder: Folder; companies: Company[]; depts: Dept[]; users: User[]; onClose: () => void; onSave: () => void }) {
  const [perms, setPerms] = useState<PermEntry[]>([]); const [loading, setLoading] = useState(true)
  const [addType, setAddType] = useState<'company' | 'department' | 'user' | 'role'>('department')
  const [addCompanyId, setAddCompanyId] = useState(''); const [addDeptId, setAddDeptId] = useState('')
  const [addUserId, setAddUserId] = useState(''); const [addRole, setAddRole] = useState('')
  const [addPerm, setAddPerm] = useState('view')

  useEffect(() => { fetch(`/api/folders/permissions?folderId=${folder.id}`).then(r => r.json()).then(d => { setPerms(d.permissions || []); setLoading(false) }) }, [folder.id])

  async function doAddPerm() {
    const body: any = { folderId: folder.id, permission: addPerm }
    if (addType === 'company') body.companyId = addCompanyId
    else if (addType === 'department') body.departmentId = addDeptId
    else if (addType === 'user') body.userId = addUserId
    else if (addType === 'role') body.role = addRole
    if (!body.companyId && !body.departmentId && !body.userId && !body.role) return alert('请选择目标')
    const res = await fetch('/api/folders/permissions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    if (res.ok) { const d = await res.json(); setPerms([...perms, d.permission || d]); setAddCompanyId(''); setAddDeptId(''); setAddUserId(''); setAddRole('') }
    else { const e = await res.json().catch(() => ({})); alert(e.error || '添加失败') }
  }
  async function delPerm(id: string) { await fetch(`/api/folders/permissions?id=${id}`, { method: 'DELETE' }); setPerms(perms.filter(p => p.id !== id)) }

  function permLabel(p: PermEntry) {
    if (p.user?.name) return <><User size={13} strokeWidth={1.5} className="inline-block align-text-bottom mr-0.5" /> {p.user.name}</>
    if (p.role) return <><Key size={13} strokeWidth={1.5} className="inline-block align-text-bottom mr-0.5" /> {p.role === 'dept_admin' ? '部门管理员' : p.role === 'staff' ? '普通员工' : p.role}</>
    if (p.department?.name) return <><Users size={13} strokeWidth={1.5} className="inline-block align-text-bottom mr-0.5" /> {p.department.name}</>
    if (p.company?.name) return <><Building2 size={13} strokeWidth={1.5} className="inline-block align-text-bottom mr-0.5" /> {p.company.name}</>
    return '未知'
  }

  const filteredDepts = addType === 'department' ? (addCompanyId ? depts.filter(d => d.companyId === addCompanyId) : depts) : []
  const filteredUsers = addType === 'user' ? (addDeptId ? users.filter(u => u.departmentId === addDeptId) : users) : []

  return <div className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh]"><div className="absolute inset-0 bg-black/40" onClick={onClose} /><div className="relative bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 p-6 max-h-[80vh] overflow-y-auto"><h2 className="text-[1rem] font-semibold text-[#111] mb-1 inline-flex items-center gap-1.5"><Lock size={16} strokeWidth={1.5} />权限管理</h2><p className="text-[0.78rem] text-neutral-400 mb-4">{folder.name}</p>
    <div className="mb-5"><p className="text-[0.68rem] font-medium text-neutral-400 uppercase mb-2">已有权限 ({perms.length})</p>
      {loading ? <p className="text-[0.8rem] text-neutral-400">加载中...</p> : perms.length === 0 ? <p className="text-[0.8rem] text-neutral-400">暂无规则</p> : (
        <div className="space-y-1">{perms.map(p => (<div key={p.id} className="flex items-center justify-between px-3 py-2 bg-neutral-50 rounded-lg"><span className="text-[0.82rem] text-neutral-700">{permLabel(p)} — <span className="font-medium text-[#111]">{PERM_LABELS[p.permission] || p.permission}</span></span><button onClick={() => delPerm(p.id)} className="text-[0.7rem] text-red-400 hover:text-red-600">移除</button></div>))}</div>
      )}
    </div>
    <div className="border-t border-neutral-200 pt-4"><p className="text-[0.68rem] font-medium text-neutral-400 uppercase mb-3">添加权限规则</p>
      <div className="flex flex-wrap gap-2 mb-3">
        <select value={addType} onChange={e => { setAddType(e.target.value as any); setAddCompanyId(''); setAddDeptId(''); setAddUserId(''); setAddRole('') }} className="px-2 py-1.5 text-[0.78rem] border border-neutral-200 rounded-lg"><option value="company">公司</option><option value="department">部门</option><option value="user">用户</option><option value="role">角色</option></select>
        {addType === 'company' && <select value={addCompanyId} onChange={e => setAddCompanyId(e.target.value)} className="px-2 py-1.5 text-[0.78rem] border border-neutral-200 rounded-lg"><option value="">选择公司</option>{companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>}
        {addType === 'department' && <><select value={addCompanyId} onChange={e => { setAddCompanyId(e.target.value); setAddDeptId('') }} className="px-2 py-1.5 text-[0.78rem] border border-neutral-200 rounded-lg"><option value="">全部公司</option>{companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select><select value={addDeptId} onChange={e => setAddDeptId(e.target.value)} className="px-2 py-1.5 text-[0.78rem] border border-neutral-200 rounded-lg"><option value="">选择部门</option>{filteredDepts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}</select></>}
        {addType === 'user' && <><select value={addDeptId} onChange={e => { setAddDeptId(e.target.value); setAddUserId('') }} className="px-2 py-1.5 text-[0.78rem] border border-neutral-200 rounded-lg"><option value="">全部部门</option>{depts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}</select><select value={addUserId} onChange={e => setAddUserId(e.target.value)} className="px-2 py-1.5 text-[0.78rem] border border-neutral-200 rounded-lg"><option value="">选择用户</option>{filteredUsers.map(u => <option key={u.id} value={u.id}>{u.name} ({u.email})</option>)}</select></>}
        {addType === 'role' && <select value={addRole} onChange={e => setAddRole(e.target.value)} className="px-2 py-1.5 text-[0.78rem] border border-neutral-200 rounded-lg"><option value="">选择角色</option><option value="dept_admin">部门管理员</option><option value="staff">普通员工</option></select>}
        <span className="text-neutral-300 py-1.5">→</span>
        <select value={addPerm} onChange={e => setAddPerm(e.target.value)} className="px-2 py-1.5 text-[0.78rem] border border-neutral-200 rounded-lg">{Object.entries(PERM_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
      </div>
      <button onClick={doAddPerm} className="px-4 py-1.5 bg-[#2563EB] text-white text-[0.75rem] rounded-lg hover:bg-blue-600">+ 添加</button>
    </div>
    <div className="flex gap-2 mt-4"><button onClick={onClose} className="flex-1 px-4 py-2 border border-neutral-200 rounded-lg text-[0.82rem] hover:bg-neutral-50">关闭</button></div></div></div>
}

export default function DocumentsPage() {
  return <Suspense fallback={<div className="p-10 text-center text-neutral-400">加载中...</div>}><DocumentsContent /></Suspense>
}
