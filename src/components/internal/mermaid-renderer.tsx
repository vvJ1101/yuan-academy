'use client'

import { useEffect, useRef, useState } from 'react'

interface MermaidProps {
  chart: string
}

export function Mermaid({ chart }: MermaidProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [svg, setSvg] = useState('')
  const [error, setError] = useState('')
  const [fullscreen, setFullscreen] = useState(false)

  useEffect(() => {
    let cancelled = false
    import('mermaid').then((mermaid) => {
      if (cancelled) return
      mermaid.default.initialize({
        startOnLoad: false,
        theme: 'neutral',
        securityLevel: 'loose',
        fontFamily: 'Inter, PingFang SC, Microsoft YaHei, sans-serif',
      })
      const id = `mermaid-${Math.random().toString(36).slice(2, 8)}`
      mermaid.default
        .render(id, chart)
        .then(({ svg }: { svg: string }) => {
          if (!cancelled) setSvg(svg)
        })
        .catch((e: Error) => {
          if (!cancelled) setError(`图表渲染失败: ${e.message}`)
        })
    }).catch(() => {
      if (!cancelled) setError('Mermaid 库加载失败')
    })
    return () => { cancelled = true }
  }, [chart])

  if (error) {
    return <pre className="text-[0.78rem] text-red-500 bg-red-50 p-3 rounded my-4">{error}</pre>
  }

  return (
    <>
      <div className="relative my-8 p-4 md:p-6 bg-neutral-50 rounded-xl border border-neutral-200">
        <div
          ref={ref}
          className="overflow-x-auto -mx-2 px-2 flex justify-center"
          dangerouslySetInnerHTML={{ __html: svg }}
        />
        <button
          onClick={() => setFullscreen(true)}
          className="absolute top-2 right-2 text-[0.65rem] text-neutral-400 hover:text-neutral-700 bg-white px-2 py-1 rounded border border-neutral-200 transition-colors"
        >
          放大查看
        </button>
      </div>

      {/* Fullscreen modal */}
      {fullscreen && (
        <div
          className="fixed inset-0 z-[100] bg-black/85 flex items-center justify-center p-4"
          onClick={() => setFullscreen(false)}
        >
          <button
            onClick={() => setFullscreen(false)}
            className="absolute top-4 right-4 text-white text-[0.8rem] bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded transition-colors"
          >
            关闭
          </button>
          <div
            className="overflow-auto max-w-full max-h-[90vh]"
            dangerouslySetInnerHTML={{ __html: svg }}
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  )
}
