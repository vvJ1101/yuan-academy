import assert from 'node:assert/strict'
import { test } from 'node:test'
import { BRAND_LINKS } from './sidebar-links'

test('ordering policy link opens the real policy page directly', () => {
  const ordering = BRAND_LINKS.find(link => link.type === 'ordering')
  assert.equal(ordering?.href, '/internal/policy')
})
