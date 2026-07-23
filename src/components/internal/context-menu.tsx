'use client'

import { useEffect, useRef, useState } from 'react'

interface MenuItem {
  label: string; icon?: string; onClick: () => void; danger?: boolean; divider?: boolean
}

interface Props {
  x: number; y: number; items: MenuItem[]; onClose: () => void
}

export function ContextMenu({ x, y, items, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ x, y })
  const [measured, setMeasured] = useState(false)

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onClose() }
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('mousedown', h)
    document.addEventListener('keydown', k)
    return () => { document.removeEventListener('mousedown', h); document.removeEventListener('keydown', k) }
  }, [onClose])

  useEffect(() => {
    setMeasured(false)
    setPos({ x, y })

    const measureAndPosition = () => {
      if (!ref.current) return

      const rect = ref.current.getBoundingClientRect()
      const menuHeight = rect.height

      if (menuHeight === 0) {
        requestAnimationFrame(measureAndPosition)
        return
      }

      const maxX = window.innerWidth - rect.width - 8
      const maxY = window.innerHeight - menuHeight - 8

      const viewportCenterY = window.innerHeight / 2
      let newX = x
      let newY = y

      if (newY > viewportCenterY) {
        newY = newY - menuHeight
      }

      newX = Math.max(8, Math.min(newX, maxX))
      newY = Math.max(8, Math.min(newY, maxY))

      setPos({ x: newX, y: newY })
      setMeasured(true)
    }

    requestAnimationFrame(measureAndPosition)
  }, [x, y, items])

  return (
    <div
      ref={ref}
      className={`fixed z-50 bg-white border border-neutral-200 rounded-lg shadow-xl py-1 min-w-[160px] ${measured ? 'opacity-100' : 'opacity-0'}`}
      style={{ left: `${pos.x}px`, top: `${pos.y}px`, transition: 'opacity 0.05s ease-out' }}>
      {items.map((item, i) => (
        <div key={i}>
          {item.divider && <div className="my-1 border-t border-neutral-100" />}
          <button onClick={() => { item.onClick(); onClose() }}
            className={`w-full text-left px-3 py-1.5 text-[0.78rem] transition-colors flex items-center gap-2 ${
              item.danger ? 'text-red-600 hover:bg-red-50' : 'text-neutral-700 hover:bg-neutral-100'
            }`}>
            {item.icon && <span>{item.icon}</span>}
            {item.label}
          </button>
        </div>
      ))}
    </div>
  )
}