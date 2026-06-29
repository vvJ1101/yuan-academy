'use client'

import { useState, useRef } from 'react'
import { Folder, ChevronDown, ChevronRight, Loader2 } from 'lucide-react'

interface FolderItem { id: string; name: string; slug: string; parentId: string | null; companyId: string | null; _count: { documents: number; children: number } }

interface TreeFolderProps {
  folder: FolderItem
  depth: number
  folders: FolderItem[]
  expanded: Set<string>
  activeId: string
  docCounts: Map<string, number>
  onNavigate: (id: string) => void
  onToggle: (id: string) => void
  onSetActive: (id: string) => void
  onCtx: (e: React.MouseEvent, f: any) => void
  // ── Inline create ──
  inlineCreate: { parentId: string } | null
  inlineName: string
  inlineSaving: boolean
  onInlineNameChange: (v: string) => void
  onInlineSave: () => void
  onInlineKeyDown: (e: React.KeyboardEvent) => void
  // ── Inline rename ──
  renamingId: string | null
  renameValue: string
  renameSaving: boolean
  onRenameStart: (id: string, name: string) => void
  onRenameChange: (v: string) => void
  onRenameSave: () => void
  onRenameKeyDown: (e: React.KeyboardEvent) => void
}

export function TreeFolder({
  folder, depth, folders, expanded, activeId, docCounts,
  onNavigate, onToggle, onSetActive, onCtx,
  inlineCreate, inlineName, inlineSaving, onInlineNameChange, onInlineSave, onInlineKeyDown,
  renamingId, renameValue, renameSaving, onRenameStart, onRenameChange, onRenameSave, onRenameKeyDown,
}: TreeFolderProps) {
  const kids = folders.filter(x => x.parentId === folder.id)
  const hasKids = kids.length > 0
  const isOpen = expanded.has(folder.id)
  const isActive = activeId === folder.id
  const isCreatingHere = inlineCreate?.parentId === folder.id
  const isRenaming = renamingId === folder.id
  const renameRef = useRef<HTMLInputElement>(null)

  // Focus rename input when it appears
  if (isRenaming && renameRef.current) {
    // only select on first render
  }

  return (
    <div>
      {/* ── Folder row ── */}
      {isRenaming ? (
        <div className="flex items-center gap-1.5 py-0.5 px-2 ml-4">
          {hasKids ? (isOpen ? <ChevronDown size={10} strokeWidth={2.5} className="shrink-0" /> : <ChevronRight size={10} strokeWidth={2.5} className="shrink-0" />) : <span className="w-[10px] shrink-0" />}
          <Folder size={13} strokeWidth={1.5} className="text-[#60A5FA]" />
          <input
            ref={renameRef}
            autoFocus
            value={renameValue}
            onChange={e => onRenameChange(e.target.value)}
            onKeyDown={onRenameKeyDown}
            onBlur={onRenameSave}
            onFocus={e => e.target.select()}
            disabled={renameSaving}
            className="flex-1 text-[0.78rem] px-1.5 py-0.5 border border-[#2563EB] rounded bg-white focus:outline-none focus:ring-1 focus:ring-[#2563EB]/30"
          />
          {renameSaving && <Loader2 size={12} strokeWidth={2} className="animate-spin text-neutral-400 shrink-0" />}
        </div>
      ) : (
        <div
          onClick={() => { onSetActive(folder.id); onNavigate(folder.id); if (hasKids) onToggle(folder.id) }}
          onContextMenu={e => onCtx(e, { id: folder.id, name: folder.name, isSpace: !folder.parentId })}
          className={'flex items-center gap-1.5 py-1.5 px-2 ml-4 text-[0.78rem] rounded-md cursor-pointer ' + (isActive ? 'bg-[#EBF5FF] text-[#2563EB] font-medium' : 'text-neutral-600 hover:bg-neutral-50')}
        >
          {hasKids ? (isOpen ? <ChevronDown size={10} strokeWidth={2.5} className="shrink-0" /> : <ChevronRight size={10} strokeWidth={2.5} className="shrink-0" />) : <span className="w-[10px] shrink-0" />}
          <Folder size={13} strokeWidth={1.5} className={isActive ? 'text-[#2563EB]' : 'text-[#60A5FA]'} />
          <span className="flex-1 truncate">{folder.name}</span>
          {(docCounts.get(folder.id) || 0) > 0 && <span className="text-[0.62rem] ml-auto text-neutral-400">{docCounts.get(folder.id)}</span>}
        </div>
      )}

      {/* ── Inline create input ── */}
      {isCreatingHere && (
        <div className="ml-8 py-0.5">
          <div className="flex items-center gap-1.5 px-2 py-1">
            <span className="w-[10px] shrink-0" />
            <Folder size={13} strokeWidth={1.5} className="text-[#60A5FA] opacity-60" />
            <input
              autoFocus
              value={inlineName}
              onChange={e => onInlineNameChange(e.target.value)}
              onKeyDown={onInlineKeyDown}
              onBlur={onInlineSave}
              disabled={inlineSaving}
              className="flex-1 text-[0.78rem] px-1.5 py-0.5 border border-[#2563EB] rounded bg-white focus:outline-none focus:ring-1 focus:ring-[#2563EB]/30"
              onFocus={e => e.target.select()}
            />
            {inlineSaving && <Loader2 size={12} strokeWidth={2} className="animate-spin text-neutral-400 shrink-0" />}
          </div>
        </div>
      )}

      {/* ── Children ── */}
      {isOpen && hasKids && kids.map(c => (
        <TreeFolder
          key={c.id} folder={c} depth={depth + 1} folders={folders}
          expanded={expanded} activeId={activeId} docCounts={docCounts}
          onNavigate={onNavigate} onToggle={onToggle} onSetActive={onSetActive} onCtx={onCtx}
          inlineCreate={inlineCreate} inlineName={inlineName} inlineSaving={inlineSaving}
          onInlineNameChange={onInlineNameChange} onInlineSave={onInlineSave} onInlineKeyDown={onInlineKeyDown}
          renamingId={renamingId} renameValue={renameValue} renameSaving={renameSaving}
          onRenameStart={onRenameStart} onRenameChange={onRenameChange}
          onRenameSave={onRenameSave} onRenameKeyDown={onRenameKeyDown}
        />
      ))}
    </div>
  )
}
