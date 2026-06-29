import type { Metadata } from 'next'
import './globals.css'
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  metadataBase: new URL('https://academy.yuanshowroom.cn'),
  title: 'YUAN Academy — 时胜集团内部培训知识库',
  description: '时胜集团员工培训与知识管理平台。DOCX智能解析、AI问答、权限管理、学习路径。',
  keywords: ['YUAN Academy', '时胜集团', '员工培训', '知识库', 'AI问答', '文档管理'],
  robots: { index: false, follow: false },
  icons: { icon: '/favicon.png', apple: '/apple-icon.png' },
  other: {
    'baidu-site-verification': 'codeva-0wAwq3lCfI',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" className="scroll-smooth">
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'WebApplication',
              name: 'YUAN Academy',
              description: '时胜集团内部员工培训知识库系统',
              url: 'https://academy.yuanshowroom.cn/',
              applicationCategory: 'EducationalApplication',
              operatingSystem: 'Web',
            }),
          }}
        />
      </head>
      <body className="bg-offwhite text-neutral-900 antialiased">{children}</body>
    </html>
  )
}
