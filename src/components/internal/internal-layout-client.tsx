'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import { InternalSidebar } from '@/components/internal/internal-sidebar'
 import { Search, FolderPlus, Bell, ChevronDown, LogOut, User, Users, Settings, Shield, X, KeyRound, Eye, EyeOff, Loader2, CheckCircle2 } from 'lucide-react'
import { PasswordCharacter } from '@/components/internal/password-characters'

export function InternalLayoutClient({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [user, setUser] = useState<{ name: string; role: string; companyName?: string; departmentName?: string } | null>(null)
  const [search, setSearch] = useState('')
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)
  const [permModalOpen, setPermModalOpen] = useState(false)
  const [permData, setPermData] = useState<{ accessibleRange: string; editableRange: string } | null>(null)
  const [changePwdOpen, setChangePwdOpen] = useState(false)
  const [pwdForm, setPwdForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' })
  const [pwdShow, setPwdShow] = useState({ current: false, new: false, confirm: false })
  const [pwdSaving, setPwdSaving] = useState(false)
 const [pwdMsg, setPwdMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [pwdFocus, setPwdFocus] = useState({ current: false, new: false, confirm: false })
  const [lastPwdChange, setLastPwdChange] = useState<string | null>(null)
  const [permissions, setPermissions] = useState<string[]>([])
  const pwdCurrentRef = useRef<HTMLInputElement>(null)
 const searchRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetch('/api/auth/me')
      .then(r => r.json())
      .then(d => {
        if (d?.name) setUser(d)
        if (d?.passwordChangedAt) setLastPwdChange(d.passwordChangedAt)
        if (Array.isArray(d?.permissions)) setPermissions(d.permissions)
      })
     .catch((err: any) => console.warn("[SilentError]", err))

    fetch('/api/workspace/activity')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.accessibleRange !== undefined) setPermData(d) })
      .catch((err: any) => console.warn("[SilentError]", err))
  }, [])

  // Auto-focus current password field when modal opens
  useEffect(() => {
    if (changePwdOpen && pwdCurrentRef.current) {
      const timer = setTimeout(() => pwdCurrentRef.current?.focus(), 150)
      return () => clearTimeout(timer)
    }
  }, [changePwdOpen])

  // Password strength calculator
  function getPwdStrength(pw: string): { level: number; label: string; bar: string; text: string } {
    const len = pw.length
    const hasLower = /[a-z]/.test(pw)
    const hasUpper = /[A-Z]/.test(pw)
    const hasDigit = /\d/.test(pw)
    const hasSpecial = /[^a-zA-Z0-9]/.test(pw)
    let score = 0
    if (len >= 6) score++
    if (len >= 8) score++
    if (hasLower && hasUpper) score++
    if (hasDigit) score++
    if (hasSpecial) score++
    if (score <= 1) return { level: 0, label: '弱', bar: 'w-1/4', text: 'text-red-500' }
    if (score === 2) return { level: 1, label: '中', bar: 'w-2/4', text: 'text-amber-500' }
    if (score <= 3) return { level: 2, label: '强', bar: 'w-3/4', text: 'text-blue-500' }
    return { level: 3, label: '非常强', bar: 'w-full', text: 'text-emerald-500' }
  }

  const pwdStrength = pwdForm.newPassword ? getPwdStrength(pwdForm.newPassword) : null

  // Close on Escape
  useEffect(() => {
    if (!changePwdOpen) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setChangePwdOpen(false); resetPwdForm() }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [changePwdOpen])

  // Enter to submit from any password field

  // Real-time validation: update pwdMsg as user types
  useEffect(() => {
    const curPw = pwdForm.currentPassword
    const newPw = pwdForm.newPassword
    const confirmPw = pwdForm.confirmPassword

    // Don't show errors until user has started typing something
    if (!curPw && !newPw && !confirmPw) { setPwdMsg(null); return }

    if (newPw && newPw.length < 6)         { setPwdMsg({ type: 'error', text: '新密码至少 6 位' }); return }
    if (newPw && !/[a-zA-Z]/.test(newPw))  { setPwdMsg({ type: 'error', text: '新密码必须包含字母' }); return }
    if (newPw && !/\d/.test(newPw))        { setPwdMsg({ type: 'error', text: '新密码必须包含数字' }); return }
    if (newPw && curPw && newPw === curPw) {
      setPwdMsg({ type: 'error', text: '新密码不能与当前密码相同' }); return
    }
    if (newPw && confirmPw && newPw !== confirmPw) {
      setPwdMsg({ type: 'error', text: '两次输入的新密码不一致' }); return
    }
    // All checks passed — clear the message
    setPwdMsg(null)
  }, [pwdForm.currentPassword, pwdForm.newPassword, pwdForm.confirmPassword])
  function onPwdKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !pwdSaving) {
      e.preventDefault()
      handleChangePassword()
    }
  }


  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    const q = search.trim()
    if (!q) return
    setMobileSearchOpen(false)
    if (q.includes('?') || q.includes('？') || q.includes('如何') || q.includes('怎么')) {
      router.push(`/internal/ai?q=${encodeURIComponent(q)}`)
    } else {
      router.push(`/internal/documents?search=${encodeURIComponent(q)}`)
    }
  }

  const roleLabel = user?.role === 'super_admin' ? '超级管理员' : user?.role === 'dept_admin' ? '部门管理员' : '员工'
  const canSeePermission = (key: string) => permissions.includes('*') || permissions.includes(key) || permissions.some(p => p.startsWith(`${key}.`))

  const resetPwdForm = () => {
    setPwdForm({ currentPassword: '', newPassword: '', confirmPassword: '' })
    setPwdShow({ current: false, new: false, confirm: false })
    setPwdMsg(null)
    setPwdSaving(false)
  }

  const handleChangePassword = async () => {
    setPwdMsg(null)
    // 前端验证
    if (!pwdForm.currentPassword) { setPwdMsg({ type: 'error', text: '请输入当前密码' }); return }
    if (!pwdForm.newPassword) { setPwdMsg({ type: 'error', text: '请输入新密码' }); return }
    if (pwdForm.newPassword.length < 6) { setPwdMsg({ type: 'error', text: '新密码至少 6 位' }); return }
    if (!/[a-zA-Z]/.test(pwdForm.newPassword)) { setPwdMsg({ type: 'error', text: '新密码必须包含字母' }); return }
    if (!/\d/.test(pwdForm.newPassword)) { setPwdMsg({ type: 'error', text: '新密码必须包含数字' }); return }
    if (pwdForm.newPassword !== pwdForm.confirmPassword) { setPwdMsg({ type: 'error', text: '两次输入的新密码不一致' }); return }
    if (pwdForm.currentPassword === pwdForm.newPassword) { setPwdMsg({ type: 'error', text: '新密码不能与当前密码相同' }); return }
    setPwdSaving(true)
    try {
      const res = await fetch('/api/auth/change-password', { credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword: pwdForm.currentPassword, newPassword: pwdForm.newPassword }),
      })
      const data = await res.json()
      if (res.ok) {
        setPwdMsg({ type: 'success', text: data.message || '密码修改成功' })
        setPwdForm({ currentPassword: '', newPassword: '', confirmPassword: '' })
        setTimeout(() => { setChangePwdOpen(false); resetPwdForm(); window.location.href = '/api/auth/logout' }, 1500)
      } else {
        setPwdMsg({ type: 'error', text: data.error || '修改失败，请重试' })
      }
    } catch {
      setPwdMsg({ type: 'error', text: '网络错误，请稍后重试' })
    }
    setPwdSaving(false)
  }

  return (
    <div className="h-screen flex flex-col bg-[#F8F9FA] overflow-hidden">
      {/* ═══ Top Navbar 64px ═══ */}
      <header className="relative h-16 shrink-0 bg-white border-b border-neutral-200 grid grid-cols-[auto_1fr_auto] lg:grid-cols-[260px_1fr_auto] items-center px-3 lg:pl-0 lg:pr-4 z-30">
        {/* ── Left: Logo (centered in sidebar width) ── */}
        <div className="flex items-center justify-start lg:justify-center gap-2 min-w-0">
          <button onClick={() => setSidebarOpen(true)} className="lg:hidden shrink-0 min-h-[44px] min-w-[44px] flex items-center justify-center text-neutral-500 hover:bg-neutral-100 rounded-lg transition-colors" aria-label="打开菜单">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="4" y1="6" x2="20" y2="6"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="18" x2="20" y2="18"/></svg>
          </button>
          <Link href="/internal/dashboard" className="flex items-center shrink-0 no-underline"><img src="/images/logo.jpg" alt="YUAN SHOWROOM" className="h-10 w-auto max-w-[132px] sm:max-w-[160px] object-contain py-1" /></Link>
        </div>

        {/* ── Center: Search + Button ── */}
        <form onSubmit={handleSearch} className="hidden md:flex items-center gap-2 justify-self-center">
          <div className="w-[min(360px,38vw)] relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" size={16} strokeWidth={1.5} />
            <input ref={searchRef} type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="搜索文件、制度、流程或直接提问..." className="w-full pl-10 pr-4 py-2 text-[0.82rem] bg-[#F8F9FA] border border-neutral-200 rounded-lg focus:outline-none focus:border-[#2563EB] focus:bg-white focus:ring-2 focus:ring-[#2563EB]/15 transition-all placeholder:text-neutral-400" />
          </div>
          <button type="submit" className="flex items-center gap-1.5 px-4 py-2 text-[0.78rem] font-medium text-white bg-[#2563EB] rounded-lg hover:bg-blue-600 shrink-0"><Search size={14} strokeWidth={1.5} />搜索</button>
        </form>

        {/* ── Right: New + Bell + User ── */}
        <div className="flex items-center gap-1 justify-self-end">
          <button
            type="button"
            onClick={() => setMobileSearchOpen(open => !open)}
            className={`md:hidden min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg transition-colors ${mobileSearchOpen ? 'bg-[#EBF5FF] text-[#2563EB]' : 'text-neutral-500 hover:bg-neutral-100'}`}
            aria-label="打开搜索"
          >
            <Search size={17} strokeWidth={1.5} />
          </button>
          {canSeePermission('document.upload') && (
            <>
              <button onClick={() => router.push('/internal/documents')} className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 text-[0.78rem] text-neutral-600 border border-neutral-200 rounded-lg hover:bg-neutral-50 transition-colors"><FolderPlus size={14} strokeWidth={1.5} /><span>新建</span></button>
              <div className="hidden sm:block w-px h-6 bg-neutral-200 mx-1" />
            </>
          )}
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
                      onClick={() => { setUserMenuOpen(false); setChangePwdOpen(true); resetPwdForm() }}
                      className="w-full flex items-center gap-2.5 px-4 py-2 text-[0.78rem] text-neutral-600 hover:bg-neutral-50 transition-colors"
                    >
                      <KeyRound size={14} strokeWidth={1.5} className="text-neutral-400" />
                      修改密码
                    </button>
                    <button
                      onClick={() => { setUserMenuOpen(false); setPermModalOpen(true) }}
                      className="w-full flex items-center gap-2.5 px-4 py-2 text-[0.78rem] text-neutral-600 hover:bg-neutral-50 transition-colors"
                    >
                      <Shield size={14} strokeWidth={1.5} className="text-neutral-400" />
                      我的权限
                    </button>
                    {(canSeePermission('menu.admin.users') || canSeePermission('menu.admin')) && (
                      <>
                        <Link
                          href="/internal/admin/users"
                          onClick={() => setUserMenuOpen(false)}
                          className="w-full flex items-center gap-2.5 px-4 py-2 text-[0.78rem] text-neutral-600 hover:bg-neutral-50 transition-colors no-underline"
                        >
                          <Users size={14} strokeWidth={1.5} className="text-neutral-400" />
                          用户管理
                        </Link>
                      </>
                    )}
                    {canSeePermission('menu.admin') && (
                      <>
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

        {mobileSearchOpen && (
          <div className="md:hidden absolute left-0 right-0 top-16 border-b border-neutral-200 bg-white p-3 shadow-sm">
            <form onSubmit={handleSearch} className="flex items-center gap-2">
              <div className="relative min-w-0 flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" size={16} strokeWidth={1.5} />
                <input
                  type="text"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="搜索文件、制度、流程..."
                  className="w-full min-h-[44px] pl-10 pr-3 text-[0.85rem] bg-[#F8F9FA] border border-neutral-200 rounded-lg focus:outline-none focus:border-[#2563EB] focus:bg-white focus:ring-2 focus:ring-[#2563EB]/15 placeholder:text-neutral-400"
                  autoFocus
                />
              </div>
              <button type="submit" className="min-h-[44px] px-4 text-[0.82rem] font-medium text-white bg-[#2563EB] rounded-lg hover:bg-blue-600 shrink-0">
                搜索
              </button>
            </form>
          </div>
        )}
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
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:!transform-none'}
        `}>
          <InternalSidebar onClose={() => setSidebarOpen(false)} />
        </div>

        {/* Main Content */}
        <main className={pathname === '/internal/documents' ? 'flex-1 flex flex-col overflow-hidden' : 'flex-1 overflow-y-auto'}>
          {children}
        </main>
      </div>

      {/* ═══ Permission Modal ═══ */}
      {/* ═══ Change Password Modal ═══ */}
      {changePwdOpen && user && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => { setChangePwdOpen(false); resetPwdForm() }} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="flex items-center gap-2 text-[0.95rem] font-semibold text-neutral-800">
                <KeyRound size={18} strokeWidth={1.5} className="text-neutral-500" />
                修改密码
              </h2>
              <button onClick={() => { setChangePwdOpen(false); resetPwdForm() }} className="p-1 text-neutral-400 hover:text-neutral-700 rounded-lg hover:bg-neutral-100">
                <X size={16} strokeWidth={1.5} />
              </button>
            </div>
            <div className="space-y-4">
              {/* 当前密码 */}
              <div>
                <label className="text-[0.72rem] font-medium text-neutral-500 mb-1 block">当前密码</label>
                <div className="relative">
                  <div className="absolute left-1.5 top-1/2 -translate-y-1/2 pointer-events-none z-10">
                    <PasswordCharacter variant={0} covering={pwdForm.currentPassword.length > 0} />
                  </div>
                  <input
                    ref={pwdCurrentRef}
                    type={pwdShow.current ? 'text' : 'password'}
                    value={pwdForm.currentPassword}
                    onChange={e => setPwdForm(p => ({ ...p, currentPassword: e.target.value }))}
                    onFocus={() => setPwdFocus(p => ({ ...p, current: true }))}
                    onBlur={() => setPwdFocus(p => ({ ...p, current: false }))}
                    onKeyDown={onPwdKeyDown}
                    placeholder="输入当前密码"
                    className="w-full min-h-[44px] pl-[42px] pr-10 py-2 text-[0.85rem] border border-neutral-200 rounded-lg focus:outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/15"
                  />
                  <button
                    type="button"
                    onClick={() => setPwdShow(p => ({ ...p, current: !p.current }))}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-neutral-400 hover:text-neutral-600"
                  >
                    {pwdShow.current ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
              {/* 新密码 */}
              <div>
                <label className="text-[0.72rem] font-medium text-neutral-500 mb-1 block">新密码</label>
                <div className="relative">
                  <div className="absolute left-1.5 top-1/2 -translate-y-1/2 pointer-events-none z-10">
                    <PasswordCharacter variant={1} covering={pwdForm.newPassword.length > 0} />
                  </div>
                  <input
                    type={pwdShow.new ? 'text' : 'password'}
                    value={pwdForm.newPassword}
                    onChange={e => setPwdForm(p => ({ ...p, newPassword: e.target.value }))}
                    onFocus={() => setPwdFocus(p => ({ ...p, new: true }))}
                    onBlur={() => setPwdFocus(p => ({ ...p, new: false }))}
                    onKeyDown={onPwdKeyDown}
                    placeholder="至少 6 位，含字母和数字"
                    className="w-full min-h-[44px] pl-[42px] pr-10 py-2 text-[0.85rem] border border-neutral-200 rounded-lg focus:outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/15"
                  />
                  <button
                    type="button"
                    onClick={() => setPwdShow(p => ({ ...p, new: !p.new }))}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-neutral-400 hover:text-neutral-600"
                  >
                    {pwdShow.new ? <EyeOff size={16} /> : <Eye size={16} />}
                 </button>
               </div>
              {/* 密码强度指示条 */}
              {pwdForm.newPassword && (
                <div className="mt-1">
                  <div className="flex gap-0.5 h-1 rounded-full overflow-hidden bg-neutral-100">
                    <div className={`${pwdStrength?.bar || 'w-0'} h-full rounded-full transition-all duration-300 ${
                      pwdStrength?.level === 0 ? 'bg-red-400' :
                      pwdStrength?.level === 1 ? 'bg-amber-400' :
                      pwdStrength?.level === 2 ? 'bg-blue-400' : 'bg-emerald-400'
                    }`} />
                  </div>
                  <p className={`text-[0.65rem] mt-0.5 ${pwdStrength?.text || 'text-neutral-300'}`}>
                    密码强度：{pwdStrength?.label || '—'}
                  </p>
   </div>
 )}
              {/* 上次修改时间 */}
             {lastPwdChange && (
                <p className="text-[0.65rem] text-neutral-400">上次修改：{new Date(lastPwdChange).toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}</p>
              )}
              </div>
              {/* 确认新密码 */}
              <div>
                <label className="text-[0.72rem] font-medium text-neutral-500 mb-1 block">确认新密码</label>
                <div className="relative">
                  <div className="absolute left-1.5 top-1/2 -translate-y-1/2 pointer-events-none z-10">
                    <PasswordCharacter variant={2} covering={pwdForm.confirmPassword.length > 0} />
                  </div>
                  <input
                    type={pwdShow.confirm ? 'text' : 'password'}
                    value={pwdForm.confirmPassword}
                    onChange={e => setPwdForm(p => ({ ...p, confirmPassword: e.target.value }))}
                    onFocus={() => setPwdFocus(p => ({ ...p, confirm: true }))}
                    onBlur={() => setPwdFocus(p => ({ ...p, confirm: false }))}
                    onKeyDown={onPwdKeyDown}
                    placeholder="再次输入新密码"
                    className="w-full min-h-[44px] pl-[42px] pr-10 py-2 text-[0.85rem] border border-neutral-200 rounded-lg focus:outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/15"
                  />
                  <button
                    type="button"
                    onClick={() => setPwdShow(p => ({ ...p, confirm: !p.confirm }))}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-neutral-400 hover:text-neutral-600"
                  >
                    {pwdShow.confirm ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
              {/* 提示信息 */}
              {pwdMsg && (
                <div className={`flex items-center gap-2 text-[0.78rem] px-3 py-2 rounded-lg ${pwdMsg.type === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                  {pwdMsg.type === 'success' ? <CheckCircle2 size={14} /> : <X size={14} />}
                  {pwdMsg.text}
                </div>
              )}
              {/* 按钮 */}
              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => { setChangePwdOpen(false); resetPwdForm() }}
                  className="flex-1 min-h-[44px] text-[0.82rem] border border-neutral-200 rounded-lg text-neutral-600 hover:bg-neutral-50 transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={handleChangePassword}
                  disabled={pwdSaving}
                  className="flex-1 min-h-[44px] text-[0.82rem] font-medium bg-[#2563EB] text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 flex items-center justify-center gap-1.5 transition-colors"
                >
                  {pwdSaving ? <Loader2 size={14} className="animate-spin" /> : null}
                  {pwdSaving ? '修改中...' : '确认修改'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

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
