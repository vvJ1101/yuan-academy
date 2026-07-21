import assert from 'node:assert/strict'
import { test } from 'node:test'
import { BRAND_LINKS, QUICK_LINKS, isSectionExpanded } from './sidebar-links'

test('ordering policy link opens the real policy page directly', () => {
  const ordering = BRAND_LINKS.find(link => link.type === 'ordering')
  assert.equal(ordering?.href, '/internal/policy')
})

test('brand contact link opens the brand page contact tab directly', () => {
  const contact = BRAND_LINKS.find(link => link.type === 'contact')
  assert.equal(contact?.href, '/internal/brand?type=contact')
})

test('quick links do not include the retired personal upload entry', () => {
  assert.equal(QUICK_LINKS.some(link => link.href === '/internal/documents'), false)
  assert.equal(QUICK_LINKS.some(link => link.label === '我的上传'), false)
})

test('active brand section can still be manually collapsed', () => {
  assert.equal(isSectionExpanded({ isActive: true, expanded: false, collapsed: false }), true)
  assert.equal(isSectionExpanded({ isActive: true, expanded: false, collapsed: true }), false)
  assert.equal(isSectionExpanded({ isActive: false, expanded: true, collapsed: false }), true)
})
