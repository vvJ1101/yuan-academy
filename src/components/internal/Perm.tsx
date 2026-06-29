'use client'

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

interface PermContextType {
  hasPerm: (perm: string) => boolean
  loading: boolean
}

const PermContext = createContext<PermContextType>({ hasPerm: () => true, loading: false })

export function PermProvider({ children }: { children: ReactNode }) {
  const [perms, setPerms] = useState<string[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/user/permissions')
      .then(r => r.json())
      .then(d => {
        if (d.code === 0) setPerms(d.data.permissions || [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  const hasPerm = (perm: string) => {
    if (perms.includes('*')) return true
    return perms.includes(perm)
  }

  return (
    <PermContext.Provider value={{ hasPerm, loading }}>
      {children}
    </PermContext.Provider>
  )
}

export function usePerm() {
  return useContext(PermContext)
}

export function Perm({ code, children, fallback = null }: { code: string; children: ReactNode; fallback?: ReactNode }) {
  const { hasPerm, loading } = usePerm()
  if (loading) return <>{children}</>
  return hasPerm(code) ? <>{children}</> : <>{fallback}</>
}
