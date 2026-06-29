import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <div className="text-center px-6">
        <p className="text-[5rem] font-light text-neutral-200 leading-none mb-4">404</p>
        <h1 className="text-[1.2rem] font-semibold text-neutral-800 mb-2">页面未找到</h1>
        <p className="text-[0.85rem] text-neutral-500 mb-6">您访问的页面不存在或已被移除</p>
        <Link
          href="/showroom"
          className="inline-block px-5 py-2.5 bg-[#2563EB] text-white text-[0.82rem] font-medium rounded-lg hover:bg-blue-600 no-underline"
        >
          返回首页
        </Link>
      </div>
    </div>
  )
}
