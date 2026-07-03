'use client'

import { useEffect, useCallback } from 'react'
import { X, ExternalLink, Building2 } from 'lucide-react'
import Link from 'next/link'

interface Brand {
  name: string
  slug: string
  desc: string
  image: string
  tags: string[]
  fullDesc: string
  highlights: string[]
}

interface Props {
  brand: Brand
  onClose: () => void
}

export default function CompanyProfileModal({ brand, onClose }: Props) {
  // ESC key to close
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose()
  }, [onClose])

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = ''
    }
  }, [handleKeyDown])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
      onClick={onClose}
    >
      {/* Backdrop with blur */}
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm animate-in fade-in duration-300" />

      {/* Modal card */}
      <div
        onClick={e => e.stopPropagation()}
        className="relative w-full max-w-md animate-in fade-in zoom-in-95 slide-in-from-bottom-4 duration-400 ease-out"
      >
        <div className="bg-white rounded-3xl shadow-2xl shadow-black/10 overflow-hidden">
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-3 right-3 z-10 w-8 h-8 flex items-center justify-center rounded-full bg-white/80 backdrop-blur-sm text-neutral-500 hover:text-neutral-800 hover:bg-white transition-all"
          >
            <X size={16} strokeWidth={2} />
          </button>

          {/* Image */}
          <div className="aspect-[16/9] overflow-hidden bg-neutral-100">
            <img
              src={brand.image}
              alt={brand.name}
              className="w-full h-full object-cover"
            />
          </div>

          {/* Content */}
          <div className="p-6">
            {/* Name + Desc */}
            <h3 className="text-xl font-semibold text-neutral-900">{brand.name}</h3>
            <p className="text-sm text-neutral-500 mt-1 leading-relaxed">{brand.desc}</p>

            {/* Tags */}
            <div className="flex flex-wrap gap-1.5 mt-4">
              {brand.tags.map(t => (
                <span
                  key={t}
                  className="text-[0.7rem] font-medium px-2.5 py-1 rounded-full bg-neutral-100 text-neutral-600"
                >
                  {t}
                </span>
              ))}
            </div>

            {/* Divider */}
            <div className="my-5 border-t border-neutral-100" />

            {/* Highlights */}
            <div className="space-y-2.5">
              {brand.highlights.map((h, i) => (
                <div key={i} className="flex items-start gap-3">
                  <span className="w-1.5 h-1.5 rounded-full bg-neutral-300 mt-2 shrink-0" />
                  <span className="text-sm text-neutral-600 leading-relaxed">{h}</span>
                </div>
              ))}
            </div>

            {/* CTA */}
            <Link
              href={`/internal/documents?company=${brand.slug}`}
              onClick={onClose}
              className="mt-6 w-full flex items-center justify-center gap-2 py-3 bg-neutral-900 text-white text-sm font-medium rounded-xl hover:bg-neutral-800 transition-colors no-underline"
            >
              <Building2 size="16" strokeWidth={1.5} />
              进入知识空间
              <ExternalLink size={14} strokeWidth={1.5} />
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
