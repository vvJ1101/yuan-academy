'use client'

import { MessageCircle } from 'lucide-react'

interface AIChatProps {
  documentId?: string
  documentTitle?: string
}

export function AIChat({ documentId, documentTitle }: AIChatProps) {
  const href = documentId
    ? `/internal/ai?docId=${encodeURIComponent(documentId)}&docTitle=${encodeURIComponent(documentTitle || '')}`
    : '/internal/ai'

  return (
    <a
      href={href}
      className="fixed bottom-6 right-6 w-12 h-12 bg-[#2563EB] text-white rounded-full shadow-lg hover:bg-blue-600 hover:shadow-xl hover:scale-105 transition-all flex items-center justify-center z-50 no-underline"
      title="AI 知识助手"
    >
      <MessageCircle size={20} />
    </a>
  )
}
