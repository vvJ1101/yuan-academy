import { NextRequest, NextResponse } from 'next/server'
import { prisma, getSessionFromCookies } from '@/lib/auth'
import { ocrDocumentImages } from '@/lib/ocr'

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = getSessionFromCookies(req.headers.get('cookie'))
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.role !== 'super_admin' && session.role !== 'dept_admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const doc = await prisma.document.findUnique({
    where: { id: params.id },
    select: { id: true, title: true, extractedJson: true },
  })
  if (!doc) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Run OCR on all images in the document's upload directory
  let ocrResults: any[] = []
  try {
    ocrResults = await ocrDocumentImages(params.id)
  } catch (err: any) {
    return NextResponse.json({ error: `OCR 失败: ${err.message || '未知错误'}` }, { status: 500 })
  }

  if (ocrResults.length === 0) {
    return NextResponse.json({ ok: true, message: '没有找到可识别的图片', results: [] })
  }

  // Merge OCR results into extractedJson
  let extracted: any = {}
  try {
    if (doc.extractedJson) extracted = JSON.parse(doc.extractedJson)
  } catch { extracted = {} }

  // Map OCR text onto existing images array
  const existingImages: any[] = extracted.images || []
  for (const ocr of ocrResults) {
    const existing = existingImages.find((img: any) => img.src === ocr.imagePath)
    if (existing) {
      existing.ocrText = ocr.text
      existing.ocrConfidence = ocr.confidence
    } else {
      existingImages.push({
        src: ocr.imagePath,
        ocrText: ocr.text,
        ocrConfidence: ocr.confidence,
      })
    }
  }
  extracted.images = existingImages

  // Build OCR summary for FTS indexing
  const ocrTexts = ocrResults.filter(r => r.text).map(r => r.text)
  extracted.ocrSummary = ocrTexts.join('\n')
  extracted.ocrAt = new Date().toISOString()

  await prisma.document.update({
    where: { id: params.id },
    data: { extractedJson: JSON.stringify(extracted) },
  })

  // Append OCR text to fullContent for FTS5 searchability
  if (ocrTexts.length > 0) {
    const current = await prisma.document.findUnique({
      where: { id: params.id },
      select: { fullContent: true },
    })
    const ocrAppendix = '\n\n---\n## 图片 OCR 识别文本\n\n' + ocrTexts.map((t, i) => `**图片 ${i + 1}**: ${t}`).join('\n\n')
    const updatedContent = (current?.fullContent || '') + ocrAppendix
    await prisma.document.update({
      where: { id: params.id },
      data: { fullContent: updatedContent.substring(0, 100000) },
    })
  }

  return NextResponse.json({
    ok: true,
    imageCount: ocrResults.length,
    ocrTexts: ocrResults.filter(r => r.text).map(r => ({ text: r.text.substring(0, 120), confidence: r.confidence })),
    totalChars: ocrTexts.reduce((sum, t) => sum + t.length, 0),
  })
}
