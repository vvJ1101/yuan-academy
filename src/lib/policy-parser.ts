/**
 * 订货政策结构化解析引擎 v2
 * 
 * 支持两种格式：
 * 1. 简单格式：10W/4.5折/备注 → 表格展示
 * 2. 结构化格式：字段:值 → 结构化文本展示
 */

export interface PolicyTier {
  threshold: string
  price: string
  note: string
}

export interface PolicyField {
  key: string
  value: string
  isHighlight?: boolean  // 核心字段高亮
}

export interface PolicySection {
  title?: string
  fields: PolicyField[]
}

export interface PolicyStructure {
  type: 'simple' | 'structured'
  title?: string
  sections: PolicySection[]
  // 兼容原有简单格式
  orderRule: string
  tiers: PolicyTier[]
  supplementaryNotes: string[]
}

// 核心字段列表（需要高亮）
const HIGHLIGHT_FIELDS = [
  '订货门槛', '订货折扣', '订货价格', '销售控价',
  '首单订货', '订货金额', '订货批次'
]

// 字段名映射（用于简化展示）
const FIELD_LABELS: Record<string, string> = {
  '订货批次': '订货门槛',
  '首单订货': '订货门槛',
  '订货折扣': '订货折扣',
  '订货价格': '订货折扣',
}

/**
 * 检测是否为结构化格式（包含大量"字段:值"行）
 */
function isStructuredFormat(text: string): boolean {
  const lines = text.split('\n').filter(l => l.trim())
  let colonLineCount = 0
  
  for (const line of lines) {
    // 匹配"中文/字母:内容"格式
    if (/^[\u4e00-\u9fa5a-zA-Z\u3000-\u303F\uff00-\uffef]+[:\uff1a]/.test(line.trim())) {
      colonLineCount++
    }
  }
  
  // 如果超过3行是"字段:值"格式，认为是结构化
  return colonLineCount >= 3
}

/**
 * 解析结构化格式文本
 */
function parseStructured(text: string): PolicyStructure {
  const lines = text.split('\n').filter(l => l.trim())
  const sections: PolicySection[] = []
  let currentSection: PolicySection = { fields: [] }
  let title = ''

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    
    // 检测区块标题（以 - 开头或包含"协议"等）
    if (line.startsWith('-') || /^[\u3000\s]*(合作|协议|授权)/.test(line)) {
      // 保存上一个区块
      if (currentSection.fields.length > 0) {
        sections.push(currentSection)
      }
      // 开始新区块
      const sectionTitle = line.replace(/^[-\s]+/, '').trim()
      currentSection = { 
        title: sectionTitle || undefined, 
        fields: [] 
      }
      continue
    }
    
    // 检测标题（第一行且不是"字段:值"格式）
    if (i === 0 && !line.match(/^[\u4e00-\u9fa5a-zA-Z]+[:\uff1a]/)) {
      title = line
      continue
    }
    
    // 解析"字段:值"格式
    const colonMatch = line.match(/^([^:\uff1a]+)[:\uff1a](.*)$/)
    if (colonMatch) {
      let key = colonMatch[1].trim()
      const value = colonMatch[2].trim()
      
      // 简化字段名
      if (FIELD_LABELS[key]) {
        key = FIELD_LABELS[key]
      }
      
      // 标记核心字段
      const isHighlight = HIGHLIGHT_FIELDS.some(h => key.includes(h) || line.includes(h))
      
      currentSection.fields.push({ 
        key, 
        value, 
        isHighlight 
      })
    } else if (line.length > 1) {
      // 非"字段:值"格式且长度>1，作为备注
      currentSection.fields.push({ 
        key: '', 
        value: line 
      })
    }
  }
  
  // 保存最后一个区块
  if (currentSection.fields.length > 0) {
    sections.push(currentSection)
  }

  return {
    type: 'structured',
    title,
    sections,
    orderRule: '',
    tiers: [],
    supplementaryNotes: []
  }
}

// ── 简单格式解析（原有逻辑）────────────────────────────────

/** 删除中英文逗号、多余空格 */
function cleanText(raw: string): string {
  return raw
    .replace(/[,，]/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .trim()
}

/** 常见噪声词 */
const NOISE_WORDS = [
  '订货买手价', '买手订货价', '订货价', '买手价', '订货政策',
  'Order Policy', '价格阶梯', '订货阶梯',
]

function removeNoise(line: string): string {
  for (const w of NOISE_WORDS) {
    const re = new RegExp('^' + w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*')
    line = line.replace(re, '')
  }
  return line.trim()
}

/**
 * 解析简单格式（原有逻辑）
 */
function parseSimple(input: string): PolicyStructure {
  const cleaned = cleanText(input)
  const lines = cleaned.split('\n').map(l => l.trim()).filter(Boolean)

  let orderRule = ''
  let tierLines: string[] = []
  const ruleLines: string[] = []
  const otherLines: string[] = []
  const orderRuleLines: string[] = []

  for (const line of lines) {
    const hasRule = /起订|MOQ|起订量|最低订货|最小起订|单款数量|单款单色/i.test(line)
    if (hasRule) {
      ruleLines.push(line)
      orderRuleLines.push(line)
    } else {
      otherLines.push(line)
    }
  }

  if (ruleLines.length > 0) {
    orderRule = ruleLines.join(' ').replace(/\s+/g, ' ').trim()
    tierLines = otherLines
  } else {
    orderRule = lines[0] || ''
    tierLines = lines.slice(1)
  }

  const tiers: PolicyTier[] = []
  const supplementaryNotes: string[] = []

  for (const rawLine of tierLines) {
    if (orderRuleLines.includes(rawLine)) continue
    const line = removeNoise(rawLine)
    if (!line) continue

    const thresholdMatch = line.match(/(\d+(?:\.\d+)?)\s*(?:\/\s*[\u53cc]|\/\s*[\u4ef6]|\/\s*[\u5957])?\s*(?:W|V|K|[\u4e00-\u9fa5][\u4e07][\u5143]?|[\u5143])/i)
    const priceMatch = line.match(/\d+(?:\.\d+)?\s*折/)

    const threshold = thresholdMatch ? thresholdMatch[0].replace(/\s+/g, '').replace(/[wv]$/i, 'W') : ''
    const price = priceMatch ? priceMatch[0].replace(/\s+/g, '') : ''

    if (!threshold && !price) {
      if (/^(?:\u6761\u6b3e\s*\d|\u5907\u6ce8|\u8bf4\u660e|\u6ce8[\uff1a:]|[\u3010]|\u534f\u8bae|\u653f\u7b56|\u89c4\u5219|\u6761\u6b3e)/.test(line) || line.length < 3) continue
      supplementaryNotes.push(line)
      continue
    }

    let note = line
    if (thresholdMatch) note = note.replace(thresholdMatch[0], '')
    if (priceMatch) note = note.replace(priceMatch[0], '')
    note = note.replace(/[\uff0c,]/g, ' ').replace(/[ \t]+/g, ' ').trim()

    tiers.push({ threshold, price, note: note || '' })
  }

  return {
    type: 'simple',
    sections: [],
    orderRule,
    tiers,
    supplementaryNotes: [...new Set(supplementaryNotes)]
  }
}

// ── 入口函数 ────────────────────────────

/**
 * 将非结构化政策文本解析为结构化JSON
 * @param input 原始文本（支持多行）
 */
export function parsePolicyText(input: string): PolicyStructure {
  // 检测格式类型
  if (isStructuredFormat(input)) {
    return parseStructured(input)
  }
  return parseSimple(input)
}