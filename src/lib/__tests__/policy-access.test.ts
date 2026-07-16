import assert from 'node:assert/strict'
import test from 'node:test'

import {
  MAX_POLICY_TEXT_LENGTH,
  validatePolicyParseRequest,
} from '../policy-access'
import type { SessionClaims } from '../session'

const viewer: SessionClaims = {
  id: 'viewer-1',
  role: 'viewer',
  companyId: 'company-1',
  companyName: '时胜',
  departmentId: 'department-1',
  departmentName: '品牌部',
}

const editor: SessionClaims = {
  ...viewer,
  id: 'editor-1',
  role: 'dept_admin',
}

test('未登录用户不能解析政策', () => {
  assert.deepEqual(validatePolicyParseRequest(null, { text: '政策内容' }), {
    ok: false,
    status: 401,
    error: '请先登录',
  })
})

test('普通查看者不能解析政策', () => {
  assert.deepEqual(validatePolicyParseRequest(viewer, { text: '政策内容' }), {
    ok: false,
    status: 403,
    error: '无权解析订货政策',
  })
})

test('时胜品牌部管理员可以解析有效政策', () => {
  assert.deepEqual(validatePolicyParseRequest(editor, { text: '  政策内容  ' }), {
    ok: true,
    text: '政策内容',
  })
})

test('拒绝空政策文本', () => {
  assert.deepEqual(validatePolicyParseRequest(editor, { text: '   ' }), {
    ok: false,
    status: 400,
    error: '政策文本为空或超过允许长度',
  })
})

test('拒绝超过允许长度的政策文本', () => {
  const text = '政'.repeat(MAX_POLICY_TEXT_LENGTH + 1)

  assert.deepEqual(validatePolicyParseRequest(editor, { text }), {
    ok: false,
    status: 400,
    error: '政策文本为空或超过允许长度',
  })
})
