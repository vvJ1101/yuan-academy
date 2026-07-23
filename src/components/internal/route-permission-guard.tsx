'use client'

import { useEffect, useMemo, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

type RouteRule = {
  prefix: string
  permissions: string[]
}

const ROUTE_RULES: RouteRule[] = [
  { prefix: '/internal/dashboard', permissions: ['menu.dashboard'] },
  { prefix: '/internal/recent', permissions: ['menu.recent'] },
  { prefix: '/internal/favorites', permissions: ['menu.favorites'] },
  { prefix: '/internal/documents', permissions: ['menu.documents'] },
  { prefix: '/internal/sop', permissions: ['menu.sop'] },
  { prefix: '/internal/faq', permissions: ['menu.faq'] },
  { prefix: '/internal/admin/users', permissions: ['menu.admin.users'] },
  { prefix: '/internal/admin/org', permissions: ['menu.admin.org'] },
  { prefix: '/internal/admin/folders', permissions: ['menu.admin.folders'] },
  { prefix: '/internal/admin/role-permissions', permissions: ['menu.admin.roles', 'menu.admin.permissions'] },
  { prefix: '/internal/admin/analytics', permissions: ['menu.admin.analytics'] },
  { prefix: '/internal/admin/audit-log', permissions: ['menu.admin.audit', 'audit.view'] },
  { prefix: '/internal/admin/learning-paths', permissions: ['menu.admin.learningPaths'] },
  { prefix: '/internal/admin/settings', permissions: ['menu.admin.settings'] },
  { prefix: '/internal/admin', permissions: ['menu.admin'] },
  { prefix: '/internal/policy-upload', permissions: ['brandOrdering.upload', 'menu.policyUpload'] },
  { prefix: '/internal/policy', permissions: ['menu.brand.ordering', 'menu.policy', 'brandOrdering.view'] },
]

function can(permissions: string[], key: string) {
  return permissions.includes('*') || permissions.includes(key) || permissions.some(value => value.startsWith(`${key}.`))
}

function hasAnyPermission(permissions: string[], keys: string[]) {
  return keys.some(key => can(permissions, key))
}

function getRouteRule(pathname: string, searchType: string | null): RouteRule | null {
  if (pathname === '/internal/brand' || pathname.startsWith('/internal/brand/')) {
    if (searchType === 'ordering') return { prefix: '/internal/brand', permissions: ['menu.brand.ordering', 'brandOrdering.view'] }
    return { prefix: '/internal/brand', permissions: ['menu.brand.contact', 'brandContact.viewMarketFields', 'brandContact.viewFullFields'] }
  }

  return ROUTE_RULES.find(rule => pathname === rule.prefix || pathname.startsWith(`${rule.prefix}/`)) ?? null
}

export function RoutePermissionGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || ''
  const searchParams = useSearchParams()
  const router = useRouter()
  const [permissions, setPermissions] = useState<string[]>([])
  const [loading, setLoading] = useState(true)

  const routeRule = useMemo(() => getRouteRule(pathname, searchParams.get('type')), [pathname, searchParams])
  const allowed = !routeRule || hasAnyPermission(permissions, routeRule.permissions)

  useEffect(() => {
    fetch('/api/auth/me')
      .then(response => response.json())
      .then(data => {
        if (Array.isArray(data?.permissions)) setPermissions(data.permissions)
      })
      .catch((err: any) => console.warn('[SilentError]', err))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!loading && !allowed) router.replace('/internal/dashboard')
  }, [allowed, loading, router])

  if (loading) {
    return <div className="p-8 text-[0.85rem] text-neutral-400">正在检查页面权限...</div>
  }

  if (!allowed) {
    return <div className="p-8 text-[0.85rem] text-neutral-400">无权访问该页面，正在返回首页...</div>
  }

  return <>{children}</>
}
