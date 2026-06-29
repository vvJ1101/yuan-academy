import client from './client'
import type { ApiResponse, MenuNode } from '@/types/role-management'

export const deptApi = {
  getTree() {
    return client.get<any, ApiResponse<MenuNode[]>>('/api/admin/depts/tree')
  },
}
