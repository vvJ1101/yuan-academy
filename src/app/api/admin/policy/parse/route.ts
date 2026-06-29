import { NextRequest, NextResponse } from 'next/server'
import { parsePolicyText } from '@/lib/policy-parser'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const { text } = await req.json()
  if (!text || typeof text !== 'string') {
    return NextResponse.json({ error: '请提供 text 字段' }, { status: 400 })
  }
  const result = parsePolicyText(text)
  return NextResponse.json({ code: 0, data: result })
}
