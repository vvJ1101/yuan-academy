import type { Metadata } from 'next'
import './globals.css'
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  metadataBase: new URL('https://academy.yuanshowroom.cn'),
  title: '深圳（香港）时胜集团 — 内部知识库',
  description: '深圳（香港）时胜集团内部知识管理与培训平台。DOCX智能解析、AI问答、权限管理。',
  keywords: ['深圳时胜集团', '时胜集团', '员工培训', '知识库', 'AI问答', '文档管理'],
  robots: { index: false, follow: false },
  icons: { icon: '/favicon.png', apple: '/apple-icon.png' },
  openGraph: {
    title: '深圳（香港）时胜集团 — 内部知识库',
    description: '时胜集团内部知识管理与培训平台。制度查询、流程指南、订货政策、品牌资料一站式获取。',
    url: 'https://academy.yuanshowroom.cn',
    siteName: '深圳（香港）时胜集团',
    type: 'website',
    locale: 'zh_CN',
    images: [{ url: '/og-image.png', width: 600, height: 600 }],
  },
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
              name: '时胜集团内部知识库',
              description: '深圳（香港）时胜集团内部知识库系统',
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
