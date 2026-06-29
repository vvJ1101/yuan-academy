import Link from 'next/link'

export default function InternalNotFound() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="text-center px-6">
        <p className="text-[4rem] font-light text-neutral-200 leading-none mb-4">404</p>
        <h1 className="text-[1.1rem] font-semibold text-neutral-800 mb-2">页面未找到</h1>
        <p className="text-[0.82rem] text-neutral-500 mb-6">该内部页面不存在或您没有访问权限</p>
        <Link
          href="/internal/dashboard"
          className="inline-block px-5 py-2.5 bg-[#2563EB] text-white text-[0.82rem] font-medium rounded-lg hover:bg-blue-600 no-underline"
        >
          返回工作台
        </Link>
      </div>
    </div>
  )
}
