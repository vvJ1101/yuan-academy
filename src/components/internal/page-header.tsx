'use client'

import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

interface Props {
  title: string
  backTo: string
  backLabel?: string
}

export function PageHeader({ title, backTo, backLabel }: Props) {
  return (
    <div className="flex items-center gap-3 mb-6">
      <Link
        href={backTo}
        className="inline-flex items-center gap-1.5 text-[0.82rem] text-neutral-500 hover:text-neutral-900 transition-colors no-underline"
      >
        <ArrowLeft size={16} strokeWidth={1.5} />
        {backLabel || '返回'}
      </Link>
      <span className="w-px h-4 bg-neutral-200" />
      <h1 className="text-[1rem] font-semibold text-neutral-800">{title}</h1>
    </div>
  )
}
