export function createRequestGuard(): { isActive(): boolean; cancel(): void } {
  let active = true
  return {
    isActive: () => active,
    cancel: () => { active = false },
  }
}

export function getSafeWorkbookDownloadName(title: string, fileType: 'xls' | 'xlsx'): string {
  const sanitized = title
    .replace(/[\\/:*?"<>|\u0000-\u001f]+/g, '-')
    .replace(/^[.\s-]+/, '')
    .replace(/[.\s-]+$/, '')
    .replace(/\.(?:xls|xlsx)$/i, '')
    .trim()
  return `${sanitized || 'Excel文档'}.${fileType}`
}
