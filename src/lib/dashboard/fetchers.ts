// Dashboard data fetching helpers
// Real APIs exist at /api/workspace/tasks, /workspace/activity, /ai/recommend

export interface TaskDoc {
  id: string; title: string; slug: string
  audienceSlug: string; department?: string
}

export interface Task {
  type: string; priority: 'high' | 'medium' | 'low'
  title: string; reason: string
  doc: TaskDoc; action: string
  deadline?: string | null; progress?: number
  actionLabel?: string; documentId: string
}

export interface TaskResponse { tasks: Task[]; summary: { total: number; high: number; medium: number; low: number; unreadCount: number } }

export interface ActivityItem {
  id: string; title: string; slug: string; category?: string
  updatedAt: string; action?: string
  department?: string; audienceSlug?: string
  ownerDept?: { name: string; slug?: string }
  audiences?: { department?: { slug?: string } }[]
}

export interface ActivityResponse {
  stats: { totalDocs: number; aiParsed: number; recentlyViewed: number; toLearn: number }
  recentDocs: ActivityItem[]; recentUpdates: ActivityItem[]
  recentViews: ActivityItem[]; toLearnDocs: ActivityItem[]
  aiParsedDocs: ActivityItem[]
}

export interface RecommendItem {
  id: string; title: string; slug: string; category?: string
  reason?: string; audienceSlug?: string
  ownerDept?: { name: string }
  audiences?: { department?: { slug?: string } }[]
}

export interface RecommendResponse {
  popular: RecommendItem[]; forYou: RecommendItem[]
  riskAlerts: RecommendItem[]
}

// ── Fetch wrappers ──

export async function fetchTasks(): Promise<TaskResponse> {
  const res = await fetch('/api/workspace/tasks')
  if (!res.ok) throw new Error('Failed to fetch tasks')
  const data = await res.json()
  // Map API response to Task shape
  const tasks: Task[] = (data.tasks || []).map((t: any) => ({
    ...t,
    documentId: t.doc?.id || '',
    deadline: t.deadline || null,
    progress: t.progress ?? (t.priority === 'high' ? 0 : t.priority === 'medium' ? 50 : 100),
    actionLabel: t.actionLabel || (t.action === 'learn' ? '开始学习' : t.action === 'view' ? '立即查看' : '去处理'),
  }))
  return { tasks, summary: data.summary || { total: tasks.length, high: 0, medium: 0, low: 0, unreadCount: 0 } }
}

export async function fetchActivity(): Promise<ActivityResponse> {
  const res = await fetch('/api/workspace/activity')
  if (!res.ok) throw new Error('Failed to fetch activity')
  return res.json()
}

export async function fetchRecommendations(): Promise<RecommendResponse> {
  const res = await fetch('/api/ai/recommend')
  if (!res.ok) throw new Error('Failed to fetch recommendations')
  return res.json()
}
