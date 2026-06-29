import { AuthGuard } from '@/components/internal/auth-guard'
import { PermProvider } from '@/components/internal/Perm'
import { InternalLayoutClient } from '@/components/internal/internal-layout-client'

export default function InternalLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <PermProvider>
        <InternalLayoutClient>{children}</InternalLayoutClient>
      </PermProvider>
    </AuthGuard>
  )
}
