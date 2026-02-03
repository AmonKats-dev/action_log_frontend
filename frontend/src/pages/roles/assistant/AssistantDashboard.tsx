import React, { useState, useEffect } from 'react';
import { useAuth } from '../../../auth/AuthContext';
import { actionLogService } from '../../../services/actionLogService';
import { departmentService } from '../../../services/departmentService';
import { userService } from '../../../services/userService';
import { ActionLog, ActionLogStatus, ActionLogUpdate } from '../../../types/actionLog';
import { Department, DepartmentUnit } from '../../../types/department';
import { Button, Card, Table, Modal, Form, Input, message, Space, Tag, Select, DatePicker, Layout, Menu, Avatar, Tooltip, Timeline, Spin, Badge } from 'antd';
import { PlusOutlined, CheckOutlined, FilterOutlined, UserAddOutlined, UserOutlined, FileTextOutlined, FormOutlined, TeamOutlined, SettingOutlined } from '@ant-design/icons';
import { format } from 'date-fns';
import { Navigate, useNavigate } from 'react-router-dom';
import { User } from '../../../types/user';
import { Dayjs } from 'dayjs';
import UserDisplay from '../../../components/UserDisplay';
import { actionLogMatchesSearch } from '../../../utils/actionLogSearchUtil';

const { Sider, Content } = Layout;

const AssistantDashboard: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [actionLogs, setActionLogs] = useState<ActionLog[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [departmentUnits, setDepartmentUnits] = useState<DepartmentUnit[]>([]);
  const [loading, setLoading] = useState(true);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [assignModalVisible, setAssignModalVisible] = useState(false);
  const [selectedLog, setSelectedLog] = useState<ActionLog | null>(null);
  const [form] = Form.useForm();
  const [assignForm] = Form.useForm();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedMenuKey, setSelectedMenuKey] = useState('actionLogs');
  const [users, setUsers] = useState<User[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [statusModalVisible, setStatusModalVisible] = useState(false);
  const [statusForm] = Form.useForm();
  const [commentsModalVisible, setCommentsModalVisible] = useState(false);
  const [selectedLogComments, setSelectedLogComments] = useState<any[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [unitFilter, setUnitFilter] = useState<'all' | string>('all');
  const [approvalModalVisible, setApprovalModalVisible] = useState(false);
  const [rejectModalVisible, setRejectModalVisible] = useState(false);
  const [approving, setApproving] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [approvalForm] = Form.useForm();
  const [rejectForm] = Form.useForm();

  useEffect(() => {
    const initializeData = async () => {
      if (!user) {
        navigate('/login');
        return;
      }

      try {
        await Promise.all([
          fetchDepartments(),
          fetchDepartmentUnits(),
          fetchActionLogs(),
          fetchUsers()
        ]);
      } catch (error) {
        console.error('Error initializing data:', error);
        message.error('Failed to initialize dashboard data');
      }
    };
    initializeData();
  }, [user]);

  // Ensure unitFilter updates when user loads
  useEffect(() => {
    if (user?.department_unit?.id) {
      setUnitFilter(user.department_unit.id);
    }
  }, [user]);

  const fetchActionLogs = async () => {
    try {
      const response = await actionLogService.getAll();
      const logs = response.results || response;
      const logsArray = Array.isArray(logs) ? logs : [];
      setActionLogs(logsArray);
    } catch (error) {
      console.error('Error fetching action logs:', error);
      message.error('Failed to fetch action logs');
    } finally {
      setLoading(false);
    }
  };

  const fetchDepartments = async () => {
    try {
      const response = await departmentService.getAll();
      let departmentsData: Department[] = [];
      
      if (Array.isArray(response)) {
        departmentsData = response;
      } else if (response && typeof response === 'object') {
        interface PaginatedResponse {
          results?: Department[];
        }
        const typedResponse = response as PaginatedResponse;
        departmentsData = Array.isArray(typedResponse.results) ? typedResponse.results : [];
      }
      
      setDepartments(departmentsData);
    } catch (error) {
      console.error('Error fetching departments:', error);
      message.error('Failed to fetch departments');
      setDepartments([]);
    }
  };

  const fetchDepartmentUnits = async () => {
    try {
      const response = await departmentService.getUnits();
      let units: DepartmentUnit[] = [];
      
      if (Array.isArray(response)) {
        units = response;
      } else if (response && typeof response === 'object') {
        // Handle paginated response
        interface PaginatedResponse {
          count: number;
          next: string | null;
          previous: string | null;
          results: DepartmentUnit[];
        }
        const typedResponse = response as unknown as PaginatedResponse;
        if (Array.isArray(typedResponse.results)) {
          units = typedResponse.results;
        } else {
          console.warn('Unexpected response format:', response);
          units = [];
        }
      }
      
      setDepartmentUnits(units);
    } catch (error) {
      console.error('Error fetching department units:', error);
      message.error('Failed to fetch department units');
      setDepartmentUnits([]);
    }
  };

  const fetchUsers = async () => {
    if (!user) return;

    try {
      setUsersLoading(true);
      // If user is a department unit head, only fetch users from their unit
      if (user.department_unit) {
        const data = await userService.getByDepartmentUnit(user.department_unit.id);
        const usersArray = Array.isArray(data) ? data.filter(u => u.is_active && u.id !== user.id) : [];
        setUsers(usersArray);
      } else {
        const data = await userService.getByDepartment(user.department);
        const usersArray = Array.isArray(data) ? data.filter(u => u.is_active && u.id !== user.id) : [];
        setUsers(usersArray);
      }
    } catch (error) {
      console.error('Error fetching users:', error);
      message.error('Failed to fetch users');
    } finally {
      setUsersLoading(false);
    }
  };

  const handleCreate = async (values: any) => {
    try {
      // Convert string IDs to integers for assigned_to
      const assignedToInts = values.assigned_to ? values.assigned_to.map((id: string) => parseInt(id)) : [];
      
      await actionLogService.create({
        ...values,
        assigned_to: assignedToInts,
        created_by: user.id,
        department: user.department
      });
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
      
      const assignedToIds = values.assigned_to.map((id: string) => parseInt(id));
      const updateData: ActionLogUpdate = {
        assigned_to: assignedToIds
      };
      
      await actionLogService.update(selectedLog.id, updateData);
      message.success('Action log assigned successfully');
      setAssignModalVisible(false);
      assignForm.resetFields();
      
      // Update the action logs list with the new data
      setActionLogs(prevLogs => 
        prevLogs.map(log => 
          log.id === selectedLog.id 
            ? { 
                ...log,
                assigned_to: assignedToIds
              }
            : log
        )
      );
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
        comment: values.status_comment
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

  const handleApprove = async (values: any) => {
    try {
      if (!selectedLog) {
        console.log('handleApprove: No selectedLog');
        return;
      }
      setApproving(true);
      
      const userRoleName = (user?.role?.name || '').toLowerCase();
      const isAssistantCommissioner = userRoleName.includes('assistant_commissioner');
      
      // Check if user can approve based on the hierarchical workflow
      const canApproveAtStage = (
        selectedLog.status === 'pending_approval' &&
        selectedLog.closure_approval_stage !== 'none' &&
        selectedLog.closure_approval_stage === 'assistant_commissioner' && 
        isAssistantCommissioner
      );
      
      console.log('handleApprove called', {
        selectedLog,
        user,
        isAssistantCommissioner,
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
      
      // Only Ag. C/PAP users can reject action logs
      const isAgCPAP = user?.has_ag_cpap_designation || false;
      
      // Check if user can reject based on the new Ag. C/PAP only workflow
      const canRejectAtStage = (
        selectedLog.status === 'pending_approval' &&
        selectedLog.closure_approval_stage !== 'none' &&
        isAgCPAP
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
        message.error('Only users with Ag. C/PAP designation can reject action logs');
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

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleMenuClick = (e: any) => {
    setSelectedMenuKey(e.key);
  };

  const fetchComments = async (logId: number) => {
    try {
      setCommentsLoading(true);
      const response = await actionLogService.getComments(logId);
      setSelectedLogComments(response);
    } catch (error) {
      console.error('Error fetching comments:', error);
      message.error('Failed to fetch comments');
    } finally {
      setCommentsLoading(false);
    }
  };

  const handleViewComments = async (logId: number) => {
    await fetchComments(logId);
    setCommentsModalVisible(true);
  };

  const handleAddComment = async () => {
    if (!newComment.trim()) return;
    
    try {
      setSubmittingComment(true);
      await actionLogService.addComment(selectedLogComments[0]?.action_log || 0, {
        comment: newComment,
        parent_id: undefined
      });
      setNewComment('');
      message.success('Comment added successfully');
      // Refresh comments
      if (selectedLogComments.length > 0) {
        await handleViewComments(selectedLogComments[0].action_log);
      }
    } catch (error) {
      console.error('Error adding comment:', error);
      message.error('Failed to add comment');
    } finally {
      setSubmittingComment(false);
    }
  };

  // Filter logs by search and status
  const getFilteredLogs = () => {
    let filteredLogs = [...actionLogs];
    console.log('[ASSISTANT_DASHBOARD] getFilteredLogs: Starting with', filteredLogs.length, 'logs');
    console.log('[ASSISTANT_DASHBOARD] getFilteredLogs: search =', search);
    console.log('[ASSISTANT_DASHBOARD] getFilteredLogs: statusFilter =', statusFilter);

    // Apply search filter (all columns)
    if (search) {
      const searchLower = search.toLowerCase();
      filteredLogs = filteredLogs.filter(log => actionLogMatchesSearch(log, searchLower, { users }));
      console.log('[ASSISTANT_DASHBOARD] getFilteredLogs: After search filter,', filteredLogs.length, 'logs remaining');
    }

    // Apply status filter
    if (statusFilter) {
      filteredLogs = filteredLogs.filter(log => 
        log.status.toLowerCase() === statusFilter.toLowerCase()
      );
      console.log('[ASSISTANT_DASHBOARD] getFilteredLogs: After status filter,', filteredLogs.length, 'logs remaining');
    }

    console.log('[ASSISTANT_DASHBOARD] getFilteredLogs: Final result,', filteredLogs.length, 'logs');
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
      console.log('[ASSISTANT_DASHBOARD] uniqueUnits: Found unit', { id, name: unitName, assignee: assignee ? `${assignee.first_name} ${assignee.last_name}` : 'Unknown' });
      return { 
        id, 
        name: unitName
      };
    });

  console.log('[ASSISTANT_DASHBOARD] uniqueUnits: Final units', uniqueUnits);

  // Filter logs by selected unit
  const getUnitFilteredLogs = (logs: ActionLog[]): ActionLog[] => {
    console.log('[ASSISTANT_DASHBOARD] getUnitFilteredLogs: Starting with', logs.length, 'logs');
    console.log('[ASSISTANT_DASHBOARD] getUnitFilteredLogs: unitFilter =', unitFilter);
    
    // If unitFilter is 'all' or not set, return all logs
    if (unitFilter === 'all' || !unitFilter) {
      console.log('[ASSISTANT_DASHBOARD] getUnitFilteredLogs: Returning all logs (unitFilter is "all")');
      return logs;
    }
    
    const filteredLogs = logs.filter(log => {
      // If user is assigned to this log, always show it
      const isAssignedToMe = log.assigned_to?.includes(user?.id || 0);
      if (isAssignedToMe) {
        console.log('[ASSISTANT_DASHBOARD] getUnitFilteredLogs: Log', log.id, '- User is assigned, allowing through unit filter');
        return true;
      }
      
      // If user is the creator of the log, always show it (for unassigned logs)
      const isCreator = log.created_by?.id === user?.id;
      if (isCreator) {
        console.log('[ASSISTANT_DASHBOARD] getUnitFilteredLogs: Log', log.id, '- User is creator, allowing through unit filter');
        return true;
      }
      
      // Check if any of the assigned users belong to the selected unit
      const hasUserInSelectedUnit = log.assigned_to?.some(assigneeId => {
        const assignee = users.find(u => u.id === assigneeId);
        const assigneeUnitName = assignee?.department_unit?.name;
        return assigneeUnitName === unitFilter;
      });

      // Check if this log is pending unit head approval for the current unit
      const isPendingUnitHeadApproval = log.status === 'pending_approval' && 
                                       log.closure_approval_stage === 'unit_head' && 
                                       hasUserInSelectedUnit;

      console.log('[ASSISTANT_DASHBOARD] getUnitFilteredLogs: Log', log.id, 
        '- assigned_to =', log.assigned_to,
        '- unitFilter =', unitFilter,
        '- hasUserInSelectedUnit =', hasUserInSelectedUnit,
        '- isPendingUnitHeadApproval =', isPendingUnitHeadApproval,
        '- matches =', hasUserInSelectedUnit || isPendingUnitHeadApproval
      );

      return hasUserInSelectedUnit || isPendingUnitHeadApproval;
    });

    console.log('[ASSISTANT_DASHBOARD] getUnitFilteredLogs: After unit filter,', filteredLogs.length, 'logs remaining');
    return filteredLogs;
  };

  const columns = [
    {
      title: 'Title',
      dataIndex: 'title',
      key: 'title',
      width: '25%',
      render: (text: string) => (
        <div style={{ 
          fontWeight: 500,
          color: '#262626',
          fontSize: '14px',
          lineHeight: 1.5,
          letterSpacing: '0.01em',
          whiteSpace: 'normal',
          wordBreak: 'break-word',
        }}>
          {text || '—'}
        </div>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: '10%',
      render: (status: string) => (
        <Tag color={status === 'open' ? 'green' : status === 'in_progress' ? 'blue' : 'red'}>
          {status.toUpperCase()}
        </Tag>
      ),
    },
    {
      title: 'Priority',
      dataIndex: 'priority',
      key: 'priority',
      width: '10%',
      render: (priority: string) => (
        <Tag color={priority === 'High' ? 'red' : priority === 'Medium' ? 'orange' : 'green'}>
          {priority}
        </Tag>
      ),
    },
    {
      title: 'Assigned To',
      dataIndex: 'assigned_to',
      key: 'assigned_to',
      width: '15%',
      render: (assigned: number[] | null) => {
        if (!assigned || assigned.length === 0) {
          return <span style={{ color: '#999' }}>Unassigned</span>;
        }
        
        const assignedUsers = users.filter(user => assigned.includes(user.id));
        if (assignedUsers.length === 0) {
          return <span style={{ color: '#999' }}>Unassigned</span>;
        }
        
        return assignedUsers.map(user => 
          `${user.first_name} ${user.last_name}`
        ).join(', ');
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
        // Only show assign button to the original assigner
        const isOriginalAssigner = record.original_assigner?.id === user.id;
        const canAssign = user.department_unit && user.department_unit.id === record.department_unit && 
                         user.designation?.toLowerCase().includes('head') && isOriginalAssigner;
        const isAssistantCommissioner = user?.role?.name?.toLowerCase() === 'assistant_commissioner';
        
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
            {canAssign && (
              <Button 
                type="link" 
                onClick={() => {
                  setSelectedLog(record);
                  setAssignModalVisible(true);
                }}
              >
                Assign
              </Button>
            )}
            {Array.isArray(record.assigned_to) && record.assigned_to.includes(user.id) && (
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
      }
    },
  ];

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider width={200} theme="light">
        <UserDisplay 
          user={user} 
          departmentName={departments.find(d => d.id === user.department)?.name}
        />
        <Menu
          mode="inline"
          selectedKeys={[selectedMenuKey]}
          onClick={handleMenuClick}
        >
          <Menu.Item key="actionLogs" icon={<FileTextOutlined />}>
            Action Logs
          </Menu.Item>
          <Menu.Item key="logout" icon={<SettingOutlined />} onClick={handleLogout}>
            Logout
          </Menu.Item>
        </Menu>
      </Sider>
      <Content style={{ padding: '24px' }}>
        <Card title="Assistant Commissioner Dashboard">
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
              <Select.Option value="IN">IN</Select.Option>
              <Select.Option value="PAS">PAS</Select.Option>
            </Select>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => setCreateModalVisible(true)}
            >
              Create Action Log
            </Button>
          </Space>

          <Table
            columns={columns}
            dataSource={getUnitFilteredLogs(getFilteredLogs())}
            loading={loading}
            rowKey="id"
          />
        </Card>

        <Modal
          title="Create Action Log"
          open={createModalVisible}
          onCancel={() => setCreateModalVisible(false)}
          footer={null}
        >
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
          title="Assign Action Log"
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
                loading={usersLoading}
                placeholder="Select users"
                options={users.map(user => ({
                  label: `${user.first_name} ${user.last_name}`,
                  value: user.id.toString()
                }))}
                style={{ minHeight: 80 }}
                allowClear
              />
            </Form.Item>
            <Form.Item>
              <Space>
                <Button onClick={() => setAssignModalVisible(false)}>
                  Cancel
                </Button>
                <Button type="primary" htmlType="submit">
                  Assign
                </Button>
              </Space>
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
              <Select
                placeholder="Select status"
                options={[
                  { label: 'Open', value: 'open' },
                  { label: 'In Progress', value: 'in_progress' },
                  { label: 'Closed', value: 'closed' },
                ]}
              />
            </Form.Item>
            <Form.Item
              name="status_comment"
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
          title="Comments"
          open={commentsModalVisible}
          onCancel={() => setCommentsModalVisible(false)}
          footer={null}
          width={600}
        >
          <div style={{ maxHeight: '400px', overflowY: 'auto', marginBottom: '16px' }}>
            <Timeline>
              {selectedLogComments.map((comment, index) => (
                <Timeline.Item key={index}>
                  <p><strong>{comment.user?.name}</strong> - {format(new Date(comment.created_at), 'yyyy-MM-dd HH:mm')}</p>
                  <p>{comment.content}</p>
                </Timeline.Item>
              ))}
            </Timeline>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <Input.TextArea
              value={newComment}
              onChange={e => setNewComment(e.target.value)}
              placeholder="Add a comment..."
              rows={3}
            />
            <Button
              type="primary"
              onClick={handleAddComment}
              loading={submittingComment}
            >
              Add Comment
            </Button>
          </div>
        </Modal>

        <Modal
          title="Approve Action Log"
          open={approvalModalVisible}
          onCancel={() => setApprovalModalVisible(false)}
          onOk={() => approvalForm.submit()}
          confirmLoading={approving}
          footer={[
            <Button key="back" onClick={() => setApprovalModalVisible(false)}>
              Cancel
            </Button>,
            <Button key="submit" type="primary" loading={approving} onClick={() => approvalForm.submit()}>
              Approve
            </Button>,
          ]}
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
          footer={[
            <Button key="back" onClick={() => setRejectModalVisible(false)}>
              Cancel
            </Button>,
            <Button key="submit" type="primary" loading={rejecting} onClick={() => rejectForm.submit()}>
              Reject
            </Button>,
          ]}
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
      </Content>
    </Layout>
  );
};

export default AssistantDashboard; 