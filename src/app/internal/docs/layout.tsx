import type { Metadata } from 'next'

export const metadata: Metadata = { title: '文档阅读', robots: 'noindex, nofollow' }

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
