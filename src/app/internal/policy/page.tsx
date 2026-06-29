'use client'

import { useState, useMemo, useEffect, useCallback } from 'react'
import { Copy, Edit3, Save, Plus, Trash2, Loader2, X, Download } from 'lucide-react'
import { PageHeader } from '@/components/internal/page-header'

interface Policy { category: string; country: string; brand: string; style: string; priceRange: string; series: string; ss26: string; aw26: string; delivery: string; nonCutoff: string; pr: string; _idx?: number }
type SortKey = 'category' | 'country' | 'brand'

const EMPTY: Policy = { category:'',country:'',brand:'',style:'',priceRange:'',series:'',ss26:'',aw26:'',delivery:'',nonCutoff:'',pr:'' }
const FL: Record<string,string> = { brand:'品牌',category:'类目',country:'国家',style:'品牌风格',priceRange:'主力销售价格段',series:'最新订货系列',ss26:'26SS订货政策门槛',aw26:'26AW订货政策',delivery:'26AW品牌上新时间',nonCutoff:'非截单时间(沟通)',pr:'明星公关' }
const SHORT: (keyof Policy)[] = ['brand','category','country','style','priceRange','series']
const LONG: (keyof Policy)[] = ['ss26','aw26','delivery','nonCutoff','pr']

export default function PolicyPage() {
  const [items, setItems] = useState<Policy[]>([])
  const [loading, setLoading] = useState(true)
  const [updatedAt, setUpdatedAt] = useState('')
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

  useEffect(() => { fetch('/api/auth/me').then(r=>r.json()).then(u=>{ if(u?.role==='super_admin')setCanEdit(true) }).catch(()=>{}) }, [])
  useEffect(() => { fetch('/showroom/data/policies.json?t='+Date.now()).then(r=>r.json()).then(d=>{ if(Array.isArray(d))setItems(d) }).finally(()=>setLoading(false)); fetch('/showroom/data/policies.updated.json').then(r=>r.json()).then(d=>{ if(d.updatedAt)setUpdatedAt(new Date(d.updatedAt).toLocaleString('zh-CN')) }).catch(()=>{}) }, [])

  function copyText(text: string): Promise<void> { if(navigator.clipboard)return navigator.clipboard.writeText(text); return new Promise((r,rej)=>{ const ta=document.createElement('textarea'); ta.value=text; ta.style.position='fixed';ta.style.left='-9999px'; document.body.appendChild(ta);ta.select(); try{document.execCommand('copy');r()}catch(e){rej(e)} document.body.removeChild(ta) }) }
  function fmtPolicy(p: Policy): string { const l:string[]=[]; l.push('【'+p.brand+'】'+p.category+' · '+p.country); if(p.style)l.push('品牌风格：'+p.style); if(p.priceRange)l.push('价格段：'+p.priceRange); if(p.series)l.push('系列：'+p.series); if(p.ss26)l.push('\n📌 26SS：\n'+p.ss26); if(p.aw26)l.push('\n📌 26AW：\n'+p.aw26); if(p.delivery)l.push('\n📦 发货：\n'+p.delivery); if(p.nonCutoff)l.push('\n⏰ 非截单：\n'+p.nonCutoff); if(p.pr)l.push('\n🌟 公关：\n'+p.pr); return l.join('\n') }

  function toggle(i:number){ setExpanded(p=>{ const n=new Set(p); if(n.has(i))n.delete(i);else n.add(i); return n }) }
  function toggleAll(){ if(expandAll){ setExpanded(new Set());setExpandAll(false) } else { setExpanded(new Set(filtered.map(p=>p._idx)));setExpandAll(true) } }

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
      const upd = items.map((p,i)=>i===editingIdx?{category:editDraft.category,country:editDraft.country,brand:editDraft.brand,style:editDraft.style,priceRange:editDraft.priceRange,series:editDraft.series,ss26:editDraft.ss26,aw26:editDraft.aw26,delivery:editDraft.delivery,nonCutoff:editDraft.nonCutoff,pr:editDraft.pr}:p)
      const res=await fetch('/api/admin/policy',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({policies:upd})})
      if(res.ok){ setItems(upd); setEditingIdx(null); setEditDraft(null); setSavedIdx(editingIdx); setSaveMsg('保存成功'); setTimeout(()=>{setSavedIdx(null);setSaveMsg('')},2000)
        const el=document.querySelector('[data-idx="'+editingIdx+'"]'); if(el)el.scrollIntoView({behavior:'smooth',block:'center'})
        fetch('/showroom/data/policies.updated.json').then(r=>r.json()).then(d=>{if(d.updatedAt)setUpdatedAt(new Date(d.updatedAt).toLocaleString('zh-CN'))}).catch(()=>{})
      } else { const e=await res.json().catch(()=>({})); setSaveMsg(e.error||'保存失败') }
    } catch { setSaveMsg('网络错误') }
    setSaving(false)
  }

  function addBrand(){ const ni=items.length; setItems(p=>[...p,{...EMPTY}]); setTimeout(()=>{ setEditingIdx(ni);setEditDraft({...EMPTY});setExpanded(p=>{const n=new Set(p);n.add(ni);return n});
    const el=document.querySelector('[data-idx="'+ni+'"] input'); if(el)(el as HTMLElement).focus() },50) }

  async function removeBrand(idx:number){ if(!confirm('确定删除?'))return; setEditingIdx(null);setEditDraft(null); const upd=items.filter((_,i)=>i!==idx); setSaving(true)
    try { const res=await fetch('/api/admin/policy',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({policies:upd})}); if(res.ok){ setItems(upd); setSaveMsg('已删除');setTimeout(()=>setSaveMsg(''),2000) } else setSaveMsg('删除失败') } catch { setSaveMsg('网络错误') }; setSaving(false) }

  async function exportExcel(){ const X = await import('xlsx'); const h = ['类目','国家','品牌','品牌风格','主力销售价格段','最新订货系列','26SS订货政策门槛','26AW订货政策','26AW品牌上新时间','非截单时间(沟通)','明星公关']; const rows=[h]; items.forEach(p=>rows.push([p.category,p.country,p.brand,p.style,p.priceRange,p.series,p.ss26,p.aw26,p.delivery,p.nonCutoff,p.pr])); const ws=X.utils.aoa_to_sheet(rows); ws['!cols']=[{wch:10},{wch:8},{wch:16},{wch:24},{wch:14},{wch:16},{wch:36},{wch:36},{wch:24},{wch:24},{wch:24}]; const wb=X.utils.book_new(); X.utils.book_append_sheet(wb,ws,'订货政策'); X.writeFile(wb,'订货政策_'+new Date().toISOString().slice(0,10)+'.xlsx') }

  const catCounts=useMemo(()=>{ const m:Record<string,number>={}; items.forEach(p=>{m[p.category]=(m[p.category]||0)+1}); return m },[items])
  const countryCounts=useMemo(()=>{ const m:Record<string,number>={}; items.forEach(p=>{m[p.country]=(m[p.country]||0)+1}); return m },[items])
  const cats=Object.keys(catCounts).sort(); const countries=Object.keys(countryCounts).sort()
  const filtered=useMemo(()=>{ let list=[...items].map((p,idx)=>({...p,_idx:idx})); list.sort((a,b)=>(a[sortKey]||'').localeCompare(b[sortKey]||'','zh')); return list.filter(p=>{ if(catFilter&&p.category!==catFilter)return false; if(countryFilter&&p.country!==countryFilter)return false; if(search){const q=search.toLowerCase();if(!p.brand.toLowerCase().includes(q)&&!p.style.toLowerCase().includes(q))return false}; return true }) },[items,sortKey,catFilter,countryFilter,search])
  const grouped=useMemo(()=>{ const g:Record<string,typeof filtered>={}; filtered.forEach(p=>{if(!g[p.category])g[p.category]=[];g[p.category].push(p)}); return g },[filtered])

  if(loading)return <div className="p-10 text-center text-neutral-400">加载中...</div>

  return (<div className="p-4 md:p-8 lg:p-10 max-w-4xl overflow-x-hidden">
    <PageHeader title="订货政策" backTo="/internal/dashboard" backLabel="返回首页" />
    <div className="flex items-center justify-between mb-6 flex-wrap gap-3"><div><h1 className="text-[1.3rem] font-semibold text-neutral-900 mb-1">品牌订货政策</h1><p className="text-[0.82rem] text-neutral-500">{items.length} 个品牌{filtered.length!==items.length?' · 筛选 '+filtered.length+' 个':''}{updatedAt&&<span className="text-neutral-400"> · 更新于 {updatedAt}</span>}</p></div>
    <div className="flex items-center gap-1.5 flex-wrap">{canEdit&&<button onClick={addBrand} className="min-h-[44px] px-3 py-1.5 text-[0.75rem] rounded-lg border bg-white text-neutral-700 border-neutral-300 hover:bg-neutral-50 flex items-center gap-1"><Plus size={13}/> 添加</button>}{canEdit&&<button onClick={exportExcel} className="min-h-[44px] px-3 py-1.5 text-[0.75rem] rounded-lg border bg-white text-neutral-700 border-neutral-300 hover:bg-neutral-50 flex items-center gap-1"><Download size={13}/> 导出</button>}<button onClick={()=>{if(filtered.length===0)return; copyText(filtered.map(p=>fmtPolicy(p)).join('\n\n---\n\n')).then(()=>{setCopyAllId(true);setTimeout(()=>setCopyAllId(false),2000)})}} className={`min-h-[44px] px-3 py-1.5 text-[0.75rem] rounded-lg border font-medium ${copyAllId?'bg-emerald-50 text-emerald-700 border-emerald-300':'bg-[#2563EB] text-white border-[#2563EB] hover:bg-blue-600'}`}>{copyAllId?'已复制全部':'复制全部'}</button><button onClick={toggleAll} className="min-h-[44px] text-[0.75rem] text-neutral-500 hover:text-neutral-900">{expandAll?'收起全部':'展开全部'}</button></div></div>
    {saveMsg&&<div className={`mb-4 text-[0.82rem] px-3 py-2 rounded-lg ${saveMsg.includes('成功')||saveMsg.includes('已删除')?'bg-green-50 text-green-700':'bg-red-50 text-red-700'}`}>{saveMsg}</div>}
    <div className="space-y-2 sm:space-y-3 mb-6"><input type="text" value={search} onChange={e=>setSearch(e.target.value)} placeholder="搜索品牌名或风格..." className="w-full px-3 py-2 min-h-[44px] border border-neutral-300 rounded-lg text-[0.85rem] focus:outline-none focus:border-neutral-900" />
    <div className="flex items-center gap-1.5 flex-wrap"><span className="text-[0.65rem] text-neutral-400 mr-1">排序：</span>{([['category','类目'],['country','国家'],['brand','品牌']]as[SortKey,string][]).map(([k,v])=>(<button key={k} onClick={()=>setSortKey(k)} className={`min-h-[40px] sm:min-h-[44px] px-2 sm:px-2.5 py-1 text-[0.68rem] sm:text-[0.7rem] rounded-md border ${sortKey===k?'bg-neutral-100 border-neutral-400 text-neutral-900':'bg-white text-neutral-500 border-neutral-200 hover:border-neutral-400'}`}>{v}</button>))}</div>
    <div className="flex flex-wrap gap-1.5"><span className="text-[0.65rem] text-neutral-400 mr-1 self-center">类目：</span><button onClick={()=>setCatFilter('')} className={`min-h-[40px] sm:min-h-[44px] px-2 sm:px-2.5 py-1 text-[0.68rem] sm:text-[0.7rem] rounded-md border ${!catFilter?'bg-neutral-900 text-white border-neutral-900':'bg-white text-neutral-600 border-neutral-200 hover:border-neutral-400'}`}>全部</button>{cats.map(c=>(<button key={c} onClick={()=>setCatFilter(catFilter===c?'':c)} className={`min-h-[40px] sm:min-h-[44px] px-2 sm:px-2.5 py-1 text-[0.68rem] sm:text-[0.7rem] rounded-md border ${catFilter===c?'bg-neutral-900 text-white border-neutral-900':'bg-white text-neutral-600 border-neutral-200 hover:border-neutral-400'}`}>{c}({catCounts[c]})</button>))}</div>
    <div className="flex flex-wrap gap-1.5"><span className="text-[0.65rem] text-neutral-400 mr-1 self-center">国家：</span><button onClick={()=>setCountryFilter('')} className={`min-h-[40px] sm:min-h-[44px] px-2 sm:px-2.5 py-1 text-[0.68rem] sm:text-[0.7rem] rounded-md border ${!countryFilter?'bg-neutral-900 text-white border-neutral-900':'bg-white text-neutral-600 border-neutral-200 hover:border-neutral-400'}`}>全部</button>{countries.map(c=>(<button key={c} onClick={()=>setCountryFilter(countryFilter===c?'':c)} className={`min-h-[40px] sm:min-h-[44px] px-2 sm:px-2.5 py-1 text-[0.68rem] sm:text-[0.7rem] rounded-md border ${countryFilter===c?'bg-neutral-900 text-white border-neutral-900':'bg-white text-neutral-600 border-neutral-200 hover:border-neutral-400'}`}>{c}({countryCounts[c]})</button>))}</div></div>
    {Object.entries(grouped).map(([cat,brands])=>(<div key={cat} className="mb-6">{sortKey==='category'&&<h2 className="text-[0.7rem] tracking-[0.12em] uppercase text-neutral-400 font-medium mb-2 px-1">{cat} · {brands.length} 品牌</h2>}<div className="space-y-2">{brands.map((p)=>{const i=p._idx;const isEditing=editingIdx===i;const draft=isEditing?editDraft:null;return(<div key={i} data-idx={i} className={`bg-white border rounded-xl overflow-hidden transition-colors ${isEditing?'border-[#2563EB] shadow-sm':savedIdx===i?'border-emerald-400 bg-emerald-50/30':'border-neutral-200'}`}><div onClick={()=>{if(!isEditing)toggle(i)}} className="flex items-center justify-between px-4 py-3 bg-neutral-50/50 cursor-pointer hover:bg-neutral-100 transition-colors" role="button"><div className="flex items-center gap-2 min-w-0"><span className="text-[0.9rem] font-semibold text-neutral-900">{isEditing&&draft?draft.brand||'新品牌':p.brand}</span><span className="text-[0.62rem] text-neutral-400 bg-neutral-100 px-1.5 py-0.5 rounded">{isEditing&&draft?draft.category||p.category:p.category}</span><span className="text-[0.62rem] text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">{isEditing&&draft?draft.country||p.country:p.country}</span></div><div className="flex items-center gap-1 shrink-0 ml-2">{canEdit&&!isEditing&&<button onClick={e=>{e.stopPropagation();startEdit(i)}} className="min-h-[40px] sm:min-h-[44px] min-w-[40px] sm:min-w-[44px] flex items-center justify-center text-neutral-300 hover:text-[#2563EB] hover:bg-blue-50 rounded-lg"><Edit3 size={13}/></button>}{canEdit&&isEditing&&<><button onClick={()=>removeBrand(i)} className="min-h-[44px] min-w-[44px] flex items-center justify-center text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg"><Trash2 size={15}/></button><button onClick={cancelEdit} className="min-h-[44px] min-w-[44px] flex items-center justify-center text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 rounded-lg"><X size={15}/></button><button onClick={saveCard} disabled={saving} className="min-h-[44px] px-4 py-1.5 bg-[#2563EB] text-white text-[0.72rem] font-medium rounded-lg hover:bg-blue-600 disabled:opacity-50 flex items-center gap-1">{saving?<Loader2 size={12} className="animate-spin"/>:<Save size={13}/>}{saving?'...':'保存'}</button></>}{!isEditing&&<><button onClick={e=>{e.stopPropagation();copyText(fmtPolicy(p)).then(()=>{setCopiedId(i);setTimeout(()=>setCopiedId(null),2000)})}} className={`min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg ${copiedId===i?'text-emerald-600':'text-neutral-300 hover:text-neutral-500'}`}>{copiedId===i?<span className="text-[0.65rem] font-medium">已复制</span>:<Copy size={14}/>}</button><button onClick={e=>{e.stopPropagation();toggle(i)}} className="min-h-[44px] min-w-[44px] flex items-center justify-center text-[0.65rem] text-neutral-400 hover:text-neutral-600">{expanded.has(i)?'收起 ▲':'详情 ▼'}</button></>}</div></div>{isEditing?(<div className="px-4 pb-4 pt-3 space-y-3"><div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">{SHORT.map(f=>(<div key={f}><label className="text-[0.65rem] font-medium text-neutral-400 mb-0.5 block">{FL[f]}</label><input value={(draft as any)[f]} onChange={e=>updateDraft(f,e.target.value)} className="w-full min-h-[44px] px-3 py-2 text-[0.82rem] border border-neutral-200 rounded-lg focus:outline-none focus:border-[#2563EB]"/></div>))}</div>{LONG.map(f=>(<div key={f}><label className="text-[0.65rem] font-medium text-neutral-400 mb-0.5 block">{FL[f]}</label><textarea value={(draft as any)[f]} onChange={e=>updateDraft(f,e.target.value)} rows={3} className="w-full px-3 py-2 text-[0.82rem] border border-neutral-200 rounded-lg focus:outline-none focus:border-[#2563EB] resize-y"/></div>))}</div>):(<div className="px-4 pb-1"><div className="flex flex-wrap items-center gap-x-4 gap-y-0.5 py-2"><span className="text-[0.7rem] text-neutral-500 truncate max-w-[160px] sm:max-w-[240px]">{p.style}</span><span className="text-[0.72rem] text-neutral-600 font-medium">{p.priceRange}</span></div><div className="pb-4 border-t border-neutral-100 pt-3 space-y-3">{p.series&&<FB label="最新订货系列" color="blue" content={p.series}/>}<div className="grid sm:grid-cols-2 gap-3">{p.ss26&&<FB label="26SS订货政策门槛" color="amber" content={p.ss26}/>}{p.aw26&&<FB label="26AW订货政策" color="emerald" content={p.aw26}/>}</div>{p.delivery&&<FB label="26AW品牌上新时间" color="neutral" content={p.delivery}/>}{p.nonCutoff&&<FB label="非截单时间(沟通)" color="purple" content={p.nonCutoff}/>}{p.pr&&<FB label="明星公关" color="rose" content={p.pr}/>}</div></div>)}</div>)})}</div></div>))}
    {filtered.length===0&&(<div className="text-center py-16"><p className="text-[0.85rem] text-neutral-400 mb-3">没有匹配的品牌</p>{(search||catFilter||countryFilter)&&<button onClick={()=>{setSearch('');setCatFilter('');setCountryFilter('')}} className="text-[0.78rem] text-[#2563EB] hover:text-blue-700 underline">清除筛选条件</button>}</div>)}
  </div>)
}

function FB({label,color,content}:{label:string;color:string;content:string}){const cm:Record<string,string>={blue:'border-blue-200',amber:'border-amber-200',emerald:'border-emerald-200',neutral:'border-neutral-200',purple:'border-purple-200',rose:'border-rose-200'};const bm:Record<string,string>={blue:'bg-blue-50 text-blue-700',amber:'bg-amber-50 text-amber-700',emerald:'bg-emerald-50 text-emerald-700',neutral:'bg-neutral-100 text-neutral-600',purple:'bg-purple-50 text-purple-700',rose:'bg-rose-50 text-rose-700'};return(<div className={`border-l-2 ${cm[color]||'border-neutral-200'} pl-3`}><span className={`inline-block text-[0.6rem] font-medium ${bm[color]||''} px-1.5 py-0.5 rounded mb-1`}>{label}</span><p className="text-[0.85rem] md:text-[0.88rem] text-neutral-800 whitespace-pre-line leading-relaxed">{content}</p></div>)}
