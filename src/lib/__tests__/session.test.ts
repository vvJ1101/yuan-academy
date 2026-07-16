import assert from 'node:assert/strict'
import test from 'node:test'

import {
  getJwtSecret,
  readVerifiedSession,
  signSessionToken,
  type SessionClaims,
} from '../session'

const SECRET = 'academy-test-secret-at-least-32-characters'

const user: SessionClaims = {
  id: 'user-1',
  name: '测试用户',
  role: 'viewer',
  companyId: 'company-1',
  companyName: '测试公司',
  departmentId: 'department-1',
  departmentName: '测试部门',
}

test('接受使用当前密钥签发的有效会话', async () => {
  const token = await signSessionToken(user, SECRET)
  const session = await readVerifiedSession(`session=${encodeURIComponent(token)}`, SECRET)

  assert.deepEqual(session, user)
})

test('拒绝被篡改的 JWT 会话', async () => {
  const token = await signSessionToken(user, SECRET)
  const [header, payload, signature] = token.split('.')
  const changed = Buffer.from(JSON.stringify({ ...user, role: 'super_admin' })).toString('base64url')

  const session = await readVerifiedSession(
    `session=${encodeURIComponent(`${header}.${changed}.${signature}`)}`,
    SECRET,
  )

  assert.equal(session, null)
})

test('拒绝未签名的旧版 JSON Cookie', async () => {
  const legacyCookie = `session=${encodeURIComponent(JSON.stringify(user))}`

  const session = await readVerifiedSession(legacyCookie, SECRET)

  assert.equal(session, null)
})

test('未配置 JWT_SECRET 时给出明确错误', () => {
  assert.throws(
    () => getJwtSecret(''),
    /JWT_SECRET 未配置，无法安全签发或验证会话/,
  )
})
