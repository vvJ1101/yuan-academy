import { Suspense } from 'react'
import AIContent from './ai-content'

export const dynamic = 'force-dynamic'

export default function AIPage() {
  return (
    <Suspense fallback={<div className="p-10 text-center text-neutral-400">加载中...</div>}>
      <AIContent />
    </Suspense>
  )
}
