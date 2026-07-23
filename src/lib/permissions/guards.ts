import { NextResponse } from 'next/server'
import type { SessionUser } from '../auth'
import { getUserPermissions, type PermissionDataScope } from './rbac'

export type PermissionGuardSuccess = {
  ok: true
  permissions: string[]
  dataScope: PermissionDataScope
}

export type PermissionGuardFailure = {
  ok: false
  response: NextResponse
}

export type PermissionGuardResult = PermissionGuardSuccess | PermissionGuardFailure

export function hasResolvedPermission(permissions: Iterable<string>, key: string): boolean {
  const permissionSet = new Set(permissions)
  return permissionSet.has('*') || permissionSet.has(key)
}

export async function requirePermission(
  session: SessionUser | null,
  key: string,
  message = '无权执行该操作',
): Promise<PermissionGuardResult> {
  if (!session?.id) {
    return {
      ok: false,
      response: NextResponse.json({ error: '请先登录' }, { status: 401 }),
    }
  }

  const { permissions, dataScope } = await getUserPermissions(session)
  if (!hasResolvedPermission(permissions, key)) {
    return {
      ok: false,
      response: NextResponse.json({ error: message }, { status: 403 }),
    }
  }

  return { ok: true, permissions, dataScope }
}

export async function requireAnyPermission(
  session: SessionUser | null,
  keys: string[],
  message = '无权执行该操作',
): Promise<PermissionGuardResult> {
  if (!session?.id) {
    return {
      ok: false,
      response: NextResponse.json({ error: '请先登录' }, { status: 401 }),
    }
  }

  const { permissions, dataScope } = await getUserPermissions(session)
  if (!keys.some(key => hasResolvedPermission(permissions, key))) {
    return {
      ok: false,
      response: NextResponse.json({ error: message }, { status: 403 }),
    }
  }

  return { ok: true, permissions, dataScope }
}
