import type { StatsData } from '@/types/dashboard'

interface Props { stats: StatsData }

export function StatsCards({ stats }: Props) {
  return (
    <p className="text-[0.72rem] font-light text-neutral-400 pt-6 border-t border-neutral-200">
      知识库共 <span className="font-medium text-neutral-600">{stats.totalDocs}</span> 篇文档，
      已解析 <span className="font-medium text-neutral-600">{stats.aiParsed}</span> 篇，
      {stats.totalSpaces ? <>{' '}<span className="font-medium text-neutral-600">{stats.totalSpaces}</span> 个知识空间</> : null}
      {stats.totalDepts ? <>{' '}覆盖 <span className="font-medium text-neutral-600">{stats.totalDepts}</span> 个部门</> : null}
    </p>
  )
}
