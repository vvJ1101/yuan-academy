'use client'

import { useState, useMemo, useEffect } from 'react'
import { Copy, Edit3, Save, Plus, Trash2, Loader2, X, Download, ChevronDown } from 'lucide-react'
import { PageHeader } from '@/components/internal/page-header'
import { parsePolicyText } from '@/lib/policy-parser'

interface Policy { category: string; country: string; brand: string; style: string; priceRange: string; series: string; policy: string; delivery: string; _idx?: number }
type SortKey = 'category' | 'country' | 'brand'

const EMPTY: Policy = { category:'',country:'',brand:'',style:'',priceRange:'',series:'',policy:'',delivery:'' }
const FL: Record<string,string> = { brand:'品牌',category:'类目',country:'国家',style:'品牌风格',priceRange:'主力销售价格段',series:'最新订货系列',policy:'品牌订货政策',delivery:'品牌上新时间' }
const SHORT: (keyof Policy)[] = ['brand','category','country','style','priceRange','series']
const LONG: (keyof Policy)[] = ['policy','delivery']

export default function PolicyPage() {
  const [items, setItems] = useState<Policy[]>([])
  const [loading, setLoading] = useState(true)
  const [updatedAt, setUpdatedAt] = useState('')
  const [updatedBy, setUpdatedBy] = useState('')
  const [search, setSearch] = useState('')
  const [catFilter, setCatFilter] = useState('')
  const [countryFilter, setCountryFilter] = useState('')
  const [expanded, setExpanded] = useState<Set<number>>(new Set())
  const [expandAll, setExpandAll] = useState(false)
  const [sortKey, setSortKey] = useState<SortKey>('category')
  const [copiedId, setCopiedId] = useState<number | null>(null)
  const [copyAllId, setCopyAllId] = useState(false)
  const [canEdit, setCanEdit] = useState(false)
  const [editingIdx, setEditingIdx] = useState<number | null>(null)
  const [editDraft, setEditDraft] = useState<Policy | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState('')
  const [savedIdx, setSavedIdx] = useState<number | null>(null)

  useEffect(() => {
    fetch('/api/auth/me').then(r=>r.json()).then(u=>{ if(u?.role==='super_admin')setCanEdit(true) }).catch((err: any) => console.warn("[SilentError]", err))
    fetch('/api/user/permissions').then(r=>r.json()).then(d=>{ if(d?.code===0 && d.data.permissions.includes('menu.policyUpload'))setCanEdit(true) }).catch((err: any) => console.warn("[SilentError]", err))
  }, [])
  useEffect(() => { fetch('/showroom/data/policies.json?t='+Date.now()).then(r=>r.json()).then(d=>{ if(Array.isArray(d))setItems(d.map((x)=>({category:x.category||'',country:x.country||'',brand:x.brand||'',style:x.style||'',priceRange:x.priceRange||'',series:x.series||'',policy:x.policy||(x.ss26?x.aw26?x.ss26+'\n\n'+x.aw26:x.ss26:x.aw26||''),delivery:x.delivery||''}))) }).finally(()=>setLoading(false)); fetch('/showroom/data/policies.updated.json?t='+Date.now()).then(r=>r.json()).then(d=>{ if(d.updatedAt)setUpdatedAt(new Date(d.updatedAt).toLocaleString('zh-CN')); if(d.updatedBy)setUpdatedBy(d.updatedBy) }).catch((err: any) => console.warn("[SilentError]", err)) }, [])

  function copyText(text: string): Promise<void> { if(navigator.clipboard)return navigator.clipboard.writeText(text); return new Promise((r,rej)=>{ const ta=document.createElement('textarea'); ta.value=text; ta.style.position='fixed';ta.style.left='-9999px'; document.body.appendChild(ta);ta.select(); try{document.execCommand('copy');r()}catch(e){rej(e)} document.body.removeChild(ta) }) }
  function fmtPolicy(p: Policy): string { const l:string[]=[]; l.push('【'+p.brand+'】'+p.category+' · '+p.country); if(p.style)l.push(FL.style+'：'+p.style); if(p.priceRange)l.push(FL.priceRange+'：'+p.priceRange); if(p.series)l.push(FL.series+'：'+p.series); if(p.policy)l.push('\n'+FL.policy+'：\n'+p.policy); if(p.delivery)l.push('\n'+FL.delivery+'：\n'+p.delivery); return l.join('\n') }

  function toggle(i:number){ setExpanded(p=>{ const n=new Set(p); if(n.has(i))n.delete(i);else n.add(i); return n }) }
  function toggleAll(){ if(expandAll){ setExpanded(new Set());setExpandAll(false) } else { setExpanded(new Set(filtered.map(p=>p._idx!)));setExpandAll(true) } }

  function startEdit(oi:number){ setEditingIdx(oi); setEditDraft({...items[oi]}); setSaveMsg(''); setExpanded(p=>{ const n=new Set(p); n.add(oi); return n }) }
  function cancelEdit(){ setEditingIdx(null); setEditDraft(null); setSaveMsg('') }
  function updateDraft(f:keyof Policy, v:string){ setEditDraft(p=>p?{...p,[f]:v}:null) }

  async function saveCard(){
    if(editingIdx===null||!editDraft)return
    // dedup check
    const dup = items.findIndex((p2,i2)=>i2!==editingIdx&&p2.brand===editDraft.brand&&!!editDraft.brand)
    if(dup>=0){ setSaveMsg('已存在同名品牌"'+editDraft.brand+'"'); return }
    setSaving(true);setSaveMsg('')
    try {
      const upd = items.map((p,i)=>i===editingIdx?{category:editDraft.category,country:editDraft.country,brand:editDraft.brand,style:editDraft.style,priceRange:editDraft.priceRange,series:editDraft.series,policy:editDraft.policy,delivery:editDraft.delivery}:p)
      const res=await fetch('/api/admin/policy',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({policies:upd})})
      if(res.ok){ setItems(upd); setEditingIdx(null); setEditDraft(null); setSavedIdx(editingIdx); setSaveMsg('保存成功'); setTimeout(()=>{setSavedIdx(null);setSaveMsg('')},2000)
        const el=document.querySelector('[data-idx="'+editingIdx+'"]'); if(el)el.scrollIntoView({behavior:'smooth',block:'center'})
        fetch('/showroom/data/policies.updated.json?t='+Date.now()).then(r=>r.json()).then(d=>{if(d.updatedAt)setUpdatedAt(new Date(d.updatedAt).toLocaleString('zh-CN')); if(d.updatedBy)setUpdatedBy(d.updatedBy)}).catch((err: any) => console.warn("[SilentError]", err))
      } else { const e=await res.json().catch(()=>({})); setSaveMsg(e.error||'保存失败') }
    } catch { setSaveMsg('网络错误') }
    setSaving(false)
  }

  function addBrand(){ const ni=items.length; setItems(p=>[...p,{...EMPTY}]); setTimeout(()=>{ setEditingIdx(ni);setEditDraft({...EMPTY});setExpanded(p=>{const n=new Set(p);n.add(ni);return n});
    const el=document.querySelector('[data-idx="'+ni+'"] input'); if(el)(el as HTMLElement).focus() },50) }

 async function removeBrand(idx:number){ if(!confirm('确定删除?'))return; setEditingIdx(null);setEditDraft(null); const upd=items.filter((_,i)=>i!==idx); setSaving(true)
    try { const res=await fetch('/api/admin/policy',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({policies:upd})}); if(res.ok){ setItems(upd); setSaveMsg('已删除');setTimeout(()=>setSaveMsg(''),2000) } else setSaveMsg('删除失败') } catch { setSaveMsg('网络错误') }; setSaving(false) }
  async function removeAllBrands(){ if(!confirm(`确定删除全部 ${items.length} 个品牌？此操作不可恢复。`))return; setSaving(true)
    try { const res=await fetch('/api/admin/policy',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({policies:[]})}); if(res.ok){ setItems([]); setSaveMsg('已清空全部品牌数据');setTimeout(()=>setSaveMsg(''),2000) } else { const e=await res.json().catch(()=>({})); setSaveMsg(e.error||'清空失败') } } catch { setSaveMsg('网络错误') }; setSaving(false) }

  async function exportExcel(){ const X = await import('xlsx'); const h = [FL.category,FL.country,FL.brand,FL.style,FL.priceRange,FL.series,FL.policy,FL.delivery]; const rows=[h]; items.forEach(p=>rows.push([p.category,p.country,p.brand,p.style,p.priceRange,p.series,p.policy,p.delivery])); const ws=X.utils.aoa_to_sheet(rows); ws['!cols']=[{wch:10},{wch:8},{wch:16},{wch:24},{wch:14},{wch:16},{wch:36},{wch:36},{wch:24},{wch:24},{wch:24}]; const wb=X.utils.book_new(); X.utils.book_append_sheet(wb,ws,'订货政策'); X.writeFile(wb,'订货政策_'+new Date().toISOString().slice(0,10)+'.xlsx') }

  const catCounts=useMemo(()=>{ const m:Record<string,number>={}; items.forEach(p=>{m[p.category]=(m[p.category]||0)+1}); return m },[items])
  const countryCounts=useMemo(()=>{ const m:Record<string,number>={}; items.forEach(p=>{m[p.country]=(m[p.country]||0)+1}); return m },[items])
  const cats=Object.keys(catCounts).sort(); const countries=Object.keys(countryCounts).sort()
  const filtered=useMemo(()=>{ let list=[...items].map((p,idx)=>({...p,_idx:idx})); list.sort((a,b)=>(a[sortKey]||'').localeCompare(b[sortKey]||'','zh')); return list.filter(p=>{ if(catFilter&&p.category!==catFilter)return false; if(countryFilter&&p.country!==countryFilter)return false; if(search){const q=search.toLowerCase();if(!p.brand.toLowerCase().includes(q)&&!p.style.toLowerCase().includes(q))return false}; return true }) },[items,sortKey,catFilter,countryFilter,search])
  const grouped=useMemo(()=>{ const g:Record<string,typeof filtered>={}; filtered.forEach(p=>{if(!g[p.category])g[p.category]=[];g[p.category].push(p)}); return g },[filtered])

  if(loading)return <div className="p-10 text-center text-neutral-400">加载中...</div>

  return (<div className="p-4 md:p-8 lg:p-10 max-w-4xl overflow-x-hidden">
    <PageHeader title="订货政策" backTo="/internal/dashboard" backLabel="返回首页" />
    <div className="flex items-center justify-between mb-6 flex-wrap gap-3"><div><h1 className="text-[1.3rem] font-semibold text-neutral-900 mb-1">品牌订货政策</h1><p className="text-[0.82rem] text-neutral-500">{items.length} 个品牌{filtered.length!==items.length?' · 筛选 '+filtered.length+' 个':''}{updatedAt&&<span className="text-neutral-400"> · 更新于 {updatedAt}{updatedBy ? ' 由 '+updatedBy : ''}</span>}</p></div>
    <div className="flex items-center gap-1.5 flex-wrap">{canEdit&&<button onClick={addBrand} className="min-h-[44px] px-3 py-1.5 text-[0.75rem] rounded-lg border bg-white text-neutral-700 border-neutral-300 hover:bg-neutral-50 flex items-center gap-1"><Plus size={13}/> 添加</button>}{canEdit&&<button onClick={exportExcel} className="min-h-[44px] px-3 py-1.5 text-[0.75rem] rounded-lg border bg-white text-neutral-700 border-neutral-300 hover:bg-neutral-50 flex items-center gap-1"><Download size={13}/> 导出</button>}{canEdit&&<button onClick={removeAllBrands} disabled={saving||items.length===0} className="min-h-[44px] px-3 py-1.5 text-[0.75rem] rounded-lg border bg-white text-red-500 border-red-200 hover:bg-red-50 flex items-center gap-1 disabled:opacity-50"><Trash2 size={13}/> 全部删除</button>}<button onClick={()=>{if(filtered.length===0)return; copyText(filtered.map(p=>fmtPolicy(p)).join('\n\n---\n\n')).then(()=>{setCopyAllId(true);setTimeout(()=>setCopyAllId(false),2000)})}} className={`min-h-[44px] px-3 py-1.5 text-[0.75rem] rounded-lg border font-medium ${copyAllId?'bg-emerald-50 text-emerald-700 border-emerald-300':'bg-[#2563EB] text-white border-[#2563EB] hover:bg-blue-600'}`}>{copyAllId?'已复制全部':'复制全部'}</button><button onClick={toggleAll} className="min-h-[44px] text-[0.75rem] text-neutral-500 hover:text-neutral-900">{expandAll?'收起全部':'展开全部'}</button></div></div>
    {saveMsg&&<div className={`mb-4 text-[0.82rem] px-3 py-2 rounded-lg ${saveMsg.includes('成功')||saveMsg.includes('已删除')?'bg-green-50 text-green-700':'bg-red-50 text-red-700'}`}>{saveMsg}</div>}
    <div className="space-y-2 sm:space-y-3 mb-6"><input type="text" value={search} onChange={e=>setSearch(e.target.value)} placeholder="搜索品牌名或风格..." className="w-full px-3 py-2 min-h-[44px] border border-neutral-300 rounded-lg text-[0.85rem] focus:outline-none focus:border-neutral-900" />
    <div className="flex items-center gap-1.5 flex-wrap"><span className="text-[0.65rem] text-neutral-400 mr-1">排序：</span>{([['category','类目'],['country','国家'],['brand','品牌']]as[SortKey,string][]).map(([k,v])=>(<button key={k} onClick={()=>setSortKey(k)} className={`min-h-[40px] sm:min-h-[44px] px-2 sm:px-2.5 py-1 text-[0.68rem] sm:text-[0.7rem] rounded-md border ${sortKey===k?'bg-neutral-100 border-neutral-400 text-neutral-900':'bg-white text-neutral-500 border-neutral-200 hover:border-neutral-400'}`}>{v}</button>))}</div>
    <div className="flex flex-wrap gap-1.5"><span className="text-[0.65rem] text-neutral-400 mr-1 self-center">类目：</span><button onClick={()=>setCatFilter('')} className={`min-h-[40px] sm:min-h-[44px] px-2 sm:px-2.5 py-1 text-[0.68rem] sm:text-[0.7rem] rounded-md border ${!catFilter?'bg-neutral-900 text-white border-neutral-900':'bg-white text-neutral-600 border-neutral-200 hover:border-neutral-400'}`}>全部</button>{cats.map(c=>(<button key={c} onClick={()=>setCatFilter(catFilter===c?'':c)} className={`min-h-[40px] sm:min-h-[44px] px-2 sm:px-2.5 py-1 text-[0.68rem] sm:text-[0.7rem] rounded-md border ${catFilter===c?'bg-neutral-900 text-white border-neutral-900':'bg-white text-neutral-600 border-neutral-200 hover:border-neutral-400'}`}>{c}({catCounts[c]})</button>))}</div>
    <div className="flex flex-wrap gap-1.5"><span className="text-[0.65rem] text-neutral-400 mr-1 self-center">国家：</span><button onClick={()=>setCountryFilter('')} className={`min-h-[40px] sm:min-h-[44px] px-2 sm:px-2.5 py-1 text-[0.68rem] sm:text-[0.7rem] rounded-md border ${!countryFilter?'bg-neutral-900 text-white border-neutral-900':'bg-white text-neutral-600 border-neutral-200 hover:border-neutral-400'}`}>全部</button>{countries.map(c=>(<button key={c} onClick={()=>setCountryFilter(countryFilter===c?'':c)} className={`min-h-[40px] sm:min-h-[44px] px-2 sm:px-2.5 py-1 text-[0.68rem] sm:text-[0.7rem] rounded-md border ${countryFilter===c?'bg-neutral-900 text-white border-neutral-900':'bg-white text-neutral-600 border-neutral-200 hover:border-neutral-400'}`}>{c}({countryCounts[c]})</button>))}</div></div>
    {Object.entries(grouped).map(([cat,brands])=>(<div key={cat} className="mb-6">{sortKey==='category'&&<h2 className="text-[0.7rem] tracking-[0.12em] uppercase text-neutral-400 font-medium mb-2 px-1">{cat} · {brands.length} 品牌</h2>}<div className="space-y-2">{brands.map((p)=>{const i=p._idx;const isEditing=editingIdx===i;const draft=isEditing?editDraft:null;return(<div key={i} data-idx={i} className={`bg-white border rounded-xl overflow-hidden transition-colors ${isEditing?'border-[#2563EB] shadow-sm':savedIdx===i?'border-emerald-400 bg-emerald-50/30':'border-neutral-200'}`}><div onClick={()=>{if(!isEditing)toggle(i)}} className="flex items-center justify-between px-4 py-3 bg-neutral-50/50 cursor-pointer hover:bg-neutral-100 transition-colors" role="button"><div className="flex items-center gap-2 min-w-0"><span className="text-[0.9rem] font-semibold text-neutral-900">{isEditing&&draft?draft.brand||'新品牌':p.brand}</span><span className="text-[0.62rem] text-neutral-400 bg-neutral-100 px-1.5 py-0.5 rounded">{isEditing&&draft?draft.category||p.category:p.category}</span><span className="text-[0.62rem] text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">{isEditing&&draft?draft.country||p.country:p.country}</span></div><div className="flex items-center gap-1 shrink-0 ml-2">{canEdit&&!isEditing&&<button onClick={e=>{e.stopPropagation();startEdit(i)}} className="min-h-[40px] sm:min-h-[44px] min-w-[40px] sm:min-w-[44px] flex items-center justify-center text-neutral-300 hover:text-[#2563EB] hover:bg-blue-50 rounded-lg"><Edit3 size={13}/></button>}{canEdit&&isEditing&&<><button onClick={()=>removeBrand(i)} className="min-h-[44px] min-w-[44px] flex items-center justify-center text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg"><Trash2 size={15}/></button><button onClick={cancelEdit} className="min-h-[44px] min-w-[44px] flex items-center justify-center text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 rounded-lg"><X size={15}/></button><button onClick={saveCard} disabled={saving} className="min-h-[44px] px-4 py-1.5 bg-[#2563EB] text-white text-[0.72rem] font-medium rounded-lg hover:bg-blue-600 disabled:opacity-50 flex items-center gap-1">{saving?<Loader2 size={12} className="animate-spin"/>:<Save size={13}/>}{saving?'...':'保存'}</button></>}{!isEditing&&<><button onClick={e=>{e.stopPropagation();copyText(fmtPolicy(p)).then(()=>{setCopiedId(i);setTimeout(()=>setCopiedId(null),2000)})}} className={`min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg ${copiedId===i?'text-emerald-600':'text-neutral-300 hover:text-neutral-500'}`}>{copiedId===i?<span className="text-[0.65rem] font-medium">已复制</span>:<Copy size={14}/>}</button><button onClick={e=>{e.stopPropagation();toggle(i)}} className="min-h-[44px] min-w-[44px] flex items-center justify-center text-[0.65rem] text-neutral-400 hover:text-neutral-600"><ChevronDown size={16} strokeWidth={2} className={`transition-transform duration-200 ${expanded.has(i)?'rotate-180':''}`}/></button></>}</div></div>{isEditing?(<div className="px-4 pb-4 pt-3 space-y-3"><div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">{SHORT.map(f=>(<div key={f}><label className="text-[0.65rem] font-medium text-neutral-400 mb-0.5 block">{FL[f]}</label><input value={(draft as any)[f]} onChange={e=>updateDraft(f,e.target.value)} className="w-full min-h-[44px] px-3 py-2 text-[0.82rem] border border-neutral-200 rounded-lg focus:outline-none focus:border-[#2563EB]"/></div>))}</div>{LONG.map(f=>(<div key={f}><label className="text-[0.65rem] font-medium text-neutral-400 mb-0.5 block">{FL[f]}</label><textarea value={(draft as any)[f]} onChange={e=>updateDraft(f,e.target.value)} rows={3} className="w-full px-3 py-2 text-[0.82rem] border border-neutral-200 rounded-lg focus:outline-none focus:border-[#2563EB] resize-y"/></div>))}</div>):(<div className="px-4 pb-1"><div className="space-y-1 py-2"><p className="text-[0.72rem]"><span className="font-medium text-neutral-900">{FL.style}</span> <span className="text-neutral-600">{p.style}</span></p><p className="text-[0.72rem]"><span className="font-medium text-neutral-900">{FL.priceRange}</span> <span className="text-neutral-600">{p.priceRange}</span></p>{p.series&&<p className="text-[0.72rem]"><span className="font-medium text-neutral-900">{FL.series}</span> <span className="text-neutral-600">{p.series}</span></p>}</div>{expanded.has(i)?<PolicyDetailTable p={p} copyText={copyText}/>:null}</div>)}</div>)})}</div></div>))}
    {filtered.length===0&&(<div className="text-center py-16"><p className="text-[0.85rem] text-neutral-400 mb-3">没有匹配的品牌</p>{(search||catFilter||countryFilter)&&<button onClick={()=>{setSearch('');setCatFilter('');setCountryFilter('')}} className="text-[0.78rem] text-[#2563EB] hover:text-blue-700 underline">清除筛选条件</button>}</div>)}
  </div>)
}

function PolicyDetailTable({p, copyText}:{p:Policy; copyText:(t:string)=>Promise<void>}){
  const policyParsed = p.policy ? parsePolicyText(p.policy) : null

  return (
    <div className="border-t border-neutral-100 pt-3 space-y-3">
      {/* ── Policy helper ── */}
      <div className="bg-blue-50/60 rounded-lg p-3">
        <div className="flex items-center gap-1.5 mb-2">
          <p className="text-[0.72rem] font-semibold text-[#2563EB]">品牌订货政策</p>
          <CopyBtn text={p.policy} />
        </div>
        {policyParsed && policyParsed.tiers.length > 0 ? (
          <>
            <div className="flex items-center gap-2 text-[0.68rem] font-semibold text-neutral-900 pb-1.5">
              <span className="min-w-[3em]">订货门槛</span>
              <span className="min-w-[3.5em]">折扣</span>
              <span>备注</span>
            </div>
            <hr className="border-neutral-200 mb-1.5" />
            <div className="space-y-0.5">
              {policyParsed.tiers.map((t, i) => (
                <div key={i} className="flex items-center gap-2 text-[0.78rem] py-0.5">
                  <span className="text-neutral-900 font-semibold min-w-[3em]">{t.threshold}</span>
                  <span className="text-[#2563EB] font-bold min-w-[3.5em]">{t.price}</span>
                  <span className="text-neutral-600 text-[0.72rem]">{t.note || '—'}</span>
                </div>
              ))}
            </div>
            {policyParsed.orderRule && (
              <p className="text-[0.72rem] text-neutral-600 mt-2">起订规则：{policyParsed.orderRule}</p>
            )}
            {policyParsed.supplementaryNotes.length > 0 && (
              <p className="mt-2 pt-2 border-t border-neutral-200/60 text-[0.72rem] text-neutral-700 leading-relaxed whitespace-pre-line">{policyParsed.supplementaryNotes.join('\n')}</p>
            )}
          </>
        ) : (
          <p className="text-[0.78rem] text-neutral-800 whitespace-pre-line leading-relaxed">{p.policy}</p>
        )}
      </div>

      {/* Delivery */}
      {p.delivery && <p className="text-[0.72rem] flex items-center gap-1"><span className="font-medium text-neutral-900">{FL.delivery}</span><span className="text-neutral-300 mx-1">|</span><span className="text-neutral-700">{p.delivery}</span><CopyBtn text={p.delivery} /></p>}
    </div>
  )
}function CopyBtn({text}:{text:string}){
  const [done, setDone] = useState(false)
  if (!text) return null
  return (
    <button
      onClick={e=>{e.stopPropagation();navigator.clipboard?.writeText(text).then(()=>{setDone(true);setTimeout(()=>setDone(false),1500)}).catch((err: any) => console.warn("[SilentError]", err))}}
      className={`shrink-0 min-h-[24px] min-w-[24px] flex items-center justify-center rounded transition-colors ${done?'text-emerald-500':'text-neutral-300 hover:text-neutral-500'}`}
      title="复制"
    >
      {done
        ? <span className="text-[0.6rem] font-medium">已复制</span>
        : <Copy size={12} strokeWidth={1.5} />
      }
    </button>
  )
}
