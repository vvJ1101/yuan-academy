'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { Pencil, Trash2 } from 'lucide-react'

// ── Block types ──
type Block =
  | { type: 'heading'; level: number; text: string }
  | { type: 'paragraph'; text: string }
  | { type: 'table'; header: string[]; rows: string[][] }
  | { type: 'list'; items: string[]; ordered: boolean }
  | { type: 'image'; src: string; alt: string }
  | { type: 'code'; lang: string; code: string }
  | { type: 'blank' }
  | { type: 'hr' }

// ── Parser ──
function parseBlocks(md: string): Block[] {
  const blocks: Block[] = []
  const lines = md.split('\n')
  let i = 0
  while (i < lines.length) {
    const line = lines[i], t = line.trim()
    if (!t) { blocks.push({ type: 'blank' }); i++; continue }
    const hm = t.match(/^(#{1,6})\s+(.+)/)
    if (hm) { blocks.push({ type: 'heading', level: hm[1].length, text: hm[2] }); i++; continue }
    if (t.startsWith('|') && i + 1 < lines.length && lines[i + 1].trim().match(/^\|[\s\-:|]+\|$/)) {
      const header = t.split('|').filter(c => c.trim()).map(c => c.trim())
      i += 2
      const rows: string[][] = []
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        rows.push(lines[i].split('|').filter(c => c.trim()).map(c => c.trim())); i++
      }
      blocks.push({ type: 'table', header, rows }); continue
    }
    const imgm = t.match(/^!\[([^\]]*)\]\(([^)]+)\)/)
    if (imgm) { blocks.push({ type: 'image', alt: imgm[1], src: imgm[2] }); i++; continue }
    if (t.startsWith('```')) {
      const lang = t.slice(3).trim(), codeLines: string[] = []; i++
      while (i < lines.length && !lines[i].trim().startsWith('```')) { codeLines.push(lines[i]); i++ }
      i++; blocks.push({ type: 'code', lang, code: codeLines.join('\n') }); continue
    }
    if (t.match(/^[-*_]{3,}$/)) { blocks.push({ type: 'hr' }); i++; continue }
    if (t.match(/^(\d+)[.)]\s?/) || t.match(/^[-*+]\s/)) {
      const ordered = !!t.match(/^(\d+)[.)]\s?/)
      const items: string[] = []
      while (i < lines.length && lines[i].trim().match(ordered ? /^\d+[.)]\s?/ : /^[-*+]\s/)) {
        items.push(lines[i].trim().replace(ordered ? /^\d+[.)]\s*/ : /^[-*+]\s*/, '')); i++
      }
      blocks.push({ type: 'list', items, ordered }); continue
    }
    const paraLines: string[] = []
    while (i < lines.length && lines[i].trim()) { paraLines.push(lines[i]); i++ }
    blocks.push({ type: 'paragraph', text: paraLines.join('\n') })
  }
  return blocks
}

function blocksToMarkdown(blocks: Block[]): string {
  return blocks.map(b => {
    switch (b.type) {
      case 'heading': return '#'.repeat(b.level) + ' ' + b.text
      case 'paragraph': return b.text
      case 'table': {
        const h = '| ' + b.header.join(' | ') + ' |'
        const s = '| ' + b.header.map(() => '---').join(' | ') + ' |'
        const r = b.rows.map(row => '| ' + row.join(' | ') + ' |').join('\n')
        return h + '\n' + s + '\n' + r
      }
      case 'list': return b.items.map((item, idx) => b.ordered ? `${idx + 1}. ${item}` : `- ${item}`).join('\n')
      case 'image': return `![${b.alt}](${b.src})`
      case 'code': return '```' + b.lang + '\n' + b.code + '\n```'
      case 'blank': return ''
      case 'hr': return '---'
    }
  }).join('\n')
}

// ── Inline Editor ──
function InlineEdit({ value, onCommit, rows = 1, className = '' }: {
  value: string; onCommit: (v: string) => void; rows?: number; className?: string
}) {
  const [val, setVal] = useState(value)
  const ref = useRef<HTMLTextAreaElement & HTMLInputElement>(null)
  const isTextarea = rows > 1

  useEffect(() => { ref.current?.focus() }, [])

  function commit() {
    const trimmed = val.trim()
    if (trimmed && trimmed !== value) onCommit(trimmed)
    else if (!trimmed && value) onCommit(value) // revert empty → keep original
  }

  const Tag: any = isTextarea ? 'textarea' : 'input'
  return (
    <Tag
      ref={ref}
      value={val}
      onChange={(e: any) => setVal(e.target.value)}
      onBlur={commit}
      onKeyDown={(e: any) => {
        if (e.key === 'Enter' && !e.shiftKey && !isTextarea) commit()
        if (e.key === 'Escape') commit()
      }}
      rows={isTextarea ? Math.max(2, val.split('\n').length) : undefined}
      className={`w-full px-2 py-1 -mx-1 border border-dashed border-neutral-300 rounded bg-neutral-50 focus:outline-none focus:border-neutral-900 text-neutral-900 font-normal resize-y ${className}`}
    />
  )
}

// ── Editable Heading ──
function EditableHeading({ block, onChange, onPromote }: {
  block: Block & { type: 'heading' }; onChange: (b: Block) => void; onPromote?: (type: string) => void
}) {
  const [editing, setEditing] = useState(false)
  if (editing) return <InlineEdit value={block.text} onCommit={v => { onChange({ ...block, text: v }); setEditing(false) }} className={block.level === 1 ? 'text-[1.35rem] font-semibold' : block.level === 2 ? 'text-[1.15rem] font-semibold' : 'text-[1rem] font-semibold'} />
  const Tag = `h${Math.min(block.level, 4)}` as keyof JSX.IntrinsicElements
  const cls = block.level === 1 ? 'text-[1.35rem] font-semibold text-neutral-900 mt-10 mb-4 pb-2 border-b-2 border-neutral-200' : block.level === 2 ? 'text-[1.15rem] font-semibold text-neutral-900 mt-8 mb-3' : block.level === 3 ? 'text-[1rem] font-semibold text-neutral-800 mt-6 mb-2' : 'text-[0.9rem] font-semibold text-neutral-700 mt-4 mb-2'
  return <Tag className={cls + ' cursor-text'} onClick={() => setEditing(true)}>{block.text}</Tag>
}

// ── Editable Paragraph (with shortcuts) ──
function ShortcutHint() {
  return (
    <div className="absolute -top-7 left-0 bg-neutral-800 text-white text-[0.65rem] px-2 py-0.5 rounded whitespace-nowrap pointer-events-none z-10">
      # 标题 · - 列表 · &gt; 引用 · | 表格 · ``` 代码
    </div>
  )
}

function EditableParagraph({ block, onChange, onConvert }: {
  block: Block & { type: 'paragraph' }; onChange: (b: Block) => void; onConvert: (type: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [showHints, setShowHints] = useState(false)

  // Check for markdown shortcuts
  function checkShortcut(text: string): string | null {
    if (/^#{1,6}\s/.test(text)) return 'heading'
    if (/^-\s/.test(text) || /^\*\s/.test(text)) return 'list'
    if (/^\d+[.)]\s/.test(text)) return 'orderedList'
    return null
  }

  function commit(val: string) {
    if (val.trim()) {
      const shortcut = checkShortcut(val)
      if (shortcut) { onConvert(shortcut); return }
      onChange({ ...block, text: val.trim() })
    }
    setEditing(false)
  }

  if (editing) {
    return (
      <div className="relative">
        {showHints && <ShortcutHint />}
        <InlineEdit value={block.text} onCommit={commit} rows={2}
          className="text-[0.92rem] leading-[1.9]" />
      </div>
    )
  }

  return (
    <p className="text-[0.92rem] leading-[1.9] text-neutral-700 font-normal mb-4 cursor-text"
      onMouseEnter={() => setShowHints(true)} onMouseLeave={() => setShowHints(false)}
      onClick={() => setEditing(true)}>
      {block.text || <span className="text-neutral-300 italic">点击添加内容...（悬停查看快捷键）</span>}
    </p>
  )
}

// ── Editable Table ──
function EditableTable({ block, onChange }: { block: Block & { type: 'table' }; onChange: (b: Block) => void }) {
  return (
    <div className="overflow-x-auto my-6 rounded-lg border border-neutral-200">
      <table className="w-full text-[0.85rem]">
        <thead>
          <tr className="bg-neutral-50">
            {block.header.map((h, ci) => (
              <th key={ci} className="border-b border-neutral-200 px-3 py-2 text-left group relative">
                <input value={h} onChange={e => { const nh = [...block.header]; nh[ci] = e.target.value; onChange({ ...block, header: nh }) }}
                  className="w-full bg-transparent font-semibold text-neutral-700 text-[0.78rem] focus:outline-none focus:text-neutral-900 pr-4" />
                {block.header.length > 1 && (
                  <button onClick={() => onChange({ ...block, header: block.header.filter((_, i) => i !== ci), rows: block.rows.map(r => r.filter((_, i) => i !== ci)) })}
                    className="absolute right-1 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 text-[0.6rem] text-red-400 hover:text-red-600">&times;</button>
                )}
              </th>
            ))}
            <th className="border-b border-neutral-200 px-1 py-2 w-6">
              <button onClick={() => onChange({ ...block, header: [...block.header, '新列'], rows: block.rows.map(r => [...r, '']) })}
                className="text-[0.7rem] text-neutral-400 hover:text-neutral-600">+</button>
            </th>
            <th className="border-b border-neutral-200 w-8" />
          </tr>
        </thead>
        <tbody>
          {block.rows.map((row, ri) => (
            <tr key={ri} className="border-b border-neutral-100 last:border-0 group">
              {row.map((cell, ci) => (
                <td key={ci} className="px-3 py-2">
                  <input value={cell} onChange={e => { const nr = block.rows.map((r, i) => i === ri ? r.map((c, j) => j === ci ? e.target.value : c) : [...r]); onChange({ ...block, rows: nr }) }}
                    className="w-full bg-transparent text-neutral-600 focus:outline-none focus:text-neutral-900" />
                </td>
              ))}
              <td className="px-1"><button onClick={() => onChange({ ...block, rows: block.rows.filter((_, i) => i !== ri) })} className="opacity-0 group-hover:opacity-100 text-[0.65rem] text-red-400 hover:text-red-600">&times;</button></td>
            </tr>
          ))}
        </tbody>
      </table>
      <button onClick={() => onChange({ ...block, rows: [...block.rows, block.header.map(() => '')] })}
        className="w-full text-center text-[0.7rem] text-neutral-400 hover:text-neutral-600 hover:bg-neutral-50 py-1.5 border-t border-neutral-100">+ 添加行</button>
    </div>
  )
}

// ── Editable List ──
function EditableList({ block, onChange }: { block: Block & { type: 'list' }; onChange: (b: Block) => void }) {
  return (
    <div className="mb-4">
      {block.items.map((item, idx) => (
        <div key={idx} className="flex items-start gap-2 mb-1 group">
          <span className="text-neutral-400 font-medium text-[0.92rem] leading-[1.9] shrink-0 mt-px">{block.ordered ? `${idx + 1}.` : '•'}</span>
          <input value={item} onChange={e => { const ni = [...block.items]; ni[idx] = e.target.value; onChange({ ...block, items: ni }) }}
            className="flex-1 bg-transparent text-[0.92rem] leading-[1.9] text-neutral-700 focus:outline-none focus:text-neutral-900" />
          <button onClick={() => onChange({ ...block, items: block.items.filter((_, i) => i !== idx) })} className="opacity-0 group-hover:opacity-100 text-[0.65rem] text-red-400 hover:text-red-600 shrink-0 mt-1">&times;</button>
        </div>
      ))}
      <button onClick={() => onChange({ ...block, items: [...block.items, ''] })} className="text-[0.7rem] text-neutral-400 hover:text-neutral-600 ml-5 mt-1">+ 添加项</button>
    </div>
  )
}

// ── Editable Image ──
function EditableImage({ block, onChange, onDelete }: {
  block: Block & { type: 'image' }; onChange: (b: Block) => void; onDelete: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [showMenu, setShowMenu] = useState(false)
  return (
    <figure className="my-10 relative group" onMouseEnter={() => setShowMenu(true)} onMouseLeave={() => setShowMenu(false)}>
      <img src={block.src.startsWith('/showroom/') ? block.src : block.src.startsWith('/') ? `/showroom${block.src}` : block.src} alt={block.alt || '截图'}
        className="w-full max-w-full h-auto rounded-lg border border-neutral-200 shadow-sm" loading="lazy" />
      {showMenu && (
        <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={() => setEditing(!editing)} className="px-2 py-1 bg-white border border-neutral-200 rounded shadow-sm hover:bg-neutral-50"><Pencil size={14} strokeWidth={1.5} className="text-neutral-600" /></button>
          <button onClick={onDelete} className="px-2 py-1 bg-white border border-red-200 rounded shadow-sm text-red-500 hover:bg-red-50"><Trash2 size={14} strokeWidth={1.5} /></button>
        </div>
      )}
      {editing ? (
        <div className="flex gap-2 mt-2">
          <input value={block.alt} onChange={e => onChange({ ...block, alt: e.target.value })} onBlur={() => setEditing(false)}
            className="flex-1 px-2 py-0.5 border border-neutral-300 rounded text-[0.75rem] focus:outline-none focus:border-neutral-900" placeholder="图片说明" />
          <input value={block.src} onChange={e => onChange({ ...block, src: e.target.value })} onBlur={() => setEditing(false)}
            className="flex-1 px-2 py-0.5 border border-neutral-300 rounded text-[0.75rem] focus:outline-none focus:border-neutral-900" placeholder="图片URL" />
        </div>
      ) : (
        <figcaption className="text-[0.78rem] text-neutral-400 text-center mt-3">{block.alt || '操作截图'}</figcaption>
      )}
    </figure>
  )
}

// ── Drag handle ──
function DragHandle({ onDragStart }: { onDragStart: (e: React.DragEvent) => void }) {
  return (
    <div draggable onDragStart={onDragStart}
      className="absolute -left-6 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 cursor-grab active:cursor-grabbing transition-opacity select-none text-neutral-300 hover:text-neutral-500 text-[0.8rem]">
      ⋮⋮
    </div>
  )
}

// ══════ Main Editor ══════
export function EditableMarkdown({ content, onChange }: { content: string; onChange: (md: string) => void }) {
  const blocks = parseBlocks(content)

  // ── Undo/Redo ──
  const [history, setHistory] = useState<string[]>([content])
  const [historyIdx, setHistoryIdx] = useState(0)
  const pushHistory = useCallback((md: string) => {
    setHistory(prev => { const h = prev.slice(0, historyIdx + 1); h.push(md); return h.slice(-50) })
    setHistoryIdx(prev => Math.min(prev + 1, 49))
  }, [historyIdx])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault()
        setHistoryIdx(prev => { const ni = Math.max(0, prev - 1); onChange(history[ni]); return ni })
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault()
        setHistoryIdx(prev => { const ni = Math.min(history.length - 1, prev + 1); onChange(history[ni]); return ni })
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [history, historyIdx, onChange])

  function updateBlocks(newBlocks: Block[]) {
    const md = blocksToMarkdown(newBlocks)
    pushHistory(md)
    onChange(md)
  }

  function updateBlock(idx: number, newBlock: Block) {
    const nb = [...blocks]; nb[idx] = newBlock; updateBlocks(nb)
  }

  function addBlock(idx: number) {
    const nb = [...blocks]; nb.splice(idx + 1, 0, { type: 'blank' }, { type: 'paragraph', text: '' }); updateBlocks(nb)
  }

  function deleteBlock(idx: number) {
    updateBlocks(blocks.filter((_, i) => i !== idx))
  }

  function convertParagraph(idx: number, to: string) {
    const block = blocks[idx]
    if (block.type !== 'paragraph') return
    const text = block.text
    const nb = [...blocks]
    if (to === 'heading') {
      const m = text.match(/^(#{1,6})\s+(.+)/)
      nb[idx] = { type: 'heading', level: m ? m[1].length : 2, text: m ? m[2] : text.replace(/^#+\s*/, '') }
    } else if (to === 'list') {
      nb[idx] = { type: 'list', items: [text.replace(/^[-*]\s*/, '')], ordered: false }
    } else if (to === 'orderedList') {
      nb[idx] = { type: 'list', items: [text.replace(/^\d+[.)]\s*/, '')], ordered: true }
    }
    updateBlocks(nb)
  }

  function moveBlock(from: number, to: number) {
    const nb = [...blocks]
    const [item] = nb.splice(from, 1)
    nb.splice(to, 0, item)
    updateBlocks(nb)
  }

  return (
    <div className="space-y-1">
      {blocks.map((block, idx) => {
        const wrapper = (children: React.ReactNode) => (
          <div key={idx} className="group relative"
            draggable
            onDragStart={e => { e.dataTransfer.setData('text/plain', String(idx)); (e.currentTarget as HTMLElement).style.opacity = '0.4' }}
            onDragEnd={e => { (e.currentTarget as HTMLElement).style.opacity = '1' }}
            onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'move' }}
            onDrop={e => { e.preventDefault(); const from = parseInt(e.dataTransfer.getData('text/plain')); if (!isNaN(from) && from !== idx) moveBlock(from, idx) }}>
            <DragHandle onDragStart={e => { e.dataTransfer.setData('text/plain', String(idx)); e.stopPropagation() }} />
            {children}
          </div>
        )
        switch (block.type) {
          case 'heading':
            return wrapper(<EditableHeading block={block} onChange={b => updateBlock(idx, b)} />)
          case 'paragraph':
            return wrapper(
              <div className="relative">
                <EditableParagraph block={block} onChange={b => updateBlock(idx, b)} onConvert={to => convertParagraph(idx, to)} />
                <button onClick={() => addBlock(idx)}
                  className="absolute -bottom-1 left-0 opacity-0 group-hover:opacity-100 text-[0.6rem] text-neutral-300 hover:text-neutral-500 transition-opacity">+ 段落</button>
              </div>
            )
          case 'table':
            return wrapper(<EditableTable block={block} onChange={b => updateBlock(idx, b)} />)
          case 'list':
            return wrapper(<EditableList block={block} onChange={b => updateBlock(idx, b)} />)
          case 'image':
            return wrapper(<EditableImage block={block} onChange={b => updateBlock(idx, b)} onDelete={() => deleteBlock(idx)} />)
          case 'blank':
            return wrapper(
              <div className="relative h-4">
                <button onClick={() => addBlock(idx)}
                  className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 text-[0.6rem] text-neutral-300 hover:text-neutral-500 transition-opacity">+ 添加内容</button>
              </div>
            )
          case 'code':
            return wrapper(
              <div className="my-4 rounded-lg bg-neutral-100 overflow-hidden">
                <div className="flex items-center justify-between px-4 py-1.5 bg-neutral-200/50">
                  <span className="text-[0.65rem] text-neutral-500 uppercase">{block.lang || 'code'}</span>
                  <button onClick={() => deleteBlock(idx)} className="text-[0.65rem] text-red-400 hover:text-red-600">删除</button>
                </div>
                <textarea value={block.code} onChange={e => updateBlock(idx, { ...block, code: e.target.value })}
                  rows={Math.max(3, block.code.split('\n').length)}
                  className="w-full px-4 py-3 bg-transparent text-[0.82rem] font-mono text-neutral-700 focus:outline-none resize-y" />
              </div>
            )
          case 'hr': return wrapper(<hr className="my-6 border-neutral-200" />)
        }
      })}
      {blocks.length === 0 && (
        <button onClick={() => addBlock(-1)}
          className="w-full py-8 text-[0.78rem] text-neutral-300 hover:text-neutral-500 border-2 border-dashed border-neutral-200 rounded-lg transition-colors">点击添加内容</button>
      )}
    </div>
  )
}
