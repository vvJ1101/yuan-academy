import { Clock, Home, Star, Wrench } from 'lucide-react'

export const QUICK_LINKS = [
  { href: '/internal/dashboard', label: '首页', Icon: Home, perm: 'menu.dashboard', permKey: 'menu.dashboard' },
  { href: '/internal/recent', label: '最近访问', Icon: Clock, perm: 'menu.recent', permKey: 'menu.recent' },
  { href: '/internal/favorites', label: '我的收藏', Icon: Star, perm: 'menu.favorites', permKey: 'menu.favorites' },
  { href: '/internal/admin', label: '管理中心', Icon: Wrench, perm: 'menu.admin', permKey: 'admin' },
]

export const BRAND_LINKS = [
  { href: '/internal/policy', label: '订货政策', permKey: 'menu.brand.ordering', type: 'ordering' },
  { href: '/internal/brand?type=contact', label: '品牌对接信息', permKey: 'menu.brand.contact', type: 'contact' },
]
