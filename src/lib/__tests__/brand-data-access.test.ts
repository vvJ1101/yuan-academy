import assert from 'node:assert/strict'
import { test } from 'node:test'
import { getContactViewFromPermissions, canUploadContactFromPermissions } from '../brand-data-access'

test('contact view follows assigned permissions instead of department name', () => {
  assert.equal(getContactViewFromPermissions([], 'staff'), null)
  assert.equal(getContactViewFromPermissions(['brandContact.viewMarketFields'], 'staff'), 'market')
  assert.equal(getContactViewFromPermissions(['brandContact.viewFullFields'], 'staff'), 'full')
  assert.equal(getContactViewFromPermissions(['*'], 'staff'), 'full')
  assert.equal(getContactViewFromPermissions([], 'super_admin'), 'full')
})

test('contact upload follows upload permission instead of department name', () => {
  assert.equal(canUploadContactFromPermissions([], 'staff'), false)
  assert.equal(canUploadContactFromPermissions(['brandContact.upload'], 'staff'), true)
  assert.equal(canUploadContactFromPermissions(['*'], 'staff'), true)
  assert.equal(canUploadContactFromPermissions([], 'super_admin'), true)
})
