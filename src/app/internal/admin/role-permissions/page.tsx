'use client'

import dynamic from 'next/dynamic'

const RoleManagementPage = dynamic(
  () => import('@/components/internal/permissions-management').then(m => ({ default: m.default })),
  { ssr: false, loading: () => <div style={{ padding: 40, textAlign: 'center', color: '#999' }}>加载中...</div> }
)

export default function RolePermissionsPage() {
  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '24px 16px' }}>
      <RoleManagementPage />
    </div>
  )
}
