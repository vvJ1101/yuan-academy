import test from 'node:test'
import assert from 'node:assert/strict'
import { hasResolvedPermission } from '../permissions/guards'

test('hasResolvedPermission supports wildcard and exact keys', () => {
  assert.equal(hasResolvedPermission(['*'], 'folder.delete'), true)
  assert.equal(hasResolvedPermission(['folder.delete'], 'folder.delete'), true)
  assert.equal(hasResolvedPermission(['folder.edit'], 'folder.delete'), false)
})

test('hasResolvedPermission treats empty permissions as denied', () => {
  assert.equal(hasResolvedPermission([], 'user.create'), false)
})
