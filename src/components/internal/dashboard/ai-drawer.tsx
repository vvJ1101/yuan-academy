'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Bot, Loader2, FileText } from 'lucide-react'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'

interface Props {
  documentId: string | null
  documentTitle: string
  onClose: () => void
}

interface DocDetail {
  id: string; title: string; condensedContent?: string; fullContent?: string
  ownerDept?: { name: string; slug?: string } | null
  audiences?: { department?: { name: string; slug: string } }[]
  extractedJson?: string | null
}

function docUrl(d: DocDetail) {
  const dept = d.audiences?.[0]?.department?.slug || d.ownerDept?.slug || 'doc'
  return `/internal/docs/${dept}/${encodeURIComponent(d.title.replace(/[/\\?%*:|"<>]/g, '-').substring(0, 200))}`
}

export function AIDrawer({ documentId, documentTitle, onClose }: Props) {
  const [doc, setDoc] = useState<DocDetail | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!documentId) return
    setLoading(true); setError('')
    fetch(`/api/documents/${documentId}`)
      .then(r => r.json())
      .then(d => { if (d?.id) setDoc(d); else setError('文档未找到') })
      .catch(() => setError('加载失败'))
      .finally(() => setLoading(false))
  }, [documentId])

  // Extract attachments from extractedJson
  let attachments: string[] = []
  if (doc?.extractedJson) {
    try {
      const json = JSON.parse(doc.extractedJson)
      if (json.images?.length) attachments = json.images.map((img: any) => img.src || img).filter(Boolean)
    } catch { /* */ }
  }

  const hasContent = doc?.condensedContent || doc?.fullContent

  return (
    <Sheet open onOpenChange={(open) => { if (!open) onClose() }}>
      <SheetContent className="w-[480px] max-w-[100vw] p-0 flex flex-col" side="right">
        <SheetHeader className="px-5 py-4 border-b border-neutral-100 shrink-0">
          <SheetTitle className="flex items-center gap-2 text-[0.95rem] font-semibold text-neutral-800">
            <Bot size={18} strokeWidth={1.5} className="text-[#2563EB]" />
            {documentTitle}
            <span className="text-neutral-400 font-normal">· AI 速读</span>
          </SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {loading && (
            <div className="flex items-center justify-center py-20">
              <Loader2 size={20} strokeWidth={1.5} className="animate-spin text-[#2563EB]" />
            </div>
          )}

          {error && !loading && (
            <div className="text-center py-20">
              <p className="text-[0.85rem] text-neutral-500 mb-3">{error}</p>
              {documentId && (
                <Link href={`/internal/documents/${documentId}`}
                  className="text-[0.82rem] text-[#2563EB] hover:underline font-medium">
                  前往文档页查看
                </Link>
              )}
            </div>
          )}

          {!loading && !error && !hasContent && (
            <div className="text-center py-20">
              <FileText size={32} strokeWidth={1} className="text-neutral-300 mx-auto mb-3" />
              <p className="text-[0.85rem] text-neutral-500 mb-3">该文档尚未生成 AI 摘要</p>
              <Link href={doc ? docUrl(doc) : '/internal/documents'}
                className="text-[0.82rem] text-[#2563EB] hover:underline font-medium">
                前往文档页进行 AI 解析
              </Link>
            </div>
          )}

          {!loading && !error && hasContent && (
            <div className="prose prose-sm max-w-none prose-headings:text-neutral-800 prose-p:text-neutral-600 prose-li:text-neutral-600">
              <div className="text-[0.85rem] text-neutral-700 leading-relaxed whitespace-pre-wrap"
                dangerouslySetInnerHTML={{
                  __html: (doc!.condensedContent || doc!.fullContent || '')
                    .replace(/^# (.+)/gm, '<h2 class="text-[1rem] font-semibold text-neutral-800 mt-6 mb-2">$1</h2>')
                    .replace(/^## (.+)/gm, '<h3 class="text-[0.9rem] font-semibold text-neutral-700 mt-4 mb-1">$1</h3>')
                    .replace(/^### (.+)/gm, '<h4 class="text-[0.85rem] font-medium text-neutral-700 mt-3 mb-1">$1</h4>')
                    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
                    .replace(/\*(.+?)\*/g, '<em>$1</em>')
                    .replace(/`(.+?)`/g, '<code class="bg-neutral-100 px-1 py-0.5 rounded text-[0.8rem]">$1</code>')
                    .replace(/!\[(.*?)\]\((.+?)\)/g, '<img src="$2" alt="$1" class="max-w-full rounded-lg my-3" />')
                    .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" class="text-[#2563EB] hover:underline">$1</a>')
                    .replace(/^- (.+)/gm, '<li class="ml-4 text-[0.85rem]">$1</li>')
                    .replace(/^(\d+)\. (.+)/gm, '<li class="ml-4 text-[0.85rem]">$2</li>')
                    .replace(/\n\n/g, '<br/><br/>')
                }}
              />
            </div>
          )}
        </div>

        {/* Footer: Attachments */}
        {attachments.length > 0 && (
          <div className="shrink-0 px-5 py-3 border-t border-neutral-100 bg-neutral-50">
            <p className="flex items-center gap-1.5 text-[0.72rem] font-medium text-neutral-500 mb-2">
              <FileText size={12} strokeWidth={1.5} />
              关联附件
            </p>
            <div className="space-y-1">
              {attachments.map((src, i) => (
                <a key={i} href={src} target="_blank" rel="noopener noreferrer"
                  className="block text-[0.75rem] text-[#2563EB] hover:underline truncate">
                  {src.split('/').pop() || `附件 ${i + 1}`}
                </a>
              ))}
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}
