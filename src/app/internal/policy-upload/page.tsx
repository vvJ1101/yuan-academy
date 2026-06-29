'use client'

import { useState } from 'react'
import { PageHeader } from '@/components/internal/page-header'

export default function AdminPolicyPage() {
  const [file, setFile] = useState<File | null>(null)
  const [status, setStatus] = useState<'idle'|'uploading'|'done'|'error'>('idle')
  const [message, setMessage] = useState('')
  const [brands, setBrands] = useState<string[]>([])

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault()
    if (!file) return
    setStatus('uploading')
    const fd = new FormData(); fd.append('file', file)
    try {
      const res = await fetch('/api/admin/policy-upload', { method: 'POST', body: fd })
      const d = await res.json()
      if (res.ok) { setStatus('done'); setBrands(d.brands||[]); setMessage(`上传成功! ${d.updated||0} 更新, ${d.added||0} 新增`); setFile(null) }
      else { setStatus('error'); setMessage(d.error||'上传失败') }
    } catch { setStatus('error'); setMessage('网络错误') }
  }

  return (<div className="p-6 md:p-8 lg:p-10 max-w-2xl">
    <PageHeader title="订货政策" backTo="/internal/admin" backLabel="返回管理中心" />
    <div className="mb-8"><h1 className="text-[1.3rem] font-semibold text-neutral-900 mb-1">更新订货政策</h1><p className="text-[0.82rem] text-neutral-500">上传最新版各品牌订货政策 Excel</p></div>
    <div className="bg-white border border-neutral-200 rounded-xl p-6">
      <form onSubmit={handleUpload} className="space-y-5">
        <div><label className="block text-[0.75rem] font-medium text-neutral-700 mb-1.5">Excel 文件 (.xlsx)</label>
          <input type="file" accept=".xlsx" onChange={e=>setFile(e.target.files?.[0]||null)} className="w-full text-[0.85rem] file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-[0.8rem] file:font-medium file:bg-[#2563EB] file:text-white hover:file:bg-neutral-800 file:transition-colors" required/>
          {file && <p className="text-[0.72rem] text-neutral-400 mt-1.5">已选择: {file.name} ({(file.size/1024).toFixed(0)} KB)</p>}</div>
        {message && <div className={`text-[0.82rem] px-3 py-2 rounded-md ${status==='done'?'bg-green-50 text-green-700':status==='error'?'bg-red-50 text-red-700':''}`}>{message}{status==='done'&&brands.length>0&&<div className="mt-2 flex flex-wrap gap-1">{brands.map((b,i)=>(<span key={i} className="text-[0.65rem] bg-green-100 text-green-700 px-1.5 py-0.5 rounded">{b}</span>))}</div>}</div>}
        <button type="submit" disabled={!file||status==='uploading'} className="px-6 py-2.5 bg-[#2563EB] text-white text-[0.82rem] font-medium rounded-md hover:bg-blue-600 disabled:opacity-50">{status==='uploading'?'解析中...':'上传并更新'}</button>
      </form>
    </div>
    <div className="mt-4"><a href="/showroom/data/订货政策-上传模板.xlsx" className="text-[0.75rem] text-neutral-500 hover:text-neutral-900 underline">下载 Excel 模版</a></div>
  </div>)
}
