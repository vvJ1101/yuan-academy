import client from './client'
import type { ApiResponse, PageData, RoleVO, DataScopeType, UserVO } from '@/types/role-management'
const BASE = '/api/admin/roles'

export const roleApi = {
  getRoles(params: { page: number; size: number; name?: string }) {
    return client.get<any, ApiResponse<PageData<RoleVO>>>(BASE, { params })
  },
  createRole(data: { name: string; code: string; description?: string; status: string }) {
    return client.post<any, ApiResponse<null>>(BASE, data)
  },
  updateRole(id: string, data: { name?: string; description?: string; status?: string }) {
    return client.put<any, ApiResponse<null>>(`${BASE}/${id}`, data)
  },
  deleteRole(id: string) {
    return client.delete<any, ApiResponse<null>>(`${BASE}/${id}`)
  },
  getPermissions(roleId: string) {
    return client.get<any, ApiResponse<string[]>>(`${BASE}/${roleId}/permissions`)
  },
  assignPermissions(roleId: string, permissionIds: string[]) {
    return client.put<any, ApiResponse<null>>(`${BASE}/${roleId}/permissions`, { permissionIds })
  },
  updateDataScope(roleId: string, dataScope: DataScopeType, customDeptIds?: string[]) {
    return client.put<any, ApiResponse<null>>(`${BASE}/${roleId}/dataScope`, { dataScope, customDeptIds })
  },
  getUsers(roleId: string, params: { page: number; size: number }) {
    return client.get<any, ApiResponse<PageData<UserVO>>>(`${BASE}/${roleId}/users`, { params })
  },
  addUsers(roleId: string, userIds: string[]) {
    return client.post<any, ApiResponse<null>>(`${BASE}/${roleId}/users`, { userIds })
  },
  removeUser(roleId: string, userId: string) {
    return client.delete<any, ApiResponse<null>>(`${BASE}/${roleId}/users/${userId}`)
  },
}
