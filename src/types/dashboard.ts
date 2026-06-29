// ── AI Search Result (used by SearchBar, DashboardHeader) ──
export interface ASRDoc {
  id: string
  title: string
  slug: string
  audienceSlug?: string
  snippet?: string
  category: string
  department?: string
}

export interface ASR {
  summary: string
  documents: ASRDoc[]
}

// ── Dashboard stats (used by StatsCards, StatsFooter, QuickAccess) ──
export interface StatsData {
  totalDocs: number
  aiParsed: number
  recentlyViewed?: number
  toLearn?: number
  totalSpaces?: number
  totalDepts?: number
}

// ── User info from /api/auth/me (used by DashboardPage) ──
export interface UserInfo {
  id: string
  name: string
  role: string
  companyId: string | null
  companyName?: string
  departmentId: string | null
  departmentName?: string
  allowedDeptIds?: string[]
  companies?: { id: string; name: string; slug: string; role: string }[]
}
