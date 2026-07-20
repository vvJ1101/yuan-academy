'use client'

import { useState } from 'react'
import type { FormEvent } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'

interface UploadDialogProps {
  open: boolean
  onClose: () => void
  onUploaded: () => void
}

export function UploadDialog({ open, onClose, onUploaded }: UploadDialogProps) {
  const [file, setFile] = useState<File | null>(null)
  const [mode, setMode] = useState<'merge' | 'replace'>('merge')
  const [confirmReplace, setConfirmReplace] = useState('')
  const [status, setStatus] = useState<'idle' | 'uploading' | 'done' | 'error'>('idle')
  const [message, setMessage] = useState('')

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!file) return
    if (mode === 'replace' && confirmReplace !== '我确认全量替换当前品牌对接信息') {
      setStatus('error')
      setMessage('全量替换前请输入确认文字')
      return
    }

    setStatus('uploading')
    setMessage('')
    const formData = new FormData()
    formData.append('type', 'contact')
    formData.append('mode', mode)
    formData.append('file', file)

    try {
      const response = await fetch('/api/admin/brand-data/upload', { method: 'POST', body: formData })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        setStatus('error')
        setMessage(data.error || '上传失败')
        return
      }
      setStatus('done')
      setMessage(`上传成功：导入 ${data.imported || 0} 条，当前共 ${data.total || 0} 条`)
      setFile(null)
      setConfirmReplace('')
      onUploaded()
    } catch {
      setStatus('error')
      setMessage('网络错误，请稍后重试')
    }
  }

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => { if (!nextOpen) onClose() }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>上传品牌对接信息</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="block text-[0.75rem] font-medium text-neutral-700 mb-1.5">Excel 文件 (.xlsx)</label>
            <input
              type="file"
              accept=".xlsx"
              onChange={event => setFile(event.target.files?.[0] || null)}
              className="w-full text-[0.82rem] file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-[#2563EB] file:text-white"
              required
            />
            {file && (
              <p className="text-[0.72rem] text-neutral-400 mt-1.5">
                已选择：{file.name} ({(file.size / 1024).toFixed(0)} KB)
              </p>
            )}
          </div>

          <fieldset className="space-y-2">
            <legend className="text-[0.75rem] font-medium text-neutral-700">更新方式</legend>
            <label className="flex items-start gap-2 text-[0.78rem] text-neutral-700">
              <input type="radio" checked={mode === 'merge'} onChange={() => setMode('merge')} className="mt-1" />
              <span>增量更新：同名品牌覆盖非空字段，新品牌新增</span>
            </label>
            <label className="flex items-start gap-2 text-[0.78rem] text-neutral-700">
              <input type="radio" checked={mode === 'replace'} onChange={() => setMode('replace')} className="mt-1" />
              <span>全量替换：用这份 Excel 完整替换当前资料</span>
            </label>
          </fieldset>

          {mode === 'replace' && (
            <div>
              <label className="block text-[0.72rem] text-red-600 mb-1">
                请输入“我确认全量替换当前品牌对接信息”
              </label>
              <input
                value={confirmReplace}
                onChange={event => setConfirmReplace(event.target.value)}
                className="w-full min-h-[44px] px-3 py-2 text-[0.82rem] border border-red-200 rounded-lg focus:outline-none focus:border-red-400"
              />
            </div>
          )}

          {message && (
            <div className={`text-[0.8rem] px-3 py-2 rounded-lg ${
              status === 'done' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
            }`}>
              {message}
            </div>
          )}

          <div className="flex items-center justify-end gap-2">
            <button type="button" onClick={onClose} className="min-h-[44px] px-4 py-2 text-[0.82rem] rounded-lg border border-neutral-200 text-neutral-600 hover:bg-neutral-50">
              取消
            </button>
            <button type="submit" disabled={!file || status === 'uploading'} className="min-h-[44px] px-4 py-2 text-[0.82rem] rounded-lg bg-[#2563EB] text-white hover:bg-blue-600 disabled:opacity-50">
              {status === 'uploading' ? '上传中...' : '开始上传'}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
