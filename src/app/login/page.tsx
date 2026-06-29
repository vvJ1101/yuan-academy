'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff, X, LogIn } from 'lucide-react'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPwd, setShowPwd] = useState(false)
  const [remember, setRemember] = useState(false)
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<{ email?: string; password?: string; general?: string }>({})

  // Load remembered email
  useEffect(() => {
    const saved = localStorage.getItem('yuan_login_email')
    if (saved) {
      setEmail(saved)
      setRemember(true)
    }
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (loading) return  // prevent double submit
    setErrors({})

    // Client-side validation
    if (!email.trim()) { setErrors({ email: '请输入邮箱' }); return }
    if (!password) { setErrors({ password: '请输入密码' }); return }

    setLoading(true)
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password }),
      })

      if (res.ok) {
        // Remember email
        if (remember) {
          localStorage.setItem('yuan_login_email', email.trim())
        } else {
          localStorage.removeItem('yuan_login_email')
        }
        setLoading(false)
        router.push('/internal/dashboard')
      } else {
        const data = await res.json().catch(() => ({}))
        if (res.status === 401) {
          setErrors({ general: data.error || '邮箱或密码错误，请重试' })
        } else {
          setErrors({ general: data.error || '登录失败，请稍后重试' })
        }
        setLoading(false)
      }
    } catch {
      setErrors({ general: '网络错误，请检查连接后重试' })
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-neutral-50 to-white px-4 py-8">
      <div className="w-full max-w-[400px]">
        {/* Brand Logo */}
        <div className="text-center mb-8">
          <h1 className="text-[1.1rem] font-light tracking-[0.15em] uppercase text-neutral-900">
            YUAN SHOWROOM
          </h1>
          <p className="text-[0.78rem] text-neutral-400 font-normal mt-2">员工登录</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-xl shadow-neutral-200/50 border border-neutral-100 p-6 md:p-8">
          <form onSubmit={handleSubmit} noValidate>
            {/* Email */}
            <div className="mb-4">
              <label className="block text-[0.72rem] font-medium text-neutral-600 mb-1.5">
                邮箱
              </label>
              <div className="relative">
                <input
                  type="email"
                  value={email}
                  onChange={e => { setEmail(e.target.value); setErrors(prev => ({ ...prev, email: undefined, general: undefined })) }}
                  placeholder="name@yuanshowroom.com"
                  className={`w-full px-3 pr-8 py-2.5 min-h-[44px] border rounded-lg text-[0.85rem] text-neutral-900 bg-white focus:outline-none focus:ring-2 focus:ring-offset-0 transition-colors font-normal ${
                    errors.email ? 'border-red-300 focus:ring-red-200' : 'border-neutral-300 focus:border-neutral-900 focus:ring-neutral-200'
                  }`}
                  autoComplete="email"
                />
                {email && (
                  <button type="button" onClick={() => setEmail('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-300 hover:text-neutral-500 transition-colors">
                    <X size={14} />
                  </button>
                )}
              </div>
              {errors.email && (
                <p className="text-[0.68rem] text-red-500 mt-1 font-normal">{errors.email}</p>
              )}
            </div>

            {/* Password */}
            <div className="mb-5">
              <label className="block text-[0.72rem] font-medium text-neutral-600 mb-1.5">
                密码
              </label>
              <div className="relative">
                <input
                  type={showPwd ? 'text' : 'password'}
                  value={password}
                  onChange={e => { setPassword(e.target.value); setErrors(prev => ({ ...prev, password: undefined, general: undefined })) }}
                  placeholder="输入密码"
                  className={`w-full px-3 pr-20 py-2.5 min-h-[44px] border rounded-lg text-[0.85rem] text-neutral-900 bg-white focus:outline-none focus:ring-2 focus:ring-offset-0 transition-colors font-normal ${
                    errors.password ? 'border-red-300 focus:ring-red-200' : 'border-neutral-300 focus:border-neutral-900 focus:ring-neutral-200'
                  }`}
                  autoComplete="current-password"
                />
                <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
                  {password && (
                    <button type="button" onClick={() => setPassword('')}
                      className="p-1 text-neutral-300 hover:text-neutral-500 transition-colors">
                      <X size={14} />
                    </button>
                  )}
                  <button type="button" onClick={() => setShowPwd(!showPwd)}
                    className="p-1 text-neutral-300 hover:text-neutral-500 transition-colors">
                    {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
              {errors.password && (
                <p className="text-[0.68rem] text-red-500 mt-1 font-normal">{errors.password}</p>
              )}
            </div>

            {/* Remember me */}
            <div className="flex items-center justify-between mb-5">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={e => setRemember(e.target.checked)}
                  className="w-3.5 h-3.5 rounded border-neutral-300 text-neutral-900 focus:ring-neutral-300 cursor-pointer"
                />
                <span className="text-[0.72rem] text-neutral-500 font-normal">记住邮箱</span>
              </label>
              <button type="button" onClick={() => alert('请联系管理员重置密码')}
                className="text-[0.72rem] text-neutral-400 hover:text-neutral-600 transition-colors font-normal">
                忘记密码？
              </button>
            </div>

            {/* General error */}
            {errors.general && (
              <div className="mb-4 px-3 py-2.5 bg-red-50 border border-red-100 rounded-lg text-[0.75rem] text-red-600 font-normal">
                {errors.general}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 min-h-[44px] bg-[#2563EB] text-white text-[0.82rem] font-medium rounded-lg hover:bg-blue-600 active:bg-neutral-950 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  登录中...
                </>
              ) : (
                <>
                  <LogIn size={15} />
                  登录
                </>
              )}
            </button>

            {/* Lockout hint */}
            <p className="mt-4 text-[0.65rem] text-neutral-300 text-center font-normal">
              连续失败 5 次将锁定 15 分钟
            </p>
          </form>
        </div>

        {/* Footer */}
        <p className="mt-6 text-[0.7rem] text-neutral-300 text-center font-normal">
          仅限授权人员访问
        </p>
      </div>
    </div>
  )
}
