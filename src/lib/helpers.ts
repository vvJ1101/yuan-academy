// ═══════════════════════════════════════════════════════════════════════
// Shared helpers for YUAN Academy — AI 协作禁止修改此文件的类型签名
// ═══════════════════════════════════════════════════════════════════════

// ── Category Labels ──
export const CAT_LABELS: Record<string, string> = {
  training: '培训', sop: 'SOP', policy: '政策',
  reference: '制度', brand: '品牌',
}
export const CAT_STYLE: Record<string, string> = {
  sop: 'bg-blue-50 text-blue-700', training: 'bg-emerald-50 text-emerald-700',
  policy: 'bg-amber-50 text-amber-700', reference: 'bg-slate-100 text-slate-600',
  brand: 'bg-purple-50 text-purple-700',
}

// ── Permission Labels ──
export const PERM_LABELS: Record<string, string> = { view: '查看', edit: '编辑', delete: '删除', admin: '管理' }
export const PERM_LEVEL: Record<string, number> = { view: 1, edit: 2, delete: 3, admin: 4 }

// ── File Type Detection ──
export function guessType(
  title: string,
  category: string
): 'excel' | 'word' | 'pdf' | 'other' {
  const t = title.toLowerCase()
  if (t.endsWith('.xlsx') || t.endsWith('.xls')) return 'excel'
  if (t.endsWith('.docx') || t.endsWith('.doc')) return 'word'
  if (t.endsWith('.pdf')) return 'pdf'
  if (category === 'sop') return 'word'
  if (category === 'policy') return 'excel'
  if (category === 'training') return 'word'
  if (category === 'reference' || category === 'brand') return 'pdf'
  return 'other'
}

export function fileTypeLabel(
  title: string,
  category: string
): string {
  const t = guessType(title, category)
  if (t === 'excel') return 'Excel'
  if (t === 'word') return 'Word'
  if (t === 'pdf') return 'PDF'
  return CAT_LABELS[category] || '文档'
}

// ── Date Formatting ──
export function fmtDate(iso?: string): string {
  if (!iso) return ''
  const n = new Date()
  const d = new Date(iso)
  const diff = n.getTime() - d.getTime()
  const days = Math.floor(diff / 864e5)
  if (days === 0) return '今天'
  if (days === 1) return '昨天'
  if (days < 7) return `${days}天前`
  return d.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })
}

export function fmtTime(iso?: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export function fmtSize(content?: string, fileSize?: number | null): string {
  if (fileSize) {
    const b = fileSize
    if (b < 1024) return `${b} B`
    if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`
    return `${(b / (1024 * 1024)).toFixed(1)} MB`
  }
  if (!content) return '0 B'
  const bytes = new Blob([content]).size
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// ── Permission helpers ──
export function permOk(p: string | null, r: string): boolean {
  if (!p) return false
  return (PERM_LEVEL[p] || 0) >= (PERM_LEVEL[r] || 0)
}
