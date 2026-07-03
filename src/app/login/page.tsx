'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff, X, LogIn } from 'lucide-react'

const CHARACTERS = [
  { name: '小元', skin: '#FFE4C4', hair: '#5C3A21', eye: '#4A3728', outfit: '#6B8FA3', accent: '#E8A0BF', blush: '#FFB5C5', scale: 1, hairStyle: 'bob' as const },
  { name: '小学', skin: '#FDDCB5', hair: '#8B5A2B', eye: '#5C4033', outfit: '#C4956A', accent: '#F0C060', blush: '#FFC0A0', scale: 1.15, hairStyle: 'side' as const },
  { name: '小成', skin: '#FFDAB9', hair: '#3D2B1F', eye: '#3D2B1F', outfit: '#7BAF7F', accent: '#FF8C42', blush: '#FFB085', scale: 0.85, hairStyle: 'tuft' as const },
]

// ===== Eye-tracking SVG character with beautiful design =====
function EyeTrackCharacter({ char, index, mousePos, passwordFocused, onEyeRefs }: {
  char: typeof CHARACTERS[0]
  index: number
  mousePos: { x: number; y: number }
  passwordFocused: boolean
  onEyeRefs: (idx: number, lp: SVGCircleElement | null, rp: SVGCircleElement | null, ll: SVGRectElement | null, rl: SVGRectElement | null) => void
}) {
  const svgRef = useRef<SVGSVGElement>(null)
  const leftPupilRef = useRef<SVGCircleElement | null>(null)
  const rightPupilRef = useRef<SVGCircleElement | null>(null)
  const leftLidRef = useRef<SVGRectElement | null>(null)
  const rightLidRef = useRef<SVGRectElement | null>(null)
  const eyeCenters = useRef({ lx: 0, ly: 0, rx: 0, ry: 0 })
  const rafRef = useRef<number>(0)
  const lastLidH = useRef(0)
  const blinkTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isBlinking = useRef(false)

  // Eye tracking animation
  const animateEyes = useCallback(() => {
    if (!leftPupilRef.current || !rightPupilRef.current) return
    const svg = svgRef.current
    if (!svg) return
    const rect = svg.getBoundingClientRect()
    const cx = rect.left + rect.width / 2
    const cy = rect.top + rect.height / 2
    const pupilR = 6.5
    const maxR = 4
    for (const [pupil, cx0, cy0] of [[leftPupilRef.current, 35, 34], [rightPupilRef.current, 65, 34]] as const) {
      if (passwordFocused || isBlinking.current) {
        pupil.setAttribute('transform', 'translate(0, 0)')
      } else {
        const dx = mousePos.x - cx
        const dy = mousePos.y - cy
        const dist = Math.sqrt(dx * dx + dy * dy)
        if (dist > 0) {
          const m = Math.min(dist * 0.06, maxR)
          pupil.setAttribute('transform', `translate(${(dx / dist) * m}, ${(dy / dist) * m})`)
        }
      }
    }
    // Eyelid animation
    const targetH = isBlinking.current ? 24 : 0
    if (!isBlinking.current) {
      if (leftLidRef.current && rightLidRef.current) {
        lastLidH.current += (targetH - lastLidH.current) * 0.12
        const h = Math.abs(lastLidH.current) < 0.1 ? 0 : lastLidH.current
        leftLidRef.current.setAttribute('height', String(h))
        rightLidRef.current.setAttribute('height', String(h))
      }
    }
    rafRef.current = requestAnimationFrame(animateEyes)
  }, [mousePos, passwordFocused])

  useEffect(() => {
    rafRef.current = requestAnimationFrame(animateEyes)
    return () => cancelAnimationFrame(rafRef.current)
  }, [animateEyes])

  // Periodic blinking
  useEffect(() => {
    function doBlink() {
      if (passwordFocused) return
      isBlinking.current = true
      if (leftLidRef.current && rightLidRef.current) {
        leftLidRef.current.setAttribute('height', '24')
        rightLidRef.current.setAttribute('height', '24')
      }
      setTimeout(() => {
        isBlinking.current = false
      }, 120)
    }
    const scheduleBlink = () => {
      blinkTimer.current = setTimeout(() => {
        doBlink()
        scheduleBlink()
      }, 3000 + Math.random() * 2000)
    }
    scheduleBlink()
    return () => { if (blinkTimer.current) clearTimeout(blinkTimer.current) }
  }, [passwordFocused])

  // Report refs
  useEffect(() => {
    onEyeRefs(index, leftPupilRef.current, rightPupilRef.current, leftLidRef.current, rightLidRef.current)
  }, [])

  const s = char.scale
  const handOpacity = passwordFocused ? 0.95 : 0
  const handScale = passwordFocused ? 1 : 0.5

  return (
    <div className="relative" style={{ width: 100 * s, height: 140 * s }}>
      <svg ref={svgRef} viewBox="0 0 100 130" width={100 * s} height={130 * s} className="overflow-visible">
        <defs>
          <filter id={`shadow-${index}`}>
            <feDropShadow dx="0" dy="2" stdDeviation="2" floodOpacity="0.12" />
          </filter>
        </defs>

        {/* Body / Outfit */}
        <g filter={`url(#shadow-${index})`}>
          <path d="M 26 70 Q 50 64 74 70 L 78 115 Q 50 124 22 115 Z" fill={char.outfit} />
          <path d="M 38 72 L 50 84 L 62 72" fill="none" stroke="white" strokeWidth="2" opacity="0.35" />
        </g>

        {/* Resting arms (fade out when password focused) */}
        <g style={{
          opacity: passwordFocused ? 0 : 1,
          transition: 'opacity 0.25s ease',
        }}>
          <path d="M 26 75 Q 14 84 13 98" stroke={char.outfit} strokeWidth="6" fill="none" strokeLinecap="round" />
          <circle cx="13" cy="100" r="3.5" fill={char.skin} />
          <path d="M 74 75 Q 86 84 87 98" stroke={char.outfit} strokeWidth="6" fill="none" strokeLinecap="round" />
          <circle cx="87" cy="100" r="3.5" fill={char.skin} />
        </g>
        {/* Raised arms swing up to cover eyes (fade in when password focused) */}
        <g style={{
          opacity: passwordFocused ? 1 : 0,
          transform: passwordFocused ? 'scale(1)' : 'scale(0.7)',
          transformOrigin: '26px 75px',
          transition: 'opacity 0.3s ease, transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
        }}>
          <path d="M 26 75 Q 28 55 33 45" stroke={char.outfit} strokeWidth="6" fill="none" strokeLinecap="round" />
          <circle cx="33" cy="45" r="3.5" fill={char.skin} />
        </g>
        <g style={{
          opacity: passwordFocused ? 1 : 0,
          transform: passwordFocused ? 'scale(1)' : 'scale(0.7)',
          transformOrigin: '74px 75px',
          transition: 'opacity 0.3s ease, transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
        }}>
          <path d="M 74 75 Q 72 55 67 45" stroke={char.outfit} strokeWidth="6" fill="none" strokeLinecap="round" />
          <circle cx="67" cy="45" r="3.5" fill={char.skin} />
        </g>

        {/* Head */}
        <circle cx="50" cy="34" r="22" fill={char.skin} filter={`url(#shadow-${index})`} />

        {/* Ears */}
        <ellipse cx="28" cy="36" rx="4" ry="6" fill={char.skin} />
        <ellipse cx="72" cy="36" rx="4" ry="6" fill={char.skin} />

        {/* Blush */}
        <ellipse cx="28" cy="42" rx="8" ry="4.5" fill={char.blush} opacity="0.35" />
        <ellipse cx="72" cy="42" rx="8" ry="4.5" fill={char.blush} opacity="0.35" />

        {/* Hair */}
        {char.hairStyle === 'bob' && (
          <>
            <ellipse cx="50" cy="26" rx="26" ry="22" fill={char.hair} />
            <path d="M24 26 Q22 48 26 62" stroke={char.hair} strokeWidth="5" fill="none" strokeLinecap="round" />
            <path d="M76 26 Q78 48 74 62" stroke={char.hair} strokeWidth="5" fill="none" strokeLinecap="round" />
            <path d="M30 18 Q38 12 46 16 Q50 10 54 16 Q62 12 70 18" stroke={char.hair} strokeWidth="4.5" fill="none" strokeLinecap="round" />
          </>
        )}
        {char.hairStyle === 'side' && (
          <>
            <ellipse cx="50" cy="26" rx="26" ry="22" fill={char.hair} />
            <path d="M22 22 Q30 14 44 16 Q52 16 62 18 Q70 20 78 26" stroke={char.hair} strokeWidth="5" fill="none" strokeLinecap="round" />
            <path d="M76 28 Q80 46 78 58" stroke={char.hair} strokeWidth="4.5" fill="none" strokeLinecap="round" />
            <circle cx="72" cy="20" r="2.5" fill={char.accent} />
          </>
        )}
        {char.hairStyle === 'tuft' && (
          <>
            <ellipse cx="50" cy="26" rx="24" ry="20" fill={char.hair} />
            <path d="M38 12 Q40 3 44 8 Q48 2 52 6 Q56 2 60 8 Q62 3 64 12" stroke={char.hair} strokeWidth="5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M26 28 Q22 44 24 52" stroke={char.hair} strokeWidth="4" fill="none" strokeLinecap="round" />
            <path d="M74 28 Q78 44 76 52" stroke={char.hair} strokeWidth="4" fill="none" strokeLinecap="round" />
          </>
        )}

        {/* Eyebrows */}
        <path d="M27 26 Q34 23 42 26" stroke={char.eye} strokeWidth="1.8" fill="none" strokeLinecap="round" opacity="0.35" />
        <path d="M58 26 Q66 23 73 26" stroke={char.eye} strokeWidth="1.8" fill="none" strokeLinecap="round" opacity="0.35" />

        {/* Bigger eyes (anime-style) */}
        <ellipse cx="35" cy="33" rx="13" ry="14" fill="white" />
        <ellipse cx="65" cy="33" rx="13" ry="14" fill="white" />

        {/* Inner eye shine */}
        <ellipse cx="32" cy="30" rx="5" ry="6" fill="#f0f4ff" opacity="0.35" />
        <ellipse cx="62" cy="30" rx="5" ry="6" fill="#f0f4ff" opacity="0.35" />

        {/* Pupils */}
        <circle ref={leftPupilRef} cx="35" cy="34" r="6.5" fill={char.eye} />
        <circle ref={rightPupilRef} cx="65" cy="34" r="6.5" fill={char.eye} />

        {/* Dual pupil highlights (anime sparkle effect) */}
        <circle cx="33" cy="32" r="2.5" fill="white" opacity="0.75" />
        <circle cx="37" cy="36.5" r="1.5" fill="white" opacity="0.45" />
        <circle cx="63" cy="32" r="2.5" fill="white" opacity="0.75" />
        <circle cx="67" cy="36.5" r="1.5" fill="white" opacity="0.45" />

        {/* Cute eyelashes */}
        <path d="M23 31 L21 27" stroke={char.eye} strokeWidth="1.2" fill="none" strokeLinecap="round" opacity="0.35" />
        <path d="M25 28 L23 25" stroke={char.eye} strokeWidth="1.2" fill="none" strokeLinecap="round" opacity="0.35" />
        <path d="M77 31 L79 27" stroke={char.eye} strokeWidth="1.2" fill="none" strokeLinecap="round" opacity="0.35" />
        <path d="M75 28 L77 25" stroke={char.eye} strokeWidth="1.2" fill="none" strokeLinecap="round" opacity="0.35" />

        {/* Eyelids (for blinking) */}
        <rect ref={leftLidRef} x="22" y="19" width="26" height="0" rx="13" fill={char.skin} />
        <rect ref={rightLidRef} x="52" y="19" width="26" height="0" rx="13" fill={char.skin} />

        {/* Hands covering eyes when password focused */}
        <g style={{
          opacity: handOpacity,
          transform: `scale(${handScale})`,
          transition: 'opacity 0.3s ease, transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
          transformOrigin: '35px 33px',
        }}>
          <circle cx="33" cy="31" r="9" fill={char.skin} />
          <path d="M28 24 Q30 21 33 24 L35 24 Q37 21 39 24" fill="white" opacity="0.3" />
        </g>
        <g style={{
          opacity: handOpacity,
          transform: `scale(${handScale})`,
          transition: 'opacity 0.3s ease, transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
          transformOrigin: '65px 33px',
        }}>
          <circle cx="67" cy="31" r="9" fill={char.skin} />
          <path d="M62 24 Q64 21 67 24 L69 24 Q71 21 73 24" fill="white" opacity="0.3" />
        </g>

        {/* Mouth */}
        <path d="M44 46 Q50 50 56 46" stroke={char.eye} strokeWidth="1.8" fill="none" strokeLinecap="round" opacity="0.3" />

        {/* Nose */}
        <path d="M48 39 Q50 41 52 39" stroke={char.eye} strokeWidth="1" fill="none" strokeLinecap="round" opacity="0.2" />

        {/* Small accessory accent */}
        {char.hairStyle === 'tuft' && (
          <circle cx="76" cy="24" r="2" fill={char.accent} opacity="0.6" />
        )}
      </svg>
    </div>
  )
}

// ===== Main Login Page =====
export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPwd, setShowPwd] = useState(false)
  const [remember, setRemember] = useState(false)
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<{ email?: string; password?: string; general?: string }>({})
  const [passwordFocused, setPasswordFocused] = useState(false)
  const [mousePos, setMousePos] = useState({ x: -1000, y: -1000 })
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const saved = localStorage.getItem('yuan_login_email')
    if (saved) { setEmail(saved); setRemember(true) }
  }, [])

  const handleEyeRefs = useCallback((idx: number, lp: SVGCircleElement | null, rp: SVGCircleElement | null, ll: SVGRectElement | null, rl: SVGRectElement | null) => {}, [])
  const handleMouseMove = useCallback((e: React.MouseEvent) => { setMousePos({ x: e.clientX, y: e.clientY }) }, [])
  const handlePasswordFocus = useCallback(() => setPasswordFocused(true), [])
  const handlePasswordBlur = useCallback(() => setPasswordFocused(false), [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (loading) return
    setErrors({})
    if (!email.trim()) { setErrors({ email: '请输入邮箱' }); return }
    if (!password) { setErrors({ password: '请输入密码' }); return }
    setLoading(true)
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password }),
      })
      if (res.ok) {
        if (remember) localStorage.setItem('yuan_login_email', email.trim())
        else localStorage.removeItem('yuan_login_email')
        setLoading(false)
        router.push('/internal/dashboard')
      } else {
        const data = await res.json().catch(() => ({})) as { error?: string }
        setErrors({ general: data.error || (res.status === 401 ? '邮箱或密码错误' : '登录失败') })
        setLoading(false)
      }
    } catch {
      setErrors({ general: '网络错误，请检查连接后重试' }); setLoading(false)
    }
  }

  return (
    <div ref={containerRef} onMouseMove={handleMouseMove} className="min-h-screen flex flex-col items-center bg-gradient-to-b from-indigo-50 via-white to-amber-50 px-4 py-8 select-none">
      <div className="w-full max-w-[440px] mx-auto my-auto">
        {/* Three cute characters */}
        <div className="flex items-end justify-center gap-2 sm:gap-4 mb-3" style={{ minHeight: 120 }}>
          {CHARACTERS.map((char, i) => (
            <EyeTrackCharacter key={char.name} char={char} index={i} mousePos={mousePos} passwordFocused={passwordFocused} onEyeRefs={handleEyeRefs} />
          ))}
        </div>

        {/* Brand header */}
        <div className="text-center mb-6">
          <h2 className="text-lg font-semibold text-neutral-800 tracking-wide">深圳（香港）时胜集团</h2>
          <p className="text-xs text-neutral-400 mt-0.5 font-normal tracking-wide">Shenzhen (Hong Kong) ShiSheng Group</p>
        </div>

        {/* Login card */}
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl shadow-neutral-200/60 border border-neutral-100 p-6 md:p-8">
          <form onSubmit={handleSubmit} noValidate>
            <div className="mb-4">
              <label className="block text-[0.72rem] font-medium text-neutral-600 mb-1.5">邮箱</label>
              <div className="relative">
                <input type="email" value={email} onChange={e => { setEmail(e.target.value); setErrors(prev => ({ ...prev, email: undefined, general: undefined })) }} placeholder="name@yuanshowroom.com" className={`w-full px-3 pr-8 py-2.5 min-h-[44px] border rounded-lg text-[0.85rem] text-neutral-900 bg-white/80 focus:outline-none focus:ring-2 focus:ring-offset-0 transition-all duration-200 font-normal ${errors.email ? 'border-red-300 focus:ring-red-200' : 'border-neutral-200 focus:border-indigo-400 focus:ring-indigo-100'}`} autoComplete="email" />
                {email && (<button type="button" onClick={() => setEmail('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-300 hover:text-neutral-500 transition-colors"><X size={14} /></button>)}
              </div>
              {errors.email && <p className="text-[0.68rem] text-red-500 mt-1 font-normal">{errors.email}</p>}
            </div>

            <div className="mb-5">
              <label className="block text-[0.72rem] font-medium text-neutral-600 mb-1.5">密码</label>
              <div className="relative">
                <input type={showPwd ? 'text' : 'password'} value={password} onChange={e => { setPassword(e.target.value); setErrors(prev => ({ ...prev, password: undefined, general: undefined })) }} onFocus={handlePasswordFocus} onBlur={handlePasswordBlur} placeholder="输入密码" className={`w-full px-3 pr-20 py-2.5 min-h-[44px] border rounded-lg text-[0.85rem] text-neutral-900 bg-white/80 focus:outline-none focus:ring-2 focus:ring-offset-0 transition-all duration-200 font-normal ${errors.password ? 'border-red-300 focus:ring-red-200' : 'border-neutral-200 focus:border-indigo-400 focus:ring-indigo-100'}`} autoComplete="current-password" />
                <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
                  {password && (<button type="button" onClick={() => setPassword('')} className="p-1 text-neutral-300 hover:text-neutral-500 transition-colors"><X size={14} /></button>)}
                  <button type="button" onClick={() => setShowPwd(!showPwd)} className="p-1 text-neutral-300 hover:text-neutral-500 transition-colors">{showPwd ? <EyeOff size={16} /> : <Eye size={16} />}</button>
                </div>
              </div>
              {errors.password && <p className="text-[0.68rem] text-red-500 mt-1 font-normal">{errors.password}</p>}
            </div>

            <div className="flex items-center justify-between mb-5">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)} className="w-3.5 h-3.5 rounded border-neutral-300 text-neutral-900 focus:ring-neutral-300 cursor-pointer" />
                <span className="text-[0.72rem] text-neutral-500 font-normal">记住邮箱</span>
              </label>
              <button type="button" onClick={() => alert('请联系管理员重置密码')} className="text-[0.72rem] text-neutral-400 hover:text-neutral-600 transition-colors font-normal">忘记密码？</button>
            </div>

            {errors.general && (<div className="mb-4 px-3 py-2.5 bg-red-50 border border-red-100 rounded-lg text-[0.75rem] text-red-600 font-normal">{errors.general}</div>)}

            <button type="submit" disabled={loading} className="w-full py-2.5 min-h-[44px] bg-gradient-to-r from-indigo-500 to-indigo-600 text-white text-[0.82rem] font-medium rounded-lg hover:from-indigo-600 hover:to-indigo-700 active:from-indigo-700 active:to-indigo-800 transition-all duration-200 disabled:opacity-50 flex items-center justify-center gap-2 shadow-sm shadow-indigo-200">
              {loading ? (<><span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> 登录中...</>) : (<><LogIn size={15} /> 登录</>)}
            </button>
            <p className="mt-4 text-[0.65rem] text-neutral-300 text-center font-normal">连续失败 5 次将锁定 15 分钟</p>
          </form>
        </div>
        <p className="mt-6 text-[0.7rem] text-neutral-300 text-center font-normal">仅限集团人员访问</p>
      </div>
    </div>
  )
}
