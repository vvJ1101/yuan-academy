export interface Brand {
  name: string
  category: BrandCategory
  origin: string
  detail: string
  image?: string
}

export type BrandCategory = 'Womenswear' | 'Footwear' | 'Accessories' | 'Menswear' | 'Contemporary'

export interface ServiceModule {
  title: string
  description: string
  number: string
}

export interface ShowroomSeason {
  title: string
  subtitle: string
  description: string
  image: string
  aspect: 'landscape' | 'portrait'
}

export interface JournalArticle {
  tag: string
  title: string
  excerpt: string
  date: string
  readTime: string
  image: string
}

export interface NavLink {
  label: string
  href: string
}

export interface SiteConfig {
  name: string
  tagline: string
  description: string
  locations: string[]
  email: string
  phone: string
}
