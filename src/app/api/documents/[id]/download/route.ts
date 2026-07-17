import { NextRequest } from 'next/server'

import { GET as getDocumentFile } from '../file/route'

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const url = new URL(req.url)
  url.pathname = `/api/documents/${encodeURIComponent(params.id)}/file`
  url.search = 'variant=original&disposition=attachment&purpose=read'
  return getDocumentFile(new NextRequest(url, req), { params })
}
