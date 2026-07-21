import assert from 'node:assert/strict'
import { test } from 'node:test'
import { BRAND_LINKS, QUICK_LINKS } from './sidebar-links'

test('ordering policy link opens the real policy page directly', () => {
  const ordering = BRAND_LINKS.find(link => link.type === 'ordering')
  assert.equal(ordering?.href, '/internal/policy')
})

test('quick links do not include the retired personal upload entry', () => {
  assert.equal(QUICK_LINKS.some(link => link.href === '/internal/documents'), false)
  assert.equal(QUICK_LINKS.some(link => link.label === '我的上传'), false)
})
