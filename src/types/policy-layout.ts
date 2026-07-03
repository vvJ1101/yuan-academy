// ═══ 订货政策 — 共享类型 ═══

/** 原始政策字段（与 policies.json 对齐，不修改） */
export interface PolicyRecord {
  category: string
  country: string
  brand: string
  style: string
  priceRange: string
  series: string
  ss26: string
  aw26: string
  delivery: string
  nonCutoff: string
  pr: string
  _idx?: number
}

/** 阶梯数据单条 */
export interface PolicyTier {
  threshold: string // 如 "5W", "10W"
  price: string // 如 "4.5折", "3.8折"
  note: string // 补充说明
}

/** AI 解析后的结构化政策模块 */
export interface PolicyModuleData {
  orderRule: string
  tiers: PolicyTier[]
  notes: string[]
}

/** 布局块类型 */
export type BlockType = 'orderRule' | 'tierTable' | 'notes' | 'text' | 'tagGroup'

/** 单个布局块 */
export interface LayoutBlock {
  type: BlockType
  title?: string
  content: PolicyTier[] | string[] | string // 按 type 不同
}

/** 一个品牌下的一个模块 */
export interface ModuleLayout {
  id: string // e.g., "ss26-policy", "aw26-delivery"
  title: string // 展示名称
  tab: '基础信息' | '26SS政策' | '7月版政策' | '营销资源'
  order: number
  blocks: LayoutBlock[]
}

/** 一个品牌的完整布局 */
export interface BrandLayout {
  brand: string
  modules: ModuleLayout[]
}

/** 布局文件顶层结构 */
export interface PolicyLayoutFile {
  version: number
  generatedAt: string
  layouts: BrandLayout[]
}

/** 筛选状态 */
export interface PolicyFilterState {
  category: string
  country: string
  priceRange: string
  style: string
  search: string
}

/** Tab 定义 */
export interface TabDef {
  id: string
  label: string
  count?: number
}

/** 组件使用的品牌摘要（Level 1 卡片用） */
export interface BrandSummary {
  brand: string
  category: string
  country: string
  priceRange: string
  series: string
  style: string
}
