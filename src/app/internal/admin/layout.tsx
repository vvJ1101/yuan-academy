import { AuthGuard } from '@/components/internal/auth-guard'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <AuthGuard requireRole={['super_admin']}>{children}</AuthGuard>
}
