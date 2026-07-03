'use client'

import { cn } from '@/lib/utils'
import type { PolicyTier } from '@/types/policy-layout'

interface TierTableProps {
  tiers: PolicyTier[]
  className?: string
}

export function TierTable({ tiers, className }: TierTableProps) {
  if (tiers.length === 0) {
    return <p className="text-[0.82rem] text-neutral-400 py-2">暂无阶梯数据</p>
  }

  const hasNote = tiers.some(t => t.note)

  return (
    <div className={cn('w-full', className)}>
      {/* ── PC 端：标准 Table ── */}
      <div className="hidden sm:block overflow-x-auto">
        <table className="w-full text-[0.82rem] border-collapse">
          <thead>
            <tr className="border-b border-neutral-200 bg-neutral-50">
              <th className="text-left px-3 py-2.5 text-[0.72rem] font-semibold text-neutral-500">
                订货门槛
              </th>
              <th className="text-left px-3 py-2.5 text-[0.72rem] font-semibold text-neutral-500">
                折扣
              </th>
              {hasNote && (
                <th className="text-left px-3 py-2.5 text-[0.72rem] font-semibold text-neutral-500">
                  备注
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {tiers.map((tier, i) => (
              <tr
                key={i}
                className="border-b border-neutral-100 hover:bg-neutral-50/50 transition-colors"
              >
                <td className="px-3 py-2.5 text-neutral-900 font-medium">{tier.threshold}</td>
                <td className="px-3 py-2.5 text-[#2563EB] font-semibold">{tier.price}</td>
                {hasNote && (
                  <td className="px-3 py-2.5 text-neutral-500 text-[0.78rem]">
                    {tier.note || '—'}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── Mobile 端：竖排卡片 ── */}
      <div className="sm:hidden space-y-2">
        {tiers.map((tier, i) => (
          <div
            key={i}
            className="bg-white border border-neutral-200 rounded-lg p-3 space-y-1.5"
          >
            <div className="flex items-center justify-between">
              <span className="text-[0.7rem] text-neutral-400">门槛</span>
              <span className="text-[0.85rem] text-neutral-900 font-semibold">
                {tier.threshold}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[0.7rem] text-neutral-400">折扣</span>
              <span className="text-[0.85rem] text-[#2563EB] font-bold">{tier.price}</span>
            </div>
            {tier.note && (
              <div className="flex items-center justify-between">
                <span className="text-[0.7rem] text-neutral-400">备注</span>
                <span className="text-[0.78rem] text-neutral-600">{tier.note}</span>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
