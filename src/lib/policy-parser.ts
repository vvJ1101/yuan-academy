/**
 * 订货政策结构化解析引擎 v1
 * 
 * 将非结构化文本 → 结构化 { orderRule, tiers[] }
 * 严格规则驱动，无 AI 推测
 */

export interface PolicyTier {
  threshold: string
  price: string
  note: string
}

export interface PolicyStructure {
  orderRule: string
  tiers: PolicyTier[]
}

// ── 清洗工具 ──

/** 删除中英文逗号、多余空格 */
function cleanText(raw: string): string {
  return raw
    .replace(/[,，]/g, ' ')   // 逗号→空格
    .replace(/[ \t]+/g, ' ')   // 多余空格/tab→单空格（保留换行）
    .trim()
}

/** 常见噪声词：出现在行首的可安全移除的标签词 */
const NOISE_WORDS = [
  '订货买手价', '买手订货价', '订货价', '买手价', '订货政策',
  'Order Policy', '价格阶梯', '订货阶梯',
]

function removeNoise(line: string): string {
  for (const w of NOISE_WORDS) {
    // 只移除行首或紧跟行首的噪声词（后面可能还有内容）
    const re = new RegExp('^' + w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*')
    line = line.replace(re, '')
  }
  return line.trim()
}

// ── 匹配正则 ──

/** 阈值匹配：数字+W/K/万/万元/元 */
const THRESHOLD_RE = /\d+(?:\.\d+)?\s*(?:W|K|万|万元|元)/

/** 折扣匹配：数字+折 */
const PRICE_RE = /\d+(?:\.\d+)?\s*折/

// ── 核心解析 ──

/**
 * 将非结构化政策文本解析为结构化JSON
 * @param input 原始文本（支持多行）
 */
export function parsePolicyText(input: string): PolicyStructure {
  // 1. 清洗
  const cleaned = cleanText(input)
  const lines = cleaned.split('\n').map(l => l.trim()).filter(Boolean)

  // 2. 识别 orderRule
  // 优先取第一行
  let orderRule = ''
  let tierLines: string[] = []

  // 找包含起订/起订量/MOQ的行
  const ruleLines: string[] = []
  const otherLines: string[] = []

  for (const line of lines) {
    const hasRule = /起订|MOQ|起订量|最低订货|最小起订/i.test(line)
    if (hasRule) {
      ruleLines.push(line)
    } else {
      otherLines.push(line)
    }
  }

  if (ruleLines.length > 0) {
    orderRule = ruleLines.join(' ').replace(/\s+/g, ' ').trim()
    tierLines = otherLines
  } else {
    // 没有明确的行，取第一行为 orderRule
    orderRule = lines[0] || ''
    tierLines = lines.slice(1)
  }

  // 3. 解析 tiers
  const tiers: PolicyTier[] = []

  for (const rawLine of tierLines) {
    const line = removeNoise(rawLine)
    if (!line) continue

    const thresholdMatch = line.match(THRESHOLD_RE)
    const priceMatch = line.match(PRICE_RE)

    const threshold = thresholdMatch ? thresholdMatch[0].replace(/\s+/g, '') : ''
    const price = priceMatch ? priceMatch[0].replace(/\s+/g, '') : ''

    // 提取 note：从行中移除 threshold 和 price 后剩余内容
    let note = line
    if (threshold) note = note.replace(thresholdMatch![0], '')
    if (price) note = note.replace(priceMatch![0], '')
    note = cleanText(note)

    // 如果 threshold 和 price 都为空，整行作为 note
    tiers.push({
      threshold,
      price,
      note: note || '',
    })
  }

  return { orderRule, tiers }
}
