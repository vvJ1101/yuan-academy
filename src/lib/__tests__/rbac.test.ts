import test from 'node:test'
import assert from 'node:assert/strict'
import {
  clearPermissionCache,
  mergeRoleDataScopesForTest,
  permissionListHasForTest,
  uniquePermissionsForTest,
} from '../permissions/rbac'

test('clearPermissionCache can clear one user or all users without throwing', () => {
  assert.doesNotThrow(() => clearPermissionCache('user-1'))
  assert.doesNotThrow(() => clearPermissionCache())
})

test('uniquePermissionsForTest removes blanks and duplicates', () => {
  assert.deepEqual(
    uniquePermissionsForTest(['menu.brand', '', null, undefined, 'menu.brand', 'brandContact.edit']),
    ['menu.brand', 'brandContact.edit'],
  )
})

test('permissionListHasForTest supports wildcard and exact permission keys', () => {
  assert.equal(permissionListHasForTest(['*'], 'user.delete'), true)
  assert.equal(permissionListHasForTest(['user.delete'], 'user.delete'), true)
  assert.equal(permissionListHasForTest(['user.edit'], 'user.delete'), false)
})

test('mergeRoleDataScopesForTest keeps the broadest role scope and custom departments', () => {
  const scope = mergeRoleDataScopesForTest(
    [
      { dataScope: 5, customDeptIds: JSON.stringify(['dept-custom']) },
      { dataScope: 2, customDeptIds: '[]' },
    ],
    {
      id: 'user-1',
      role: 'staff',
      companyId: 'company-1',
      departmentId: 'dept-1',
    },
  )

  assert.equal(scope.mode, 'DEPARTMENT_AND_CHILDREN')
  assert.deepEqual(scope.companies, ['company-1'])
  assert.deepEqual(scope.departments.sort(), ['dept-1', 'dept-custom'])
  assert.deepEqual(scope.users, ['user-1'])
})

test('mergeRoleDataScopesForTest gives super admin all data scope', () => {
  const scope = mergeRoleDataScopesForTest(
    [{ dataScope: 4, customDeptIds: '[]' }],
    {
      id: 'admin-1',
      role: 'super_admin',
      companyId: null,
      departmentId: '',
    },
  )

  assert.equal(scope.mode, 'ALL')
})
