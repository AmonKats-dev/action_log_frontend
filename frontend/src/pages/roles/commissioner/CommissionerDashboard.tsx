import React, { useEffect, useState } from 'react';
import { Layout, Menu, Card, Table, Button, Space, Input, Select, Modal, Form, message, Tooltip, DatePicker, Tag } from 'antd';
import { FileTextOutlined, SettingOutlined, PlusOutlined, UserSwitchOutlined, UserAddOutlined, DeleteOutlined, ClockCircleOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { useAuth } from '../../../auth/AuthContext';
import { actionLogService } from '../../../services/actionLogService';
import { departmentService } from '../../../services/departmentService';
import { userService } from '../../../services/userService';
import { delegationService, Delegation, CreateDelegationRequest } from '../../../services/delegationService';
import { ActionLog } from '../../../types/actionLog';
import { Department, DepartmentUnit } from '../../../types/department';
import { User } from '../../../types/user';
import UserDisplay from '../../../components/UserDisplay';
import DelegationStatus from '../../../components/DelegationStatus';
import dayjs from 'dayjs';

const { Sider, Content } = Layout;

const CommissionerDashboard: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [actionLogs, setActionLogs] = useState<ActionLog[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [departmentUnits, setDepartmentUnits] = useState<DepartmentUnit[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [delegations, setDelegations] = useState<Delegation[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedMenuKey, setSelectedMenuKey] = useState('actionLogs');
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [assignModalVisible, setAssignModalVisible] = useState(false);
  const [statusModalVisible, setStatusModalVisible] = useState(false);
  const [delegationModalVisible, setDelegationModalVisible] = useState(false);
  const [selectedLog, setSelectedLog] = useState<ActionLog | null>(null);
  const [form] = Form.useForm();
  const [assignForm] = Form.useForm();
  const [statusForm] = Form.useForm();
  const [delegationForm] = Form.useForm();
  const [unitFilter, setUnitFilter] = useState<'all' | number>('all');
  const [approvalModalVisible, setApprovalModalVisible] = useState(false);
  const [rejectModalVisible, setRejectModalVisible] = useState(false);
  const [approving, setApproving] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [approvalForm] = Form.useForm();
  const [rejectForm] = Form.useForm();
  const [revokingDelegations, setRevokingDelegations] = useState<Set<number>>(new Set());

  useEffect(() => {
    initializeData();
  }, []);

  // Ensure unitFilter updates when user loads
  useEffect(() => {
    if (user?.department_unit?.id) {
      setUnitFilter(user.department_unit.id);
    }
  }, [user]);

  const initializeData = async () => {
    try {
      await Promise.all([
        fetchActionLogs(),
        fetchDepartments(),
        fetchDepartmentUnits(),
        fetchUsers(),
        fetchDelegations()
      ]);
    } catch (error) {
      console.error('Error initializing data:', error);
      message.error('Failed to load initial data');
    } finally {
      setLoading(false);
    }
  };

  const fetchActionLogs = async () => {
    try {
      const response = await actionLogService.getAll();
      setActionLogs(response);
    } catch (error) {
      console.error('Error fetching action logs:', error);
      message.error('Failed to fetch action logs');
    }
  };

  const fetchDepartments = async () => {
    try {
      const response = await departmentService.getAll();
      setDepartments(Array.isArray(response) ? response : response.results || []);
    } catch (error) {
      console.error('Error fetching departments:', error);
      message.error('Failed to fetch departments');
    }
  };

  const fetchDepartmentUnits = async () => {
    try {
      const response = await departmentService.getAll();
      setDepartmentUnits(Array.isArray(response) ? response : response.results || []);
    } catch (error) {
      console.error('Error fetching department units:', error);
      message.error('Failed to fetch department units');
    }
  };

  const fetchUsers = async () => {
    try {
      const response = await userService.getAll();
      setUsers(Array.isArray(response) ? response : response.results || []);
    } catch (error) {
      console.error('Error fetching users:', error);
      message.error('Failed to fetch users');
    }
  };

  const fetchDelegations = async () => {
    try {
      const response = await delegationService.getAll();
      setDelegations(response);
    } catch (error) {
      console.error('Error fetching delegations:', error);
      message.error('Failed to fetch delegations');
    }
  };

  const handleCreateDelegation = async (values: any) => {
    try {
      const delegationData: CreateDelegationRequest = {
        delegated_to_id: values.delegated_to_id,
        expires_at: values.expires_at ? dayjs(values.expires_at).format('YYYY-MM-DDTHH:mm:ss') : undefined,
        reason: values.reason
      };
      
      await delegationService.create(delegationData);
      message.success('Delegation created successfully');
      setDelegationModalVisible(false);
      delegationForm.resetFields();
      fetchDelegations();
    } catch (error) {
      console.error('Error creating delegation:', error);
      message.error('Failed to create delegation');
    }
  };

  const handleRevokeDelegation = async (delegationId: number) => {
    try {
      // Add to revoking set
      setRevokingDelegations(prev => new Set(prev).add(delegationId));
      
      await delegationService.revoke(delegationId);
      message.success('Delegation revoked successfully');
      fetchDelegations();
    } catch (error) {
      console.error('Error revoking delegation:', error);
      message.error('Failed to revoke delegation');
    } finally {
      // Remove from revoking set
      setRevokingDelegations(prev => {
        const newSet = new Set(prev);
        newSet.delete(delegationId);
        return newSet;
      });
    }
  };

  const handleDeleteDelegation = async (delegationId: number) => {
    try {
      await delegationService.delete(delegationId);
      message.success('Delegation deleted successfully');
      fetchDelegations();
    } catch (error) {
      console.error('Error deleting delegation:', error);
      message.error('Failed to delete delegation');
    }
  };

  const handleCreate = async (values: any) => {
    try {
      await actionLogService.create(values);
      message.success('Action log created successfully');
      setCreateModalVisible(false);
      form.resetFields();
      fetchActionLogs();
    } catch (error) {
      console.error('Error creating action log:', error);
      message.error('Failed to create action log');
    }
  };

  const handleAssign = async (values: any) => {
    try {
      if (!selectedLog) return;
      
      const updateData = {
        assigned_to: values.assigned_to.map((id: string | number) => parseInt(id.toString())),
        ...(selectedLog.assigned_to && values.due_date ? { due_date: values.due_date } : {})
      };

      await actionLogService.update(selectedLog.id, updateData);
      message.success(selectedLog.assigned_to ? 'Action log reassigned successfully' : 'Action log assigned successfully');
      setAssignModalVisible(false);
      assignForm.resetFields();
      fetchActionLogs();
    } catch (error) {
      console.error('Error assigning action log:', error);
      message.error('Failed to assign action log');
    }
  };

  const handleStatusUpdate = async (values: any) => {
    try {
      if (!selectedLog) return;
      
      await actionLogService.update(selectedLog.id, {
        status: values.status,
        comment: values.comment
      });
      message.success('Status updated successfully');
      setStatusModalVisible(false);
      statusForm.resetFields();
      fetchActionLogs();
    } catch (error) {
      console.error('Error updating status:', error);
      message.error('Failed to update status');
    }
  };

  const handleViewComments = async (logId: number) => {
    // Implementation for viewing comments
    console.log('View comments for log:', logId);
  };

  const handleApprove = async (values: any) => {
    try {
      if (!selectedLog) {
        console.log('handleApprove: No selectedLog');
        return;
      }
      setApproving(true);
      
      const userRoleName = (user?.role?.name || '').toLowerCase();
      const isCommissioner = userRoleName.includes('commissioner');
      
      // Check if user can approve based on the hierarchical workflow
      const canApproveAtStage = (
        selectedLog.status === 'pending_approval' &&
        selectedLog.closure_approval_stage !== 'none' &&
        selectedLog.closure_approval_stage === 'commissioner' && 
        isCommissioner
      );
      
      console.log('handleApprove called', {
        selectedLog,
        user,
        isCommissioner,
        canApproveAtStage,
        closure_approval_stage: selectedLog.closure_approval_stage
      });
      
      if (!canApproveAtStage) {
        console.log('handleApprove: Not authorized', { canApproveAtStage });
        message.error('You are not authorized to approve this action log');
        return;
      }
      
      await actionLogService.approve(selectedLog.id, {
        comment: values.comment || ''
      });
      
      message.success('Action log approved successfully');
      setApprovalModalVisible(false);
      approvalForm.resetFields();
      fetchActionLogs();
    } catch (error) {
      console.error('Error approving action log:', error);
      message.error('Failed to approve action log');
    } finally {
      setApproving(false);
    }
  };

  const handleReject = async (values: any) => {
    try {
      if (!selectedLog) {
        console.log('handleReject: No selectedLog');
        return;
      }
      setRejecting(true);
      
      // Use backend delegation-aware rejection logic
      // This properly handles Ag. C/PAP on leave and Ag. AC/PAP taking over responsibilities
      const canRejectAtStage = (
        selectedLog.status === 'pending_approval' &&
        selectedLog.closure_approval_stage !== 'none' &&
        user?.can_approve_action_logs
      );
      
      console.log('handleReject called', {
        selectedLog,
        user,
        isAgCPAP,
        canRejectAtStage,
        closure_approval_stage: selectedLog.closure_approval_stage
      });
      
      if (!canRejectAtStage) {
        console.log('handleReject: Not authorized', { canRejectAtStage });
        message.error('You are not authorized to reject action logs');
        return;
      }
      
      await actionLogService.reject(selectedLog.id, {
        reason: values.reason || ''
      });
      
      message.success('Action log rejected successfully');
      setRejectModalVisible(false);
      rejectForm.resetFields();
      fetchActionLogs();
    } catch (error) {
      console.error('Error rejecting action log:', error);
      message.error('Failed to reject action log');
    } finally {
      setRejecting(false);
    }
  };

  // Filter logs by search and status
  const getFilteredLogs = () => {
    let filteredLogs = [...actionLogs];
    console.log('[COMMISSIONER_DASHBOARD] getFilteredLogs: Starting with', filteredLogs.length, 'logs');
    console.log('[COMMISSIONER_DASHBOARD] getFilteredLogs: search =', search);
    console.log('[COMMISSIONER_DASHBOARD] getFilteredLogs: statusFilter =', statusFilter);

    // Apply search filter
    if (search) {
      const searchLower = search.toLowerCase();
      filteredLogs = filteredLogs.filter(log => 
        log.title.toLowerCase().includes(searchLower) ||
        (log.description && log.description.toLowerCase().includes(searchLower))
      );
      console.log('[COMMISSIONER_DASHBOARD] getFilteredLogs: After search filter,', filteredLogs.length, 'logs remaining');
    }

    // Apply status filter
    if (statusFilter) {
      filteredLogs = filteredLogs.filter(log => 
        log.status.toLowerCase() === statusFilter.toLowerCase()
      );
      console.log('[COMMISSIONER_DASHBOARD] getFilteredLogs: After status filter,', filteredLogs.length, 'logs remaining');
    }

    console.log('[COMMISSIONER_DASHBOARD] getFilteredLogs: Final result,', filteredLogs.length, 'logs');
    return filteredLogs;
  };

  // Get unique units from actionLogs - get from assigned users instead of created_by
  const uniqueUnits = Array.from(new Set(
    actionLogs.flatMap(log => 
      log.assigned_to?.map(assigneeId => {
        const assignee = users.find(u => u.id === assigneeId);
        return assignee?.department_unit?.id;
      }).filter(Boolean) || []
    )
  ))
    .filter(Boolean)
    .map(id => {
      const assignee = users.find(u => u.department_unit?.id === id);
      const unitName = assignee?.department_unit?.name || `Unit ${id}`;
      console.log('[COMMISSIONER_DASHBOARD] uniqueUnits: Found unit', { id, name: unitName, assignee: assignee ? `${assignee.first_name} ${assignee.last_name}` : 'Unknown' });
      return { 
        id, 
        name: unitName
      };
    });

  console.log('[COMMISSIONER_DASHBOARD] uniqueUnits: Final units', uniqueUnits);

  // Filter logs by selected unit
  const getUnitFilteredLogs = (logs: ActionLog[]): ActionLog[] => {
    console.log('[COMMISSIONER_DASHBOARD] getUnitFilteredLogs: Starting with', logs.length, 'logs');
    console.log('[COMMISSIONER_DASHBOARD] getUnitFilteredLogs: unitFilter =', unitFilter);
    
    // If unitFilter is 'all' or not set, return all logs
    if (unitFilter === 'all' || !unitFilter) {
      console.log('[COMMISSIONER_DASHBOARD] getUnitFilteredLogs: Returning all logs (unitFilter is "all")');
      return logs;
    }
    
    const filteredLogs = logs.filter(log => {
      // If user is assigned to this log, always show it
      const isAssignedToMe = log.assigned_to?.includes(user?.id || 0);
      if (isAssignedToMe) {
        console.log('[COMMISSIONER_DASHBOARD] getUnitFilteredLogs: Log', log.id, '- User is assigned, allowing through unit filter');
        return true;
      }
      
      // If user is the creator of the log, always show it (for unassigned logs)
      const isCreator = log.created_by?.id === user?.id;
      if (isCreator) {
        console.log('[COMMISSIONER_DASHBOARD] getUnitFilteredLogs: Log', log.id, '- User is creator, allowing through unit filter');
        return true;
      }
      
      // Check if any of the assigned users belong to the selected unit
      const hasUserInSelectedUnit = log.assigned_to?.some(assigneeId => {
        const assignee = users.find(u => u.id === assigneeId);
        const assigneeUnitId = assignee?.department_unit?.id;
        return assigneeUnitId === unitFilter;
      });

      // Check if this log is pending unit head approval for the current unit
      const isPendingUnitHeadApproval = log.status === 'pending_approval' && 
                                       log.closure_approval_stage === 'unit_head' && 
                                       hasUserInSelectedUnit;

      console.log('[COMMISSIONER_DASHBOARD] getUnitFilteredLogs: Log', log.id, 
        '- assigned_to =', log.assigned_to,
        '- unitFilter =', unitFilter,
        '- hasUserInSelectedUnit =', hasUserInSelectedUnit,
        '- isPendingUnitHeadApproval =', isPendingUnitHeadApproval,
        '- matches =', hasUserInSelectedUnit || isPendingUnitHeadApproval
      );

      return hasUserInSelectedUnit || isPendingUnitHeadApproval;
    });

    console.log('[COMMISSIONER_DASHBOARD] getUnitFilteredLogs: After unit filter,', filteredLogs.length, 'logs remaining');
    return filteredLogs;
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleMenuClick = (e: any) => {
    setSelectedMenuKey(e.key);
  };

  const renderDelegationTable = () => {
    const delegationColumns = [
      {
        title: 'Delegated To',
        dataIndex: 'delegated_to',
        key: 'delegated_to',
        render: (text: string) => (
          <div style={{ fontWeight: 600, color: '#1a1a1a' }}>
            {text}
          </div>
        ),
      },
      {
        title: 'Delegated At',
        dataIndex: 'delegated_at',
        key: 'delegated_at',
        render: (date: string) => format(new Date(date), 'yyyy-MM-dd HH:mm'),
      },
      {
        title: 'Expires At',
        dataIndex: 'expires_at',
        key: 'expires_at',
        render: (date: string) => date ? format(new Date(date), 'yyyy-MM-dd HH:mm') : 'No expiration',
      },
      {
        title: 'Status',
        key: 'status',
        render: (record: Delegation) => {
          const isExpired = record.expires_at && new Date(record.expires_at) < new Date();
          const isActive = record.is_active && !isExpired;
          
          return (
            <Tag color={isActive ? 'green' : 'red'}>
              {isActive ? 'Active' : 'Inactive'}
            </Tag>
          );
        },
      },
      {
        title: 'Reason',
        dataIndex: 'reason',
        key: 'reason',
        render: (text: string) => text || '-',
      },
      {
        title: 'Actions',
        key: 'actions',
        render: (record: Delegation) => {
          // Check if current user is the delegator (can revoke)
          // For commissioners, they should be able to revoke their own delegations
          const userRole = user?.role?.name;
          const isCommissioner = userRole === 'COMMISSIONER';
          const isSuperAdmin = userRole === 'SUPER_ADMIN';
          
          // Check if this delegation is being revoked
          const isRevoking = revokingDelegations.has(record.id);
          
          // Commissioners and super admins can revoke their own delegations
          const canRevoke = record.is_active && (isCommissioner || isSuperAdmin);
          // Only super admins can delete
          const canDelete = isSuperAdmin;
          
          // Check if current user is the delegated person
          const isDelegatedPerson = record.delegated_to === user?.username;
          
          return (
            <Space>
              {canRevoke && (
                <Button
                  type="link"
                  danger
                  disabled={isRevoking}
                  loading={isRevoking}
                  onClick={() => handleRevokeDelegation(record.id)}
                >
                  {isRevoking ? 'Revoking...' : 'Revoke'}
                </Button>
              )}
              {canDelete && (
                <Button
                  type="link"
                  danger
                  icon={<DeleteOutlined />}
                  onClick={() => handleDeleteDelegation(record.id)}
                >
                  Delete
                </Button>
              )}
              {isDelegatedPerson && !record.is_active && (
                <span style={{ color: '#999', fontStyle: 'italic' }}>Revoked</span>
              )}
            </Space>
          );
        },
      },
    ];

    return (
      <Card title="Delegation Management">
        <Space style={{ marginBottom: 16 }}>
          <Button
            type="primary"
            icon={<UserAddOutlined />}
            onClick={() => setDelegationModalVisible(true)}
          >
            Create Delegation
          </Button>
        </Space>

        <Table
          columns={delegationColumns}
          dataSource={delegations}
          loading={loading}
          rowKey="id"
        />
      </Card>
    );
  };

  const columns = [
    {
      title: 'Title',
      dataIndex: 'title',
      key: 'title',
      width: '20%',
    },
    {
      title: 'Description',
      dataIndex: 'description',
      key: 'description',
      width: '25%',
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: '10%',
      render: (status: string) => (
        <span style={{ 
          color: status === 'closed' ? 'green' : 
                 status === 'in_progress' ? 'orange' : 
                 status === 'pending_approval' ? 'blue' : 'default'
        }}>
          {status === 'closed' ? 'Done' :
           status === 'pending_approval' ? 'Pending Approval' :
           status === 'open' ? 'New' :
           status.replace('_', ' ').toUpperCase()}
        </span>
      ),
    },
    {
      title: 'Assigned To',
      dataIndex: 'assigned_to',
      key: 'assigned_to',
      width: '15%',
      render: (assignedTo: number[]) => {
        if (!assignedTo || assignedTo.length === 0) return '-';
        return assignedTo.map(userId => {
          const assignedUser = users.find(u => u.id === userId);
          return assignedUser ? `${assignedUser.first_name} ${assignedUser.last_name}` : '';
        }).filter(Boolean).join(', ');
      }
    },
    {
      title: 'Created At',
      dataIndex: 'created_at',
      key: 'created_at',
      width: '15%',
      render: (date: string) => format(new Date(date), 'yyyy-MM-dd HH:mm'),
    },
    {
      title: 'Due Date',
      dataIndex: 'due_date',
      key: 'due_date',
      width: '15%',
      render: (date: string) => date ? format(new Date(date), 'yyyy-MM-dd HH:mm') : '-',
    },
    {
      title: 'Actions',
      key: 'actions',
      width: '10%',
      render: (text: string, record: ActionLog) => {
        const isAssigned = record.assigned_to && record.assigned_to.length > 0;
        const isClosed = record.status === 'closed';
        const hasDueDate = record.due_date !== null;
        
        // Only show assign button to the original assigner
        const isOriginalAssigner = record.original_assigner?.id === user?.id;
        const isCommissioner = user?.role?.name === 'COMMISSIONER';
        
        // Check if user has Ag. C/PAP designation
        const isAgCPAP = user?.has_ag_cpap_designation || false;
        
        // Check if user can approve/reject based on the new Ag. C/PAP only workflow
        const canApproveReject = (
          record.status === 'pending_approval' &&
          record.closure_approval_stage !== 'none' &&
          isAgCPAP
        );

        return (
          <Space>
            <Button type="link" onClick={() => navigate(`/action-logs/${record.id}`)}>
              View
            </Button>
            {isOriginalAssigner && (
              <Tooltip title={isClosed && hasDueDate ? "Cannot assign completed action logs" : isAssigned ? "Re-assign" : "Assign"}>
                <Button
                  type="link"
                  icon={<UserSwitchOutlined />}
                  onClick={() => {
                    setSelectedLog(record);
                    setAssignModalVisible(true);
                  }}
                  disabled={isClosed && hasDueDate}
                />
              </Tooltip>
            )}
            {Array.isArray(record.assigned_to) && record.assigned_to.includes(user?.id || 0) && (
              <Button
                type="link"
                onClick={() => {
                  setSelectedLog(record);
                  setStatusModalVisible(true);
                }}
              >
                Update Status
              </Button>
            )}
            {canApproveReject && (
              <>
                <Button
                  type="link"
                  onClick={() => {
                    setSelectedLog(record);
                    setApprovalModalVisible(true);
                  }}
                  style={{
                    transition: 'all 0.3s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = '#52c41a';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = '#1890ff';
                  }}
                >
                  Approve
                </Button>
                <Button
                  type="link"
                  danger
                  onClick={() => {
                    setSelectedLog(record);
                    setRejectModalVisible(true);
                  }}
                >
                  Reject
                </Button>
              </>
            )}
            <Button
              type="link"
              onClick={() => handleViewComments(record.id)}
            >
              Comments
            </Button>
          </Space>
        );
      },
    },
  ];

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider width={200} theme="light">
        <UserDisplay 
          user={user} 
        />
        <Menu
          mode="inline"
          selectedKeys={[selectedMenuKey]}
          onClick={handleMenuClick}
        >
          <Menu.Item key="actionLogs" icon={<FileTextOutlined />}>
            Action Logs
          </Menu.Item>
          <Menu.Item key="pendingApproval" icon={<ClockCircleOutlined />}>
            Pending Approval
          </Menu.Item>
          <Menu.Item key="delegations" icon={<UserSwitchOutlined />}>
            Delegations
          </Menu.Item>
          <Menu.Item key="logout" icon={<SettingOutlined />} onClick={handleLogout}>
            Logout
          </Menu.Item>
        </Menu>
      </Sider>
      <Content style={{ padding: '24px' }}>
        {selectedMenuKey === 'actionLogs' && (
          <Card title="Commissioner Dashboard">
            <Space style={{ marginBottom: 16 }}>
              <Input.Search
                placeholder="Search action logs"
                onSearch={value => setSearch(value)}
                style={{ width: 200 }}
              />
              <Select
                style={{ width: 200 }}
                placeholder="Filter by status"
                onChange={value => setStatusFilter(value)}
                options={[
                  { label: 'All Statuses', value: '' },
                  { label: 'Open', value: 'open' },
                  { label: 'In Progress', value: 'in_progress' },
                  { label: 'Closed', value: 'closed' },
                ]}
              />
              <Select
                value={unitFilter}
                onChange={setUnitFilter}
                placeholder="Select Unit"
                style={{ width: 150, marginRight: 8 }}
              >
                <Select.Option value="all">All Units</Select.Option>
                {uniqueUnits.map(unit => (
                  <Select.Option key={unit.id} value={unit.id}>{unit.name}</Select.Option>
                ))}
              </Select>
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => setCreateModalVisible(true)}
                disabled={!user?.can_create_action_logs}
              >
                Create Action Log
              </Button>
              {user && (
                <DelegationStatus 
                  hasActiveDelegation={user.has_active_delegation}
                  canCreateActionLogs={user.can_create_action_logs}
                  userDesignation={user.designation}
                />
              )}
            </Space>

            <Table
              columns={columns}
              dataSource={getUnitFilteredLogs(getFilteredLogs())}
              loading={loading}
              rowKey="id"
            />
          </Card>
        )}

        {selectedMenuKey === 'delegations' && renderDelegationTable()}

        <Modal
          title="Create Action Log"
          open={createModalVisible}
          onCancel={() => setCreateModalVisible(false)}
          onOk={() => form.submit()}
          confirmLoading={loading}
          okButtonProps={{ disabled: !user?.can_create_action_logs }}
        >
          {!user?.can_create_action_logs && (
            <div style={{ 
              marginBottom: 16, 
              padding: 12, 
              backgroundColor: '#fff2e8', 
              border: '1px solid #ffbb96',
              borderRadius: 6
            }}>
              <strong>⚠️ No Delegation</strong>
              <p style={{ margin: '8px 0 0 0', color: '#666' }}>
                You need delegation from the Commissioner to create action logs. 
                Please contact the Commissioner for delegation.
              </p>
            </div>
          )}
          <Form form={form} onFinish={handleCreate} layout="vertical">
            <Form.Item
              name="title"
              label="Title"
              rules={[{ required: true, message: 'Please enter a title' }]}
            >
              <Input />
            </Form.Item>
            <Form.Item
              name="description"
              label="Description"
              rules={[{ required: true, message: 'Please enter a description' }]}
            >
              <Input.TextArea />
            </Form.Item>
            <Form.Item>
              <Button type="primary" htmlType="submit">
                Create
              </Button>
            </Form.Item>
          </Form>
        </Modal>

        <Modal
          title={selectedLog?.assigned_to ? "Re-assign Action Log" : "Assign Action Log"}
          open={assignModalVisible}
          onCancel={() => setAssignModalVisible(false)}
          footer={null}
        >
          <Form form={assignForm} onFinish={handleAssign} layout="vertical">
            <Form.Item
              name="assigned_to"
              label="Assign To"
              rules={[
                { required: true, message: 'Please select at least one user' },
                { type: 'array', min: 1, message: 'Please select at least one user' }
              ]}
            >
              <Select
                mode="multiple"
                showSearch
                placeholder="Select users"
                filterOption={(input, option) =>
                  (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                }
                options={users
                  .filter(u => {
                    // No staff can assign themselves
                    if (u.id === user?.id) return false;
                    
                    // Check if current user is Ag. C/PAP and has created delegations for other users
                    const isAgCPAP = user?.designation?.toLowerCase().includes('ag. c/pap');
                    const hasCreatedDelegations = isAgCPAP && delegations.some(d => 
                      d.delegated_by_id === user.id && d.is_active
                    );
                    
                    // Ag. C/PAP users who have delegated to other users can assign to all users except Ag. C/PAP users
                    if (hasCreatedDelegations) {
                      return !u.designation?.toLowerCase().includes('ag. c/pap');
                    }
                    
                    // Users who have received a delegation can assign to all users except Ag. C/PAP users
                    const hasReceivedDelegation = user?.has_active_delegation && user.has_active_delegation.is_valid === true;
                    if (hasReceivedDelegation) {
                      return !u.designation?.toLowerCase().includes('ag. c/pap');
                    }
                    
                    // Regular filtering: exclude commissioners
                    return u.role?.name !== 'COMMISSIONER';
                  })
                  .map(u => ({
                    label: `${u.first_name} ${u.last_name}`,
                    value: u.id
                  }))}
              />
            </Form.Item>
            {selectedLog?.assigned_to && (
              <Form.Item
                name="due_date"
                label="Due Date"
                rules={[{ required: true, message: 'Please select a due date' }]}
              >
                <DatePicker
                  showTime
                  format="YYYY-MM-DD HH:mm"
                  style={{ width: '100%' }}
                />
              </Form.Item>
            )}
            <Form.Item>
              <Button type="primary" htmlType="submit">
                {selectedLog?.assigned_to ? "Re-assign" : "Assign"}
              </Button>
            </Form.Item>
          </Form>
        </Modal>

        <Modal
          title="Update Status"
          open={statusModalVisible}
          onCancel={() => setStatusModalVisible(false)}
          footer={null}
        >
          <Form form={statusForm} onFinish={handleStatusUpdate} layout="vertical">
            <Form.Item
              name="status"
              label="Status"
              rules={[{ required: true, message: 'Please select a status' }]}
            >
              <Select>
                <Select.Option value="open">Open</Select.Option>
                <Select.Option value="in_progress">In Progress</Select.Option>
                <Select.Option value="closed">Closed</Select.Option>
              </Select>
            </Form.Item>
            <Form.Item
              name="comment"
              label="Comment"
              rules={[{ required: true, message: 'Please enter a comment' }]}
            >
              <Input.TextArea />
            </Form.Item>
            <Form.Item>
              <Button type="primary" htmlType="submit">
                Update
              </Button>
            </Form.Item>
          </Form>
        </Modal>

        <Modal
          title="Approve Action Log"
          open={approvalModalVisible}
          onCancel={() => setApprovalModalVisible(false)}
          onOk={() => approvalForm.submit()}
          confirmLoading={approving}
        >
          <Form form={approvalForm} onFinish={handleApprove} layout="vertical">
            <Form.Item
              name="comment"
              label="Comment"
              rules={[{ required: true, message: 'Please enter a comment' }]}
            >
              <Input.TextArea />
            </Form.Item>
          </Form>
        </Modal>

        <Modal
          title="Reject Action Log"
          open={rejectModalVisible}
          onCancel={() => setRejectModalVisible(false)}
          onOk={() => rejectForm.submit()}
          confirmLoading={rejecting}
        >
          <Form form={rejectForm} onFinish={handleReject} layout="vertical">
            <Form.Item
              name="reason"
              label="Reason"
              rules={[{ required: true, message: 'Please enter a reason' }]}
            >
              <Input.TextArea />
            </Form.Item>
          </Form>
        </Modal>

        <Modal
          title="Create Delegation"
          open={delegationModalVisible}
          onCancel={() => setDelegationModalVisible(false)}
          onOk={() => delegationForm.submit()}
          confirmLoading={loading}
        >
          <Form form={delegationForm} onFinish={handleCreateDelegation} layout="vertical">
            <Form.Item
              name="delegated_to_id"
              label="Delegated To"
              rules={[{ required: true, message: 'Please select a user to delegate to' }]}
            >
              <Select
                placeholder="Select user"
                options={users
                  .filter(u => u.id !== user?.id && u.role?.name !== 'COMMISSIONER')
                  .map(u => ({
                    label: `${u.first_name} ${u.last_name}`,
                    value: u.id
                  }))}
              />
            </Form.Item>
            <Form.Item
              name="expires_at"
              label="Expires At"
              rules={[{ required: true, message: 'Please select an expiration date' }]}
            >
              <DatePicker
                showTime
                format="YYYY-MM-DD HH:mm"
                style={{ width: '100%' }}
              />
            </Form.Item>
            <Form.Item
              name="reason"
              label="Reason"
              rules={[{ required: true, message: 'Please select a reason for delegation' }]}
            >
              <Select
                placeholder="Select reason"
                options={[
                  { label: 'Leave', value: 'leave' },
                  { label: 'Other', value: 'other' }
                ]}
              />
            </Form.Item>
          </Form>
        </Modal>
      </Content>
    </Layout>
  );
};

export default CommissionerDashboard; 