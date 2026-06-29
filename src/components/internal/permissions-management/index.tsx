'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Table, Button, Input, Space, Modal, Form, Tree, Radio, Tag, message,
  Popconfirm, Card, Breadcrumb, Select, Checkbox
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import type { DataNode } from 'antd/es/tree'
import {
  PlusOutlined, SearchOutlined, ReloadOutlined, EditOutlined, DeleteOutlined,
  SafetyOutlined, TeamOutlined, LockOutlined
} from '@ant-design/icons'
import { roleApi } from '@/api/role'
import { permissionApi } from '@/api/permission'
import { deptApi } from '@/api/dept'
import type { RoleVO, MenuNode, UserVO, DataScopeType } from '@/types/role-management'
import { DATA_SCOPE_LABELS } from '@/types/role-management'

// ── Convert menu tree to Ant Design Tree nodes ──
function toTreeNodes(menus: MenuNode[]): DataNode[] {
  return menus.map(m => ({
    key: m.id,
    title: (
      <span>
        {m.name}
        {m.type && (
          <Tag color={m.type === 3 ? 'blue' : m.type === 2 ? 'green' : 'orange'}
            style={{ marginLeft: 6, fontSize: 10, lineHeight: '16px', padding: '0 4px' }}>
            {m.type === 1 ? '目录' : m.type === 2 ? '菜单' : '按钮'}
          </Tag>
        )}
        {m.permission && <code style={{ marginLeft: 6, fontSize: 10, color: '#999' }}>{m.permission}</code>}
      </span>
    ),
    children: m.children ? toTreeNodes(m.children) : undefined,
    selectable: false,
  }))
}

export default function RoleManagementPage() {
function getAllKeys(nodes: DataNode[]): string[] {
  const keys: string[] = []
  for (const n of nodes) {
    keys.push(n.key as string)
    if (n.children) keys.push(...getAllKeys(n.children))
  }
  return keys
}

  // ── State ──
  const [roles, setRoles] = useState<RoleVO[]>([])
  const [loading, setLoading] = useState(false)
  const [searchText, setSearchText] = useState('')
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([])
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 })

  // Role form modal
  const [formOpen, setFormOpen] = useState(false)
  const [editingRole, setEditingRole] = useState<RoleVO | null>(null)
  const [formSubmitting, setFormSubmitting] = useState(false)
  const [form] = Form.useForm()

  // Permission modal
  const [permOpen, setPermOpen] = useState(false)
  const [permRoleId, setPermRoleId] = useState('')
  const [permTree, setPermTree] = useState<DataNode[]>([])
  const [permChecked, setPermChecked] = useState<string[]>([])
  const [permSaving, setPermSaving] = useState(false)
  const [permExpandAll, setPermExpandAll] = useState(true)

  // Data scope modal
  const [scopeOpen, setScopeOpen] = useState(false)
  const [scopeRoleId, setScopeRoleId] = useState('')
  const [scopeValue, setScopeValue] = useState<string>('SELF_AND_CHILDREN')
  const [scopeSaving, setScopeSaving] = useState(false)
  const [deptTree, setDeptTree] = useState<DataNode[]>([])
  const [scopeDeptIds, setScopeDeptIds] = useState<string[]>([])

  // User modal
  const [usersOpen, setUsersOpen] = useState(false)
  const [usersRoleId, setUsersRoleId] = useState('')
  const [usersRoleName, setUsersRoleName] = useState('')
  const [roleUsers, setRoleUsers] = useState<UserVO[]>([])
  const [usersLoading, setUsersLoading] = useState(false)
  const [usersPage, setUsersPage] = useState(1)
  const [usersTotal, setUsersTotal] = useState(0)
  const [addUserOpen, setAddUserOpen] = useState(false)
  const [allUsers, setAllUsers] = useState<UserVO[]>([])
  const [selectedNewUsers, setSelectedNewUsers] = useState<string[]>([])

  // ── Load roles ──
  const loadRoles = useCallback(async (page = 1, name?: string) => {
    setLoading(true)
    try {
      const res: any = await roleApi.getRoles({ page, size: pagination.pageSize, name: name || undefined })
      if (res.code === 0) {
        setRoles(res.data.list)
        setPagination(prev => ({ ...prev, current: page, total: res.data.total }))
      }
    } catch { message.error('获取角色列表失败') }
    setLoading(false)
  }, [pagination.pageSize])

  useEffect(() => { loadRoles() }, [loadRoles])

  // Search
  const handleSearch = () => { loadRoles(1, searchText) }
  const handleReset = () => { setSearchText(''); loadRoles() }

  // ── Add / Edit role ──
  const openAddForm = () => { setEditingRole(null); form.resetFields(); form.setFieldsValue({ status: 'active' }); setFormOpen(true) }
  const openEditForm = (r: RoleVO) => {
    setEditingRole(r)
    form.setFieldsValue({ name: r.name, code: r.code, description: r.description, status: r.status })
    setFormOpen(true)
  }

  const handleFormSubmit = async () => {
    try {
      const values = await form.validateFields()
      setFormSubmitting(true)
      if (editingRole) {
        const res: any = await roleApi.updateRole(editingRole.id, values)
        if (res.code === 0) message.success('更新成功')
      } else {
        const res: any = await roleApi.createRole(values)
        if (res.code === 0) message.success('创建成功')
        else { message.error(res.message || '创建失败'); setFormSubmitting(false); return }
      }
      setFormOpen(false); setFormSubmitting(false); loadRoles()
    } catch { setFormSubmitting(false) }
  }

  // ── Delete role ──
  const handleDelete = async (r: RoleVO) => {
    if (r.userCount > 0) { message.error('该角色下存在用户，无法删除'); return }
    try {
      const res: any = await roleApi.deleteRole(r.id)
      if (res.code === 0) message.success(`已删除「${r.name}」`)
      loadRoles()
    } catch { message.error('删除失败') }
  }

  // ── Batch delete ──
  const handleBatchDelete = async () => {
    const deletable = selectedRowKeys.filter(k => roles.find(r => r.id === k)?.userCount === 0)
    if (deletable.length === 0) { message.warning('选中的角色均有用户关联，无法删除'); return }
    for (const id of deletable) { await roleApi.deleteRole(id as string) }
    message.success(`已删除 ${deletable.length} 个角色`)
    setSelectedRowKeys([]); loadRoles()
  }

  // ── Permissions ──
  const openPermModal = async (r: RoleVO) => {
    setPermRoleId(r.id); setPermOpen(true); setPermExpandAll(true)
    try {
      const [treeRes, permRes]: any[] = await Promise.all([
        permissionApi.getTree(),
        roleApi.getPermissions(r.id),
      ])
      if (treeRes.code === 0) setPermTree(toTreeNodes(treeRes.data))
      if (permRes.code === 0) setPermChecked(permRes.data)
    } catch { message.error('加载权限数据失败') }
  }

  const handleSavePerm = async () => {
    setPermSaving(true)
    try {
      const res: any = await roleApi.assignPermissions(permRoleId, permChecked)
      if (res.code === 0) message.success('权限分配成功')
    } catch { message.error('保存失败') }
    setPermSaving(false); setPermOpen(false)
  }

  // ── Data scope ──
  const openScopeModal = async (r: RoleVO) => {
    setScopeRoleId(r.id); setScopeValue(r.dataScope); setScopeOpen(true)
    try {
      const scopeLabels: Record<string, number> = { ALL: 1, SELF_AND_CHILDREN: 2, SELF: 3, PERSONAL: 4, CUSTOM: 5 }
      const deptRes: any = await deptApi.getTree()
      if (deptRes.code === 0) setDeptTree(toTreeNodes(deptRes.data))
    } catch {}
  }

  const handleSaveScope = async () => {
    setScopeSaving(true)
    try {
      const res: any = await roleApi.updateDataScope(scopeRoleId, scopeValue as DataScopeType, scopeValue === 'CUSTOM' ? scopeDeptIds : undefined)
      if (res.code === 0) message.success('数据权限更新成功')
    } catch { message.error('保存失败') }
    setScopeSaving(false); setScopeOpen(false); loadRoles()
  }

  // ── Users ──
  const openUsersModal = async (r: RoleVO) => {
    setUsersRoleId(r.id); setUsersRoleName(r.name); setUsersOpen(true); setUsersPage(1)
    await loadRoleUsers(r.id, 1)
  }

  const loadRoleUsers = async (roleId: string, page: number) => {
    setUsersLoading(true)
    try {
      const res: any = await roleApi.getUsers(roleId, { page, size: 10 })
      if (res.code === 0) { setRoleUsers(res.data.list); setUsersTotal(res.data.total); setUsersPage(page) }
    } catch {}
    setUsersLoading(false)
  }

  const handleAddUsers = async () => {
    if (selectedNewUsers.length === 0) return
    try {
      const res: any = await roleApi.addUsers(usersRoleId, selectedNewUsers)
      if (res.code === 0) { message.success(res.message || '添加成功'); setAddUserOpen(false); setSelectedNewUsers([]) }
      await loadRoleUsers(usersRoleId, usersPage)
    } catch { message.error('添加失败') }
  }

  const handleRemoveUser = async (userId: string) => {
    try {
      const res: any = await roleApi.removeUser(usersRoleId, userId)
      if (res.code === 0) message.success('已移除用户')
      await loadRoleUsers(usersRoleId, usersPage)
    } catch {}
  }

  // ── Columns ──
  const columns: ColumnsType<RoleVO> = [
    { title: '角色名称', dataIndex: 'name', width: 120 },
    { title: '角色标识', dataIndex: 'code', width: 120 },
    { title: '角色描述', dataIndex: 'description', width: 200, render: (v: string) => v || '-' },
    { title: '数据权限', dataIndex: 'dataScope', width: 120, render: (v: string) => DATA_SCOPE_LABELS[v] || v },
    { title: '创建时间', dataIndex: 'createTime', width: 180 },
    {
      title: '操作', width: 420, fixed: 'right' as const, render: (_, r) => (
        <Space size={0} wrap>
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => openEditForm(r)} style={{ color: '#1890ff' }}>编辑</Button>
          <Popconfirm title={`确定要删除「${r.name}」？`} onConfirm={() => handleDelete(r)} okText="确定" cancelText="取消">
            <Button type="link" size="small" icon={<DeleteOutlined />} danger>删除</Button>
          </Popconfirm>
          <Button type="link" size="small" icon={<SafetyOutlined />} onClick={() => openPermModal(r)} style={{ color: '#fa8c16' }}>分配权限</Button>
          <Button type="link" size="small" icon={<LockOutlined />} onClick={() => openScopeModal(r)} style={{ color: '#52c41a' }}>数据权限</Button>
          <Button type="link" size="small" icon={<TeamOutlined />} onClick={() => openUsersModal(r)} style={{ color: '#722ed1' }}>选择用户</Button>
        </Space>
      )
    },
  ]

  return (
    <Card style={{ margin: 0, borderRadius: 8, boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
      <Breadcrumb style={{ marginBottom: 16 }} items={[{ title: '系统管理' }, { title: '角色管理' }]} />

      {/* Toolbar */}
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <Space>
          <Input placeholder="角色名称" value={searchText} onChange={e => setSearchText(e.target.value)} style={{ width: 200 }} allowClear />
          <Button icon={<SearchOutlined />} onClick={handleSearch}>搜索</Button>
          <Button icon={<ReloadOutlined />} onClick={handleReset}>重置</Button>
        </Space>
        <Space>
          {selectedRowKeys.length > 0 && (
            <Popconfirm title={`确定删除选中的 ${selectedRowKeys.length} 个角色？`} onConfirm={handleBatchDelete}>
              <Button danger>批量删除 ({selectedRowKeys.length})</Button>
            </Popconfirm>
          )}
          <Button type="primary" icon={<PlusOutlined />} onClick={openAddForm}>添加角色</Button>
        </Space>
      </div>

      {/* Table */}
      <Table
        rowKey="id" columns={columns} dataSource={roles} loading={loading}
        scroll={{ x: 1100 }}
        rowSelection={{ selectedRowKeys, onChange: setSelectedRowKeys }}
        pagination={{
          ...pagination, showSizeChanger: true, pageSizeOptions: ['10', '20', '50', '100'],
          showTotal: (t) => `共 ${t} 条`,
          onChange: (page, size) => { setPagination(prev => ({ ...prev, current: page, pageSize: size })); loadRoles(page, searchText) },
        }}
      />

      {/* ── Add / Edit Modal ── */}
      <Modal title={editingRole ? '编辑角色' : '添加角色'} open={formOpen} onCancel={() => setFormOpen(false)}
        onOk={handleFormSubmit} confirmLoading={formSubmitting} destroyOnClose>
        <Form form={form} layout="vertical" preserve={false}>
          <Form.Item label="角色名称" name="name" rules={[{ required: true, message: '请输入角色名称' }]}>
            <Input placeholder="请输入角色名称" />
          </Form.Item>
          <Form.Item label="角色标识" name="code" rules={[{ required: true, message: '请输入角色标识' }, { pattern: /^[A-Z][A-Z0-9_]*$/, message: '仅允许大写英文和下划线' }]}>
            <Input placeholder="英文或拼音" disabled={!!editingRole} />
          </Form.Item>
          <Form.Item label="角色描述" name="description">
            <Input.TextArea rows={3} placeholder="选填" />
          </Form.Item>
          <Form.Item label="状态" name="status" initialValue="active">
            <Radio.Group><Radio value="active">启用</Radio><Radio value="disabled">禁用</Radio></Radio.Group>
          </Form.Item>
        </Form>
      </Modal>

      {/* ── Permission Modal ── */}
      <Modal title="分配权限" open={permOpen} onCancel={() => setPermOpen(false)}
        onOk={handleSavePerm} confirmLoading={permSaving} width={640} destroyOnClose>
        <div style={{ marginBottom: 12 }}>
          <Button size="small" onClick={() => setPermExpandAll(!permExpandAll)}>
            {permExpandAll ? '收起全部' : '展开全部'}
          </Button>
          <Button size="small" style={{ marginLeft: 8 }} onClick={() => {
            const allKeys = getAllKeys(permTree)
            setPermChecked(permChecked.length === allKeys.length ? [] : allKeys)
          }}>{permChecked.length === getAllKeys(permTree).length ? "取消全选" : "全选"}</Button>
        </div>
        <Tree key={permExpandAll ? "e" : "c"} checkable checkStrictly defaultExpandAll={permExpandAll} checkedKeys={permChecked}
          onCheck={(keys) => {
            // checkStrictly 模式下 onCheck 返回 { checked, halfChecked }，需要提取 checked
            const rawKeys = Array.isArray(keys) ? keys : keys.checked
            setPermChecked(rawKeys.map(String))
          }} treeData={permTree}
          style={{ maxHeight: 400, overflow: 'auto' }} />
      </Modal>

      {/* ── Data Scope Modal ── */}
      <Modal title="数据权限" open={scopeOpen} onCancel={() => setScopeOpen(false)}
        onOk={handleSaveScope} confirmLoading={scopeSaving} destroyOnClose>
        <div style={{ marginBottom: 12 }}>
          <Button size="small" onClick={() => {
            const allKeys = getAllKeys(deptTree)
            setScopeDeptIds(scopeDeptIds.length === allKeys.length ? [] : allKeys)
          }}>{scopeDeptIds.length === (deptTree.length ? getAllKeys(deptTree).length : 0) ? '取消全选' : '全选'}</Button>
        </div>
        <div style={{ padding: '4px 0' }}>
          <div style={{ fontSize: 13, fontWeight: 500, color: '#333', marginBottom: 8 }}>可见部门</div>
          <Tree checkable defaultExpandAll checkedKeys={scopeDeptIds}
            onCheck={(keys) => setScopeDeptIds(keys as string[])}
            treeData={deptTree}
            style={{ maxHeight: 360, overflow: 'auto', padding: 8, border: '1px solid #d9d9d9', borderRadius: 6 }} />
        </div>
        <div style={{ marginTop: 8, fontSize: 12, color: '#999', lineHeight: 1.6 }}>
          勾选的部门，该角色下的用户将能看到其知识空间中的文档。<br />
          如需更精细的权限控制，可在具体文件夹的右键菜单中设置。
        </div>
      </Modal>

      {/* ── User Modal ── */}
      <Modal title={`关联用户 - ${usersRoleName}`} open={usersOpen} onCancel={() => setUsersOpen(false)}
        footer={[
          <Button key="close" onClick={() => setUsersOpen(false)}>关闭</Button>,
          <Button key="add" type="primary" icon={<PlusOutlined />} onClick={async () => {
            setAddUserOpen(true); setSelectedNewUsers([])
            try {
              const res: any = await fetch('/api/users').then(r => r.json())
              const all: UserVO[] = Array.isArray(res) ? res : (res.users || res.data || [])
              setAllUsers(all.filter((u: any) => !roleUsers.some(ru => ru.id === u.id)))
            } catch {}
          }}>添加用户</Button>,
        ]} width={700} destroyOnClose>
        <Table rowKey="id" loading={usersLoading} dataSource={roleUsers}
          columns={[
            { title: '姓名', dataIndex: 'name', width: 100 },
            { title: '账号', dataIndex: 'email', width: 200 },
            { title: '部门', dataIndex: 'department', width: 120 },
            { title: '添加时间', dataIndex: 'addedAt', width: 180 },
            { title: '操作', width: 80, render: (_, u: any) => (
              <Popconfirm title="确定移除？" onConfirm={() => handleRemoveUser(u.id)}>
                <Button type="link" size="small" danger>移除</Button>
              </Popconfirm>
            )},
          ]}
          pagination={{ current: usersPage, total: usersTotal, pageSize: 10, onChange: (p) => loadRoleUsers(usersRoleId, p) }}
          size="small" locale={{ emptyText: '暂无关联用户' }} />
      </Modal>

      {/* ── Add User Sub-modal ── */}
      <Modal title="选择用户" open={addUserOpen} onCancel={() => { setAddUserOpen(false); setSelectedNewUsers([]) }}
        onOk={handleAddUsers} okText="添加" destroyOnClose>
        <Checkbox.Group value={selectedNewUsers} onChange={setSelectedNewUsers}
          style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 400, overflow: 'auto' }}>
          {allUsers.map(u => (
            <Checkbox key={u.id} value={u.id}>{u.name} ({u.email}) - {u.department}</Checkbox>
          ))}
        </Checkbox.Group>
        {allUsers.length === 0 && <div style={{ textAlign: 'center', padding: 20, color: '#999' }}>所有用户已添加</div>}
      </Modal>

      <style>{`
        .ant-btn-link { padding: 0 4px; }
        .ant-table-row:hover { background-color: #fafafa; }
      `}</style>
    </Card>
  )
}
