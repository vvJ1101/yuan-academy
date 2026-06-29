'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import { InternalSidebar } from '@/components/internal/internal-sidebar'
import { Search, FolderPlus, Bell, ChevronDown, LogOut, User, Users, Settings, Shield, X } from 'lucide-react'

export function InternalLayoutClient({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [user, setUser] = useState<{ name: string; role: string; companyName?: string; departmentName?: string } | null>(null)
  const [search, setSearch] = useState('')
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)
  const [permModalOpen, setPermModalOpen] = useState(false)
  const [permData, setPermData] = useState<{ accessibleRange: string; editableRange: string } | null>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetch('/api/auth/me')
      .then(r => r.json())
      .then(d => { if (d?.name) setUser(d) })
      .catch(() => {})
    fetch('/api/workspace/activity')
      .then(r => r.json())
      .then(d => { if (d?.accessibleRange !== undefined) setPermData(d) })
      .catch(() => {})
  }, [])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    const q = search.trim()
    if (!q) return
    if (q.includes('?') || q.includes('？') || q.includes('如何') || q.includes('怎么')) {
      router.push(`/internal/ai?q=${encodeURIComponent(q)}`)
    } else {
      router.push(`/internal/documents?search=${encodeURIComponent(q)}`)
    }
  }

  const roleLabel = user?.role === 'super_admin' ? '超级管理员' : user?.role === 'dept_admin' ? '部门管理员' : '员工'

  return (
    <div className="h-screen flex flex-col bg-[#F8F9FA] overflow-hidden">
      {/* ═══ Top Navbar 64px ═══ */}
      <header className="h-16 shrink-0 bg-white border-b border-neutral-200 flex items-center pl-0 pr-4 z-30" style={{ display: 'grid', gridTemplateColumns: '260px 1fr auto', alignItems: 'center' }}>
        {/* ── Left: Logo (centered in sidebar width) ── */}
        <div className="flex items-center justify-center gap-2">
          <button onClick={() => setSidebarOpen(true)} className="lg:hidden shrink-0 p-1.5 -ml-1 text-neutral-500 hover:bg-neutral-100 rounded-lg transition-colors" aria-label="打开菜单">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="4" y1="6" x2="20" y2="6"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="18" x2="20" y2="18"/></svg>
          </button>
          <Link href="/internal/dashboard" className="flex items-center shrink-0 no-underline"><img src="/images/logo.jpg" alt="YUAN SHOWROOM" className="h-10 w-auto max-w-[160px] object-contain py-1" /></Link>
        </div>

        {/* ── Center: Search + Button ── */}
        <form onSubmit={handleSearch} className="flex items-center gap-2 justify-self-center">
          <div className="w-[360px] relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" size={16} strokeWidth={1.5} />
            <input ref={searchRef} type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="搜索文件、制度、流程或直接提问..." className="w-full pl-10 pr-4 py-2 text-[0.82rem] bg-[#F8F9FA] border border-neutral-200 rounded-lg focus:outline-none focus:border-[#2563EB] focus:bg-white focus:ring-2 focus:ring-[#2563EB]/15 transition-all placeholder:text-neutral-400" />
          </div>
          <button type="submit" className="flex items-center gap-1.5 px-4 py-2 text-[0.78rem] font-medium text-white bg-[#2563EB] rounded-lg hover:bg-blue-600 shrink-0"><Search size={14} strokeWidth={1.5} />搜索</button>
        </form>

        {/* ── Right: New + Bell + User ── */}
        <div className="flex items-center gap-1 justify-self-end">
          <button onClick={() => router.push('/internal/documents')} className="flex items-center gap-1.5 px-3 py-1.5 text-[0.78rem] text-neutral-600 border border-neutral-200 rounded-lg hover:bg-neutral-50 transition-colors"><FolderPlus size={14} strokeWidth={1.5} /><span className="hidden sm:inline">新建</span></button>
          <div className="w-px h-6 bg-neutral-200 mx-1" />
          {/* Notification */}
          <div className="relative">
          <button
            onClick={() => setNotifOpen(!notifOpen)}
            className="w-8 h-8 flex items-center justify-center text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 rounded-lg transition-colors"
          >
            <Bell size={17} strokeWidth={1.5} />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-red-500 ring-2 ring-white" />
          </button>
          {notifOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setNotifOpen(false)} />
              <div className="absolute right-0 top-full mt-2 w-72 bg-white rounded-xl shadow-lg border border-neutral-200 py-1 z-20">
                <div className="px-4 py-2.5 border-b border-neutral-100">
                  <p className="text-[0.78rem] font-semibold text-[#111]">通知</p>
                </div>
                <div className="py-6 text-center">
                  <Bell size={24} strokeWidth={1} className="text-neutral-300 mx-auto mb-2" />
                  <p className="text-[0.78rem] text-neutral-400">暂无新通知</p>
                </div>
              </div>
            </>
          )}
        </div>

        {/* User */}
        {user && (
          <div className="relative">
            <button
              onClick={() => setUserMenuOpen(!userMenuOpen)}
              className="flex items-center gap-2 hover:bg-neutral-100 rounded-lg pl-1 pr-2 py-1 transition-colors"
            >
              <div className="w-7 h-7 rounded-full bg-[#2563EB] flex items-center justify-center text-[0.65rem] font-medium text-white ring-2 ring-white">
                {user.name?.charAt(0) || 'U'}
              </div>
              <span className="text-[0.78rem] text-neutral-600 font-medium hidden lg:block">{user.name}</span>
              <ChevronDown size={12} strokeWidth={2} className={`text-neutral-400 transition-transform ${userMenuOpen ? 'rotate-180' : ''}`} />
            </button>
            {userMenuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setUserMenuOpen(false)} />
                <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-xl shadow-lg border border-neutral-200 py-1 z-20">
                  {/* User info */}
                  <div className="px-4 py-3 border-b border-neutral-100">
                    <p className="text-[0.82rem] font-semibold text-[#111]">{user.name}</p>
                    <p className="text-[0.68rem] text-neutral-400 mt-0.5">{roleLabel} · {user.departmentName || user.companyName || '—'}</p>
                  </div>
                  {/* Menu items */}
                  <div className="py-1">
                    <button className="w-full flex items-center gap-2.5 px-4 py-2 text-[0.78rem] text-neutral-600 hover:bg-neutral-50 transition-colors">
                      <User size={14} strokeWidth={1.5} className="text-neutral-400" />
                      个人信息
                    </button>
                    <button
                      onClick={() => { setUserMenuOpen(false); setPermModalOpen(true) }}
                      className="w-full flex items-center gap-2.5 px-4 py-2 text-[0.78rem] text-neutral-600 hover:bg-neutral-50 transition-colors"
                    >
                      <Shield size={14} strokeWidth={1.5} className="text-neutral-400" />
                      我的权限
                    </button>
                    {user.role === 'super_admin' && (
                      <>
                        <Link
                          href="/internal/admin/users"
                          onClick={() => setUserMenuOpen(false)}
                          className="w-full flex items-center gap-2.5 px-4 py-2 text-[0.78rem] text-neutral-600 hover:bg-neutral-50 transition-colors no-underline"
                        >
                          <Users size={14} strokeWidth={1.5} className="text-neutral-400" />
                          用户管理
                        </Link>
                        <Link
                          href="/internal/admin"
                          onClick={() => setUserMenuOpen(false)}
                          className="w-full flex items-center gap-2.5 px-4 py-2 text-[0.78rem] text-neutral-600 hover:bg-neutral-50 transition-colors no-underline"
                        >
                          <Settings size={14} strokeWidth={1.5} className="text-neutral-400" />
                          管理中心
                        </Link>
                      </>
                    )}
                  </div>
                  <div className="border-t border-neutral-100 py-1">
                    <Link
                      href="/api/auth/logout"
                      onClick={() => setUserMenuOpen(false)}
                      className="w-full flex items-center gap-2.5 px-4 py-2 text-[0.78rem] text-red-500 hover:bg-red-50 transition-colors no-underline"
                    >
                      <LogOut size={14} strokeWidth={1.5} />
                      退出登录
                    </Link>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
        </div>
      </header>

      {/* ═══ Body (Sidebar + Content) ═══ */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Mobile backdrop */}
        {sidebarOpen && (
          <div
            className="lg:hidden fixed inset-0 z-40 bg-black/40"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Sidebar */}
        <div className={`
          fixed lg:static inset-y-0 left-0 z-50 w-[260px] shrink-0
          transition-transform duration-200 ease-out
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}>
          <InternalSidebar onClose={() => setSidebarOpen(false)} />
        </div>

        {/* Main Content */}
        <main className={pathname === '/internal/documents' ? 'flex-1 flex flex-col overflow-hidden' : 'flex-1 overflow-y-auto'}>
          {children}
        </main>
      </div>

      {/* ═══ Permission Modal ═══ */}
      {permModalOpen && user && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setPermModalOpen(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="flex items-center gap-2 text-[0.95rem] font-semibold text-neutral-800">
                <Shield size={18} strokeWidth={1.5} className="text-neutral-500" />
                我的权限
              </h2>
              <button onClick={() => setPermModalOpen(false)} className="p-1 text-neutral-400 hover:text-neutral-700 rounded-lg hover:bg-neutral-100">
                <X size={16} strokeWidth={1.5} />
              </button>
            </div>
            <div className="space-y-3 text-[0.85rem]">
              <div className="flex justify-between py-2 border-b border-neutral-100">
                <span className="text-neutral-500">公司</span>
                <span className="font-medium text-neutral-800">{user.companyName || '—'}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-neutral-100">
                <span className="text-neutral-500">部门</span>
                <span className="font-medium text-neutral-800">{user.departmentName || '未分配'}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-neutral-100">
                <span className="text-neutral-500">角色</span>
                <span className={`font-medium ${user.role === 'super_admin' ? 'text-purple-700' : user.role === 'dept_admin' ? 'text-blue-700' : 'text-neutral-700'}`}>
                  {user.role === 'super_admin' ? '超级管理员' : user.role === 'dept_admin' ? '部门管理员' : '员工'}
                </span>
              </div>
              {permData && (
                <>
                  <div className="py-2 border-b border-neutral-100">
                    <p className="text-neutral-500 mb-1">可查看范围</p>
                    <p className="text-neutral-700">{permData.accessibleRange || '—'}</p>
                  </div>
                  <div className="py-2">
                    <p className="text-neutral-500 mb-1">可编辑范围</p>
                    <p className="text-neutral-700">{permData.editableRange || '—'}</p>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
