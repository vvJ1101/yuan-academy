'use client'

import { TierTable } from './tier-table'
import { TagGroup } from './tag-group'
import type { PolicyTier, LayoutBlock } from '@/types/policy-layout'

interface PolicyModuleBlockProps {
  block: LayoutBlock
  className?: string
}

/** 根据 block.type 分发渲染 */
export function PolicyModuleBlock({ block, className }: PolicyModuleBlockProps) {
  switch (block.type) {
    case 'orderRule':
      return (
        <div
          className={`border-l-2 border-blue-200 pl-3 ${className || ''}`}
        >
          {block.title && (
            <span className="inline-block text-[0.6rem] font-medium bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded mb-1">
              {block.title}
            </span>
          )}
          <p className="text-[0.85rem] md:text-[0.88rem] text-neutral-800 whitespace-pre-line leading-relaxed">
            {typeof block.content === 'string' ? block.content : ''}
          </p>
        </div>
      )

    case 'tierTable':
      return (
        <div className={className}>
          {block.title && (
            <p className="text-[0.72rem] font-medium text-neutral-500 mb-2">{block.title}</p>
          )}
          <TierTable tiers={(block.content as PolicyTier[]) || []} />
        </div>
      )

    case 'notes':
      return (
        <div className={className}>
          {block.title && (
            <p className="text-[0.72rem] font-medium text-neutral-500 mb-1.5">{block.title}</p>
          )}
          <ul className="space-y-1">
            {(Array.isArray(block.content) ? block.content : []).map((note, i) => (
              <li
                key={i}
                className="text-[0.82rem] text-neutral-600 leading-relaxed flex items-start gap-2"
              >
                <span className="text-neutral-300 mt-1">·</span>
                <span>{typeof note === 'string' ? note : ''}</span>
              </li>
            ))}
          </ul>
        </div>
      )

    case 'tagGroup':
      return (
        <div className={className}>
          {block.title && (
            <p className="text-[0.72rem] font-medium text-neutral-500 mb-1.5">{block.title}</p>
          )}
          <TagGroup tags={Array.isArray(block.content) ? (block.content as string[]) : []} />
        </div>
      )

    case 'text':
    default:
      return (
        <div className={className}>
          {block.title && (
            <p className="text-[0.72rem] font-medium text-neutral-500 mb-1">{block.title}</p>
          )}
          <p className="text-[0.82rem] text-neutral-700 leading-relaxed whitespace-pre-line">
            {typeof block.content === 'string' ? block.content : ''}
          </p>
        </div>
      )
  }
}
