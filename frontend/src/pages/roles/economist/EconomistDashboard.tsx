import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../../auth/AuthContext';
import { actionLogService } from '../../../services/actionLogService';
import { departmentService } from '../../../services/departmentService';
import { userService } from '../../../services/userService';
import { delegationService, Delegation, CreateDelegationRequest } from '../../../services/delegationService';
import { ActionLog, ActionLogStatus, ActionLogUpdate, CreateActionLogData, ActionLogPriority, ApprovalStatus, ActionLogComment } from '../../../types/actionLog';
import { Department, DepartmentUnit } from '../../../types/department';
import { Button, Card, Table, Modal, Form, Input, message, Space, Tag, Select, DatePicker, Layout, Menu, Avatar, Tooltip, Timeline, Spin, Badge, Tabs, Upload, List, Descriptions, Divider, Dropdown } from 'antd';
import { PlusOutlined, CheckOutlined, FilterOutlined, UserAddOutlined, UserOutlined, FileTextOutlined, FormOutlined, TeamOutlined, SettingOutlined, ClockCircleOutlined, CalendarOutlined, CommentOutlined, ClusterOutlined, UploadOutlined, EyeOutlined, UserSwitchOutlined, EditOutlined, CheckCircleOutlined, CloseOutlined, DownloadOutlined, MessageOutlined, DeleteOutlined, ExclamationCircleOutlined, InfoCircleOutlined } from '@ant-design/icons';
import { format, differenceInDays, isPast, isToday } from 'date-fns';
import { Navigate, useNavigate } from 'react-router-dom';
import { User } from '../../../types/user';
import { Dayjs } from 'dayjs';
import UserDisplay from '../../../components/UserDisplay';
import DelegationStatus from '../../../components/DelegationStatus';
import { ColumnsType } from 'antd/es/table';
import * as XLSX from 'xlsx';
import axios from 'axios';
import './economistDashboard.css'; // Ensure custom styles are imported
import dayjs from 'dayjs';

const { Sider, Content } = Layout;

interface ImportMetaEnv {
  VITE_API_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

interface Role {
  id: number;
  name: string;
  can_create_logs: boolean;
  can_update_status: boolean;
  can_approve: boolean;
  can_view_all_logs: boolean;
  can_configure: boolean;
  can_view_all_users: boolean;
  can_assign_to_commissioner: boolean;
}

interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

interface DepartmentWithUnits extends Omit<Department, 'units'> {
  units: DepartmentUnit[];
}

interface CommentResponse {
  id: number;
  action_log: number;
  user: User;
  comment: string;
  created_at: string;
  updated_at: string;
  parent_comment_id?: number;
  replies?: CommentResponse[];
  status?: ActionLogStatus;
}

interface ActionLogAssignmentHistory {
  id: number;
  action_log: number;
  assigned_by: {
    id: number;
    first_name: string;
    last_name: string;
    email: string;
  };
  assigned_to: Array<{
    id: number;
    first_name: string;
    last_name: string;
    email: string;
  }>;
  comment: string | null;
  assigned_at: string;
}

const EconomistDashboard: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [actionLogs, setActionLogs] = useState<ActionLog[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [departmentUnits, setDepartmentUnits] = useState<DepartmentUnit[]>([]);
  const [loading, setLoading] = useState(true);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [selectedMenuKey, setSelectedMenuKey] = useState('assignedToMe');
  const [showAssignedOnly, setShowAssignedOnly] = useState(false);
  const [showPendingApproval, setShowPendingApproval] = useState(false);
  const [commentsModalVisible, setCommentsModalVisible] = useState(false);
  const [selectedLogComments, setSelectedLogComments] = useState<ActionLogComment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [userRole, setUserRole] = useState<Role | null>(null);
  const [selectedDepartmentUnit, setSelectedDepartmentUnit] = useState<string | number | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [selectedLog, setSelectedLog] = useState<ActionLog | null>(null);
  const [statusModalVisible, setStatusModalVisible] = useState(false);
  const [assignModalVisible, setAssignModalVisible] = useState(false);
  const [statusForm] = Form.useForm();
  const [currentLogId, setCurrentLogId] = useState<number | null>(null);
  const [currentStatus, setCurrentStatus] = useState<ActionLogStatus | null>(null);
  const [readComments, setReadComments] = useState<Set<number>>(new Set());
  const [replyingTo, setReplyingTo] = useState<CommentResponse | null>(null);
  const [viewModalVisible, setViewModalVisible] = useState(false);
  const [selectedLogDetails, setSelectedLogDetails] = useState<ActionLog | null>(null);
  const [approvalModalVisible, setApprovalModalVisible] = useState(false);
  const [approvalForm] = Form.useForm();
  const [rejectForm] = Form.useForm();
  const [assignForm] = Form.useForm();
  const [createForm] = Form.useForm();
  const [notificationCount, setNotificationCount] = useState<number>(0);
  const [assignmentHistory, setAssignmentHistory] = useState<ActionLogAssignmentHistory[]>([]);
  const [unreadCounts, setUnreadCounts] = useState<{ [logId: number]: number }>({});
  const [creating, setCreating] = useState(false);
  const [rejectModalVisible, setRejectModalVisible] = useState(false);
  const [approving, setApproving] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  // State for unit filter
  const [unitFilter, setUnitFilter] = useState<'all' | number>(user?.department_unit?.id || 'all');
  
  // Delegation state variables
  const [delegations, setDelegations] = useState<Delegation[]>([]);
  const [delegationModalVisible, setDelegationModalVisible] = useState(false);
  const [delegationForm] = Form.useForm();
  const [revokingDelegations, setRevokingDelegations] = useState<Set<number>>(new Set());

  // New delegation hierarchy state variables
  const [hierarchyInfo, setHierarchyInfo] = useState<any>(null);
  const [hierarchyLoading, setHierarchyLoading] = useState(false);
  const [takeOverModalVisible, setTakeOverModalVisible] = useState(false);
  const [takeOverForm] = Form.useForm();
  const [takingOver, setTakingOver] = useState(false);
  const [isReDelegating, setIsReDelegating] = useState(false);

  // Team leader state variables
  const [showTeamLeaderField, setShowTeamLeaderField] = useState(false);
  const [selectedTeamLeader, setSelectedTeamLeader] = useState<number | null>(null);
  const [teamLeaderOptions, setTeamLeaderOptions] = useState<Array<{label: string, value: number}>>([]);

  // Add these variables at the component level
  const userDesignation = (user?.designation || '').toLowerCase();
  const userRoleName = (user?.role?.name || '').toLowerCase();
  const normalizedDesignation = userDesignation.trim().replace(/\s+/g, ' ');
  
  // Use backend designation checks instead of local regex
  const isAgCPAP = user?.has_ag_cpap_designation || false;
  const isAgACpap = user?.has_ag_acpap_designation || false;
  const canManageDelegations = user?.can_manage_delegations || false;
  
  console.log('Designation check details:', {
    designation: userDesignation,
    normalized: normalizedDesignation,
    isAgCPAP: isAgCPAP,
    isAgACpap: isAgACpap,
    canManageDelegations: canManageDelegations,
    backendChecks: {
      has_ag_cpap_designation: user?.has_ag_cpap_designation,
      has_ag_acpap_designation: user?.has_ag_acpap_designation,
      can_manage_delegations: user?.can_manage_delegations
    }
  });
  
  const isUnitHead = userDesignation.includes('head') || userRoleName.includes('unit_head') || isAgCPAP;
  const isAssistantCommissioner = userRoleName.includes('assistant_commissioner');
  const isCommissioner = userRoleName.includes('commissioner');

  // Ensure unitFilter updates when user loads
  useEffect(() => {
    if (user?.department_unit?.id) {
      setUnitFilter(user.department_unit.id);
    }
  }, [user]);

  useEffect(() => {
    const initializeData = async () => {
      if (!user) {
        navigate('/login');
        return;
      }

      try {
        // Fetch all data in parallel
        const [departmentsData, unitsData, logsData, usersData] = await Promise.all([
          fetchDepartments(),
          fetchDepartmentUnits(),
          fetchActionLogs(),
          fetchUsers()
        ]);

        // Set the data only once
        setDepartments(departmentsData);
        setDepartmentUnits(unitsData);
        setActionLogs(logsData);
        setUsers(usersData);
        
        // All users need to fetch their delegation status to see if they can create logs
        // But only users who can manage delegations need the full delegation list
        if (canManageDelegations) {
          fetchDelegations();
        }
      } catch (error) {
        console.error('Error initializing data:', error);
        message.error('Failed to initialize dashboard data');
      } finally {
        setLoading(false);
      }
    };
    initializeData();
  }, [user]);

  // On mount, set initial navigation based on user designation
  useEffect(() => {
    if (isAgCPAP) {
      // Ag. C/PAP users should see pending approval logs since no one assigns to them
      setShowPendingApproval(true);
      setShowAssignedOnly(false);
      setSelectedMenuKey('pendingApproval');
    } else {
      // Regular users should see assigned logs
      setShowAssignedOnly(true);
      setShowPendingApproval(false);
      setSelectedMenuKey('assignedToMe');
    }
    setStatusFilter('');
  }, [isAgCPAP]);

  const fetchActionLogs = async () => {
    try {
      console.log('[ECONOMIST_DASHBOARD] fetchActionLogs: Starting fetch...');
      console.log('[ECONOMIST_DASHBOARD] fetchActionLogs: Current user:', {
        id: user?.id,
        role: user?.role?.name,
        department: user?.department,
        department_unit: user?.department_unit?.id
      });
      
      const response = await actionLogService.getAll();
      console.log('[ECONOMIST_DASHBOARD] fetchActionLogs: Raw API response:', response);
      
      const logsArray = Array.isArray(response) ? response : [];
      console.log('[ECONOMIST_DASHBOARD] fetchActionLogs: Processed logs array length:', logsArray.length);
      
      // Filter logs based on user's role and unit
      const filteredLogs = logsArray.filter(log => {
        console.log('[ECONOMIST_DASHBOARD] fetchActionLogs: Checking log:', {
          id: log.id,
          title: log.title,
          status: log.status,
          closure_approval_stage: log.closure_approval_stage,
          created_by_unit: log.created_by?.department_unit?.id,
          user_unit: user?.department_unit?.id,
          assigned_to: log.assigned_to,
          user_id: user?.id,
          department_id: log.department_id,
          department_unit: log.department_unit
        });
        
        // If user is Commissioner or Assistant Commissioner, they can see all logs
        if (user?.role?.name?.toLowerCase() === 'commissioner' || 
            user?.role?.name?.toLowerCase() === 'assistant_commissioner') {
          console.log('[ECONOMIST_DASHBOARD] fetchActionLogs: User is commissioner/assistant commissioner, showing log');
          return true;
        }
        
        // For other users, the backend should have already filtered based on department and assignment
        // Just add any additional frontend-specific filtering here if needed
        console.log('[ECONOMIST_DASHBOARD] fetchActionLogs: User is regular user, backend should have filtered appropriately');
        return true;
      });
      
      console.log('[ECONOMIST_DASHBOARD] fetchActionLogs: Final filtered logs count:', filteredLogs.length);
      console.log('[ECONOMIST_DASHBOARD] fetchActionLogs: Final filtered logs:', filteredLogs.map(log => ({
        id: log.id,
        title: log.title,
        status: log.status,
        closure_approval_stage: log.closure_approval_stage,
        created_by_unit: log.created_by?.department_unit?.id,
        assigned_to: log.assigned_to,
        department_id: log.department_id,
        department_unit: log.department_unit
      })));

      return filteredLogs;
    } catch (error) {
      console.error('[ECONOMIST_DASHBOARD] fetchActionLogs: Error:', error);
      message.error('Failed to fetch action logs');
      return [];
    }
  };

  const fetchDepartments = async () => {
    try {
      const response = await departmentService.getAll();
      let departmentsData: Department[] = [];
      
      if (Array.isArray(response)) {
        departmentsData = response;
      } else if (response && typeof response === 'object') {
        const typedResponse = response as PaginatedResponse<Department>;
        departmentsData = Array.isArray(typedResponse.results) ? typedResponse.results : [];
      }
      
      return departmentsData;
    } catch (error) {
      console.error('Error fetching departments:', error);
      message.error('Failed to fetch departments');
      return [];
    }
  };

  const fetchDepartmentUnits = async () => {
    try {
      const response = await departmentService.getUnits();
      let units: DepartmentUnit[] = [];
      
      if (Array.isArray(response)) {
        units = response;
      } else if (response && typeof response === 'object') {
        const typedResponse = response as PaginatedResponse<DepartmentUnit>;
        if (Array.isArray(typedResponse.results)) {
          units = typedResponse.results;
        } else {
          console.warn('Unexpected response format:', response);
          units = [];
        }
      }
      
      return units;
    } catch (error) {
      console.error('Error fetching department units:', error);
      message.error('Failed to fetch department units');
      return [];
    }
  };

  const fetchUsers = async () => {
    if (!user) return [];

    try {
      setUsersLoading(true);
      const response = await userService.getByDepartment(user.department);
      let usersArray: User[] = [];
      
      if (Array.isArray(response)) {
        usersArray = response;
      } else if (response && typeof response === 'object') {
        const typedResponse = response as PaginatedResponse<User>;
        if (Array.isArray(typedResponse.results)) {
          usersArray = typedResponse.results;
        }
      }
      
      // Only filter out inactive users
      return usersArray.filter(user => user.is_active);
    } catch (error) {
      console.error('Error fetching users:', error);
      message.error('Failed to fetch users');
      return [];
    } finally {
      setUsersLoading(false);
    }
  };

  // Delegation functions - only for Ag. C/PAP designation
  const fetchDelegations = async () => {
    if (!canManageDelegations) return; // Only fetch if user can manage delegations
    
    try {
      const response = await delegationService.getAll();
      console.log('Delegations response:', response);
      
      // Handle different response structures
      let delegationsArray: Delegation[] = [];
      if (Array.isArray(response)) {
        delegationsArray = response;
      } else if (response && typeof response === 'object') {
        // If it's a paginated response
        const responseObj = response as any;
        if (responseObj.results && Array.isArray(responseObj.results)) {
          delegationsArray = responseObj.results;
        } else if (responseObj.data && Array.isArray(responseObj.data)) {
          delegationsArray = responseObj.data;
        }
      }
      
      console.log('Processed delegations array:', delegationsArray);
      setDelegations(delegationsArray);
    } catch (error) {
      console.error('Error fetching delegations:', error);
      message.error('Failed to fetch delegations');
      setDelegations([]); // Set empty array on error
    }
  };



  const handleCreateDelegation = async (values: any) => {
    if (!canManageDelegations) {
      message.error('Only Ag. C/PAP users can create delegations');
      return;
    }
    
    try {
      // Convert dayjs object to ISO string if it exists
      let expiresAt: string | null = null;
      if (values.expires_at) {
        try {
          // Use dayjs utility to ensure proper conversion
          expiresAt = dayjs(values.expires_at).toISOString();
        } catch (e) {
          console.warn('Could not convert expires_at to ISO string:', values.expires_at);
          expiresAt = null;
        }
      }
      
      const delegationData: CreateDelegationRequest = {
        delegated_to_id: values.delegated_to_id,
        expires_at: expiresAt || null, // Ensure we send null instead of undefined
        reason: values.reason
      };
      
      console.log('DEBUG: Creating delegation with data:', delegationData);
      console.log('DEBUG: Original expires_at value:', values.expires_at);
      console.log('DEBUG: Processed expires_at value:', expiresAt);
      console.log('DEBUG: expires_at type:', typeof values.expires_at);
      console.log('DEBUG: expires_at constructor:', values.expires_at?.constructor?.name);
      console.log('DEBUG: Raw form values:', values);
      console.log('DEBUG: Final delegation data being sent:', delegationData);
      
      // Verify that the target user exists before sending the request
      const targetUser = users.find(u => u.id === delegationData.delegated_to_id);
      if (!targetUser) {
        console.error('ERROR: Target user ID', delegationData.delegated_to_id, 'not found in users list');
        console.log('DEBUG: Available users:', users.map(u => ({ id: u.id, name: `${u.first_name} ${u.last_name}`, username: u.username })));
        message.error(`Cannot create delegation: target user (ID: ${delegationData.delegated_to_id}) not found`);
        return;
      }
      
      console.log('DEBUG: Target user verified:', targetUser);
      
      // Debug current user information
      console.log('DEBUG: Current user:', {
        id: user?.id,
        username: user?.username,
        role: user?.role?.name,
        designation: user?.designation,
        canManageDelegations: canManageDelegations
      });
      
      // Debug target user information
      console.log('DEBUG: Target user details:', {
        id: targetUser.id,
        username: targetUser.username,
        role: targetUser.role?.name,
        designation: targetUser.designation,
        is_active: targetUser.is_active
      });
      
      await delegationService.create(delegationData);
      
      // Show appropriate success message based on whether this was a re-delegation
      if (isReDelegating) {
        message.success('Delegation re-created successfully');
      } else {
        message.success('Delegation created successfully. Any existing delegation has been automatically revoked.');
      }
      
      setDelegationModalVisible(false);
      delegationForm.resetFields();
      setIsReDelegating(false); // Reset re-delegating state
      fetchDelegations();
    } catch (error) {
      console.error('Error creating delegation:', error);
      
      // Log detailed error information
      if (error.response) {
        console.error('Backend response status:', error.response.status);
        console.error('Backend response data:', error.response.data);
        console.error('Backend response headers:', error.response.headers);
        
        // Show backend error message if available
        if (error.response.data && error.response.data.message) {
          message.error(`Backend error: ${error.response.data.message}`);
        } else if (error.response.data && error.response.data.error) {
          message.error(`Backend error: ${error.response.data.error}`);
        } else if (error.response.data && typeof error.response.data === 'string') {
          message.error(`Backend error: ${error.response.data}`);
        } else {
          message.error(`Backend error: ${JSON.stringify(error.response.data)}`);
        }
      } else if (error.request) {
        console.error('Request was made but no response received:', error.request);
        message.error('No response from server. Please check your connection.');
      } else {
        console.error('Error setting up request:', error.message);
        message.error(`Request setup error: ${error.message}`);
      }
    }
  };

  const handleRevokeDelegation = async (delegationId: number) => {
    if (!canManageDelegations) {
      message.error('Only Ag. C/PAP users can revoke delegations');
      return;
    }
    
    try {
      setRevokingDelegations(prev => new Set(prev).add(delegationId));
      
      await delegationService.revoke(delegationId);
      message.success('Delegation revoked successfully');
      fetchDelegations();
    } catch (error) {
      console.error('Error revoking delegation:', error);
      message.error('Failed to revoke delegation');
    } finally {
      setRevokingDelegations(prev => {
        const newSet = new Set(prev);
        newSet.delete(delegationId);
        return newSet;
      });
    }
  };



  const getFilteredUsers = (currentUser: any) => {
    const isCommissioner = currentUser.role?.name?.toLowerCase() === 'commissioner';
    const isAssistantCommissioner = currentUser.role?.name?.toLowerCase() === 'assistant_commissioner';
    const isUnitHead = currentUser.designation?.toLowerCase().includes('head') || 
                      (currentUser.designation?.match(/^[A-Z]{2,3}\d+\/PAP$/) && currentUser.designation?.toLowerCase().includes('1')) ||
                      currentUser.designation?.toLowerCase().includes('ag. c/pap');
    
    // Check if current user is Ag. C/PAP and has created delegations for other users
    const isAgCPAP = currentUser.designation?.toLowerCase().includes('ag. c/pap');
    const hasCreatedDelegations = isAgCPAP && delegations.some(d => 
      d.delegated_by_id === currentUser.id && d.is_active
    );
    
    // Check if current user has received a delegation (is a delegated user)
    const hasReceivedDelegation = currentUser?.has_active_delegation && currentUser.has_active_delegation.is_valid === true;

    return users.filter(u => {
      // No staff can assign themselves
      if (u.id === currentUser?.id) {
        return false;
      }
      
      // Ag. C/PAP users who have delegated to other users can assign to all users except Ag. C/PAP users
      if (hasCreatedDelegations) {
        return !u.designation?.toLowerCase().includes('ag. c/pap');
      }
      
      // Users who have received a delegation can assign to all users except Ag. C/PAP users
      if (hasReceivedDelegation) {
        return !u.designation?.toLowerCase().includes('ag. c/pap');
      }
      
      // Commissioner: can assign to all staff except themselves and other commissioners
      if (isCommissioner) {
        return u.role?.name?.toLowerCase() !== 'commissioner';
      }
      // Assistant Commissioner: can assign to all staff except themselves and commissioners
      if (isAssistantCommissioner) {
        return u.role?.name?.toLowerCase() !== 'commissioner' && u.id !== currentUser.id;
      }
      // Unit Head: can only assign staff in their own unit, excluding themselves and other unit heads
      if (isUnitHead) {
        const isInSameUnit = u.department_unit?.id === currentUser.department_unit?.id;
        const isNotUnitHead = !u.designation?.toLowerCase().includes('head') && 
                             !(u.designation?.match(/^[A-Z]{2,3}\d+\/PAP$/) && currentUser.designation?.toLowerCase().includes('1')) &&
                             !u.designation?.toLowerCase().includes('ag. c/pap');
        return isInSameUnit && isNotUnitHead && u.id !== currentUser.id;
      }
      // For regular users, only show users from their unit, excluding themselves
      const isInSameUnit = u.department_unit?.id === currentUser.department_unit?.id;
      return isInSameUnit && u.id !== currentUser.id;
    });
  };

  const handleCreate = async (values: any) => {
    if (creating) return; // Prevent double submit
    setCreating(true);
    try {
      console.log('[ECONOMIST_DASHBOARD] handleCreate: Starting action log creation');
      console.log('[ECONOMIST_DASHBOARD] handleCreate: Form values:', values);
      console.log('[ECONOMIST_DASHBOARD] handleCreate: Current user:', {
        id: user?.id,
        role: user?.role?.name,
        department: user?.department,
        department_unit: user?.department_unit?.id
      });
      
      if (!user) {
        message.error('User not found');
        setCreating(false);
        return;
      }

      // Format the date to ISO string
      const formattedDueDate = values.due_date ? values.due_date.toISOString() : null;

      // Format assigned_to to be an empty array if undefined
      const assignedTo = values.assigned_to || [];
      
      // Convert string IDs to integers for the backend
      const assignedToInts = assignedTo.map((id: string | number) => parseInt(id.toString()));

      // For commissioners and assistant commissioners, get the department and unit from the first assigned user
      let departmentId = user.department?.id || user.department;
      let departmentUnitId = user.department_unit?.id;

      console.log('[ECONOMIST_DASHBOARD] handleCreate: Department debug:', {
        userDepartment: user.department,
        userDepartmentType: typeof user.department,
        userDepartmentId: user.department?.id,
        userDepartmentIdType: typeof user.department?.id
      });

      if ((user.role?.name?.toLowerCase() === 'commissioner' || 
           user.role?.name?.toLowerCase() === 'assistant_commissioner') && 
          assignedTo.length > 0) {
        const firstAssignedUser = users.find(u => u.id.toString() === assignedTo[0]);
        if (firstAssignedUser) {
          console.log('[ECONOMIST_DASHBOARD] handleCreate: First assigned user department:', {
            firstAssignedUserDepartment: firstAssignedUser.department,
            firstAssignedUserDepartmentType: typeof firstAssignedUser.department,
            firstAssignedUserDepartmentId: firstAssignedUser.department?.id,
            firstAssignedUserDepartmentIdType: typeof firstAssignedUser.department?.id
          });
          
          // Fix: Extract the ID from the department object
          departmentId = firstAssignedUser.department?.id || firstAssignedUser.department;
          departmentUnitId = firstAssignedUser.department_unit?.id;
          
          console.log('[ECONOMIST_DASHBOARD] handleCreate: Using assigned user department/unit:', {
            departmentId,
            departmentIdType: typeof departmentId,
            departmentUnitId,
            assignedUser: firstAssignedUser
          });
        }
      }

      const createData: CreateActionLogData = {
        title: values.title,
        description: values.description,
        due_date: formattedDueDate,
        priority: values.priority.charAt(0).toUpperCase() + values.priority.slice(1), // Capitalize first letter
        department_id: typeof departmentId === 'object' ? departmentId.id : departmentId,
        assigned_to: assignedToInts,
        team_leader: showTeamLeaderField ? values.team_leader : null
      };

      console.log('[ECONOMIST_DASHBOARD] handleCreate: Final create data:', createData);
      console.log('[ECONOMIST_DASHBOARD] handleCreate: Assigned to details:', {
        originalAssignedTo: assignedTo,
        convertedAssignedTo: assignedToInts,
        assignedToLength: assignedTo.length,
        assignedToType: typeof assignedTo,
        isArray: Array.isArray(assignedTo)
      });
      
      // Additional debugging
      console.log('[ECONOMIST_DASHBOARD] handleCreate: Data being sent to backend:', {
        title: createData.title,
        titleType: typeof createData.title,
        description: createData.description,
        descriptionType: typeof createData.description,
        due_date: createData.due_date,
        due_dateType: typeof createData.due_date,
        priority: createData.priority,
        priorityType: typeof createData.priority,
        department_id: createData.department_id,
        department_idType: typeof createData.department_id,
        assigned_to: createData.assigned_to,
        assigned_toType: typeof createData.assigned_to,
        assigned_toLength: createData.assigned_to?.length,
        assigned_toIsArray: Array.isArray(createData.assigned_to),
        team_leader: createData.team_leader,
        team_leaderType: typeof createData.team_leader,
        showTeamLeaderField: showTeamLeaderField
      });
      
      // Debug users state
      console.log('[ECONOMIST_DASHBOARD] handleCreate: Users state:', {
        usersCount: users.length,
        users: users.map(u => ({ id: u.id, name: `${u.first_name} ${u.last_name}` })),
        assignedToValues: assignedTo,
        assignedToInts: assignedToInts
      });
      
      // Validate required fields
      if (!createData.title || !createData.priority) {
        message.error('Please fill in all required fields');
        setCreating(false);
        return;
      }

      // Validate that at least one user is assigned
      if (!createData.assigned_to || createData.assigned_to.length === 0) {
        message.error('Please select at least one user to assign the action log to');
        setCreating(false);
        return;
      }

              // Validate team leader when 2+ assignees
              if (createData.assigned_to.length >= 2 && !createData.team_leader) {
          message.error('Please select a team leader when assigning to 2 or more users');
          setCreating(false);
          return;
        }

      // Actually create the log
      console.log('[ECONOMIST_DASHBOARD] handleCreate: Calling actionLogService.create');
      const newLog = await actionLogService.create(createData);
      console.log('[ECONOMIST_DASHBOARD] handleCreate: New log created:', newLog);
      
      // Prepend the new log to the actionLogs state
      setActionLogs(prevLogs => [newLog, ...prevLogs]);
      setCreateModalVisible(false);
      createForm.resetFields();
      setShowTeamLeaderField(false);
      setSelectedTeamLeader(null);
      setTeamLeaderOptions([]);
      message.success('Action log created successfully');
    } catch (error) {
      console.error('[ECONOMIST_DASHBOARD] handleCreate: Error:', error);
      message.error('Failed to create action log');
    } finally {
      setCreating(false);
    }
  };

  const handleAssign = async (values: any) => {
    try {
      if (!selectedLog) return;
      
      // Get the first assigned user to determine department and unit
      const firstAssignedUser = users.find(u => u.id.toString() === values.assigned_to[0]);
      if (!firstAssignedUser) {
        message.error('Could not find assigned user information');
        return;
      }

      const updateData = {
        assigned_to: values.assigned_to.map((id: string | number) => parseInt(id.toString())),
        assigned_by: user?.id,
        // Always update department and unit for new assignments
        department_id: firstAssignedUser.department,
        department_unit: firstAssignedUser.department_unit?.id,
        ...(selectedLog.assigned_to && values.due_date ? { due_date: values.due_date } : {})
      };

      console.log('Assignment update data:', {
        logId: selectedLog.id,
        updateData,
        assignedUser: firstAssignedUser,
        isReassignment: !!selectedLog.assigned_to
      });

      await actionLogService.update(selectedLog.id, updateData);
      message.success(selectedLog.assigned_to ? 'Action log reassigned successfully' : 'Action log assigned successfully');
      setAssignModalVisible(false);
      assignForm.resetFields();
      
      // Refresh the logs list to ensure we have the latest data
      const refreshedLogs = await fetchActionLogs();
      setActionLogs(refreshedLogs);
    } catch (error) {
      console.error('Error assigning action log:', error);
      message.error('Failed to assign action log');
    }
  };

  const handleStatusUpdate = async (values: any) => {
    try {
      if (!selectedLog) return;
      
      console.log('Starting status update for log:', {
        id: selectedLog.id,
        currentStatus: selectedLog.status,
        newStatus: values.status,
        user: {
          id: user?.id,
          role: user?.role?.name,
          designation: user?.designation,
          unit: user?.department_unit?.id
        },
        original_assigner: selectedLog.original_assigner
      });
      
      // Prepare update data
      const updateData: ActionLogUpdate = {
        status: values.status,
        comment: values.status_comment
      };

      // If status is being set to closed, the backend will automatically determine the approval chain
      // based on the original assigner's role
      if (values.status === 'closed') {
        console.log('Setting status to closed - backend will determine approval workflow based on original assigner');
        console.log('Original assigner:', selectedLog.original_assigner);
      }
      
      // Update the status and add comment
      const updatedLog = await actionLogService.update(selectedLog.id, updateData);
      console.log('Update response:', {
        id: updatedLog.id,
        status: updatedLog.status,
        closure_approval_stage: updatedLog.closure_approval_stage,
        closure_requested_by: updatedLog.closure_requested_by
      });
      
      // Update the action logs list with the new data
      setActionLogs(prevLogs => {
        const newLogs = prevLogs.map(log => 
          log.id === selectedLog.id 
            ? { 
                ...log,
                ...updatedLog
              } as ActionLog
            : log
      );
        return newLogs;
      });
      
      if (values.status === 'closed') {
        message.success('Status updated to closed. The action log is now pending approval by Ag. C/PAP users.');
      } else {
        message.success('Status updated successfully');
      }
      
      setStatusModalVisible(false);
      statusForm.resetFields();
      
      // If comments modal is open, update the comments
      if (commentsModalVisible && selectedLogComments.length > 0) {
        await fetchComments(selectedLog.id);
      }

      // Refresh the logs list to ensure we have the latest data
      console.log('Refreshing logs list...');
      const refreshedLogs = await fetchActionLogs();
      console.log('Refreshed logs:', refreshedLogs.map(log => ({
        id: log.id,
        status: log.status,
        closure_approval_stage: log.closure_approval_stage
      })));
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
      
      const userDesignation = (user?.designation || '').toLowerCase();
      const userRoleName = (user?.role?.name || '').toLowerCase();
      const normalizedDesignation = userDesignation.trim().replace(/\s+/g, ' ');
      
      // Use backend designation checks instead of local regex
      const isAgCPAP = user?.has_ag_cpap_designation || false;
      
      console.log('Designation check details:', {
        designation: userDesignation,
        normalized: normalizedDesignation,
        isAgCPAP: isAgCPAP,
        backendCheck: user?.has_ag_cpap_designation
      });
      
      // CORRECTED FLOW: Use backend delegation-aware approval logic
      // This properly handles Ag. C/PAP on leave and Ag. AC/PAP taking over responsibilities
      const canApproveAtStage = (
        selectedLog.status === 'pending_approval' && // Status must be "pending approval"
        user?.can_approve_action_logs // User must be able to approve based on current delegation status
      );
      
      console.log('[APPROVE] Corrected approval flow check:', {
        status: selectedLog.status,
        isPendingApproval: selectedLog.status === 'pending_approval',
        isAgCPAP,
        canApproveAtStage,
        logId: selectedLog.id,
        title: selectedLog.title
      });
      
      console.log('User designation:', user?.designation, 'User role:', user?.role?.name);
      console.log('userDesignation:', userDesignation, 'Designation match:', isAgCPAP);
      console.log('handleApprove called', {
        selectedLog,
        user,
        isAgCPAP,
        canApproveAtStage,
        status: selectedLog.status,
        closure_approval_stage: selectedLog.closure_approval_stage
      });
      
      if (!canApproveAtStage) {
        console.log('handleApprove: Not authorized', { canApproveAtStage });
        message.error('You are not authorized to approve action logs with pending approval status');
        setApproving(false);
        return;
      }
      
      const approveData: any = {
        comment: values.approval_comment || 'Approved'
      };
      
      // Use the approve endpoint - status will automatically change to "Done" (closed) upon approval
      const updatedLog = await actionLogService.approve(selectedLog.id, approveData);
      
      // Update the log in the UI with the backend response
      setActionLogs(prevLogs => prevLogs.map(log =>
        log.id === selectedLog.id ? { ...log, ...updatedLog } : log
      ));
      
      message.success('Action log approved successfully. Status has been changed to "Done".');
      setApprovalModalVisible(false);
      approvalForm.resetFields();
      setApproving(false);
    } catch (error) {
      console.error('Error approving action log:', error);
      message.error('Failed to approve action log');
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
      
      const userDesignation = (user?.designation || '').toLowerCase();
      const normalizedDesignation = userDesignation.trim().replace(/\s+/g, ' ');
      
      // Only Ag. C/PAP users can reject action logs
      const isAgCPAP = user?.has_ag_cpap_designation || false;
      
      // CORRECTED FLOW: Use backend delegation-aware rejection logic
      // This properly handles Ag. C/PAP on leave and Ag. AC/PAP taking over responsibilities
      const canRejectAtStage = (
        selectedLog.status === 'pending_approval' && // Status must be "pending approval"
        user?.can_approve_action_logs // User must be able to approve based on current delegation status
      );
      
      console.log('[REJECT] Corrected rejection flow check:', {
        status: selectedLog.status,
        isPendingApproval: selectedLog.status === 'pending_approval',
        isAgCPAP,
        canRejectAtStage,
        logId: selectedLog.id,
        title: selectedLog.title
      });
      
      console.log('handleReject called', {
        selectedLog,
        user,
        isAgCPAP,
        canRejectAtStage,
        status: selectedLog.status,
        closure_approval_stage: selectedLog.closure_approval_stage
      });
      
      if (!canRejectAtStage) {
        console.log('handleReject: Not authorized', { canRejectAtStage });
        message.error('You are not authorized to reject action logs with pending approval status');
        setRejecting(false);
        return;
      }
      
      const rejectData: any = {
        comment: values.rejection_comment || 'Revise submission'
      };
      
      // Use the reject endpoint - status will automatically go back to assignee upon rejection
      const updatedLog = await actionLogService.reject(selectedLog.id, rejectData);
      
      // Update the log in the UI with the backend response
      setActionLogs(prevLogs => prevLogs.map(log =>
        log.id === selectedLog.id ? { ...log, ...updatedLog } : log
      ));
      
      message.success('Action log rejected successfully. Status has been sent back to the assignee for revision.');
      setRejectModalVisible(false);
      rejectForm.resetFields();
      setRejecting(false);
    } catch (error) {
      console.error('Error rejecting action log:', error);
      message.error('Failed to reject action log');
      setRejecting(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'open':
        return 'blue';
      case 'in_progress':
        return 'orange';
      case 'pending_approval':
        return 'purple';
      case 'closed':
        return 'green';
      default:
        return 'default';
    }
  };

  if (!user) return <Navigate to="/login" replace />;

  const getFullName = (user: Partial<User> | null) => {
    if (!user) return '';
    return `${user.first_name || ''} ${user.last_name || ''}`.trim();
  };

  // Helper function to check if current user can update status based on team leader logic
  const canUserUpdateStatus = (actionLog: any) => {
    // If there are less than 2 assignees, all assignees can update status
    if (!actionLog.assigned_to || actionLog.assigned_to.length < 2) {
      return true;
    }
    
    // If there are 2+ assignees, only the team leader can update status
    if (actionLog.team_leader) {
      return actionLog.team_leader === user?.id;
    }
    
    // If there are 2+ assignees but no team leader set, no one can update status
    return false;
  };

  const canAssign = user.role?.can_update_status || false;
  const canUpdateStatus = user.role?.can_update_status || false;
  // Use the delegation-aware approval permission instead of basic role permission
  const canApprove = user?.can_approve_action_logs || false;
  const canConfigure = user.role?.can_configure || false;
  
  // Users can create logs based purely on designation and delegation
  // Ag. C/PAP can always create logs, others need delegation
  const hasActiveDelegation = user?.has_active_delegation && user.has_active_delegation.is_valid === true;
  
  // Determine if user can create action logs:
  // 1. Ag. C/PAP users can always create logs
  // 2. Other users can only create logs if they have an active delegation
  const canCreateLogs = isAgCPAP || hasActiveDelegation;
  
  const canViewAllLogs = user.role?.can_view_all_logs || false;

  // Debug logging
  console.log('[ECONOMIST_DASHBOARD] Delegation check:', {
    user: user?.username,
    role: user?.role?.name,
    isAgCPAP,
    hasActiveDelegation,
    delegationDetails: user?.has_active_delegation,
    canCreateActionLogsByDesignation: user?.can_create_action_logs_by_designation,
    canCreateLogs
  });
  
  // More detailed logging
  console.log('[ECONOMIST_DASHBOARD] Detailed delegation check:', {
    username: user?.username,
    roleName: user?.role?.name,
    userDesignation: userDesignation,
    normalizedDesignation,
    isAgCPAP,
    hasActiveDelegation,
    delegationObject: user?.has_active_delegation,
    delegationIsValid: user?.has_active_delegation?.is_valid,
    canCreateActionLogsByDesignation: user?.can_create_action_logs_by_designation,
    finalCanCreateLogs: canCreateLogs
  });

  // Update status filter options
  const statusFilterOptions = [
    { text: 'New', value: 'open' },
    { text: 'In Progress', value: 'in_progress' },
    { text: 'Pending Approval', value: 'pending_approval' },
    { text: 'Done', value: 'closed' }
  ];

  const getFilteredLogs = () => {
    let filteredLogs = [...actionLogs];
    console.log('[ECONOMIST_DASHBOARD] getFilteredLogs: Starting with', filteredLogs.length, 'logs');
    console.log('[ECONOMIST_DASHBOARD] getFilteredLogs: showAssignedOnly =', showAssignedOnly);
    console.log('[ECONOMIST_DASHBOARD] getFilteredLogs: showPendingApproval =', showPendingApproval);
    console.log('[ECONOMIST_DASHBOARD] getFilteredLogs: search =', search);
    console.log('[ECONOMIST_DASHBOARD] getFilteredLogs: statusFilter =', statusFilter);

    // If "Assigned To Me" is selected, show assigned logs and, for approvers, logs pending their approval
    if (showAssignedOnly) {
      const isUnitHead = userDesignation.includes('head') || userRoleName.includes('unit_head') || isAgCPAP || isAgACpap;
      const isAssistantCommissioner = userRoleName.includes('assistant_commissioner');
      const isCommissioner = userRoleName.includes('commissioner');
      console.log('[ECONOMIST_DASHBOARD] getFilteredLogs: Filtering for assigned only, user ID =', user?.id);
      console.log('[ECONOMIST_DASHBOARD] getFilteredLogs: isUnitHead =', isUnitHead, 'isAssistantCommissioner =', isAssistantCommissioner, 'isCommissioner =', isCommissioner);
      
      filteredLogs = filteredLogs.filter(log => {
        const isAssignedToMe = log.assigned_to?.includes(user?.id || 0);
        const isPendingApproval = (isUnitHead && log.closure_approval_stage === 'unit_head' && log.status === 'pending_approval') ||
                                 (isAssistantCommissioner && log.closure_approval_stage === 'assistant_commissioner' && log.status === 'pending_approval') ||
                                 (isCommissioner && log.closure_approval_stage === 'commissioner' && log.status === 'pending_approval');
        
        // Exclude logs with status "Done" (closed) from "Assigned To Me" view
        // This ensures "Assigned To Me" only shows incoming and pending completion logs
        const isNotDone = log.status !== 'closed';
        
        console.log('[ECONOMIST_DASHBOARD] getFilteredLogs: Log', log.id, '- isAssignedToMe =', isAssignedToMe, '- isPendingApproval =', isPendingApproval, '- isNotDone =', isNotDone, '- assigned_to =', log.assigned_to);
        
        return (isAssignedToMe || isPendingApproval) && isNotDone;
      });
      console.log('[ECONOMIST_DASHBOARD] getFilteredLogs: After assigned filter,', filteredLogs.length, 'logs remaining');
    }

    // If "Pending Approval" is selected, show logs that need approval
    // CORRECTED FLOW: Show only logs with "pending approval" status that Ag. C/PAP users can approve/reject
    if (showPendingApproval) {
      filteredLogs = filteredLogs.filter(log => {
        // Show logs that are pending approval (these are what Ag. C/PAP users approve/reject)
        const isPendingApproval = log.status === 'pending_approval' && log.closure_approval_stage !== 'none';
        
        return isPendingApproval;
      });
      console.log('[ECONOMIST_DASHBOARD] getFilteredLogs: After pending approval filter (corrected flow),', filteredLogs.length, 'logs remaining');
    }

    // Apply search filter
    if (search) {
      const searchLower = search.toLowerCase();
      filteredLogs = filteredLogs.filter(log => 
        log.title.toLowerCase().includes(searchLower) ||
        log.description.toLowerCase().includes(searchLower)
      );
      console.log('[ECONOMIST_DASHBOARD] getFilteredLogs: After search filter,', filteredLogs.length, 'logs remaining');
    }

    // Apply status filter
    if (statusFilter) {
      filteredLogs = filteredLogs.filter(log => 
        log.status.toLowerCase() === statusFilter.toLowerCase()
      );
      console.log('[ECONOMIST_DASHBOARD] getFilteredLogs: After status filter,', filteredLogs.length, 'logs remaining');
    }

    console.log('[ECONOMIST_DASHBOARD] getFilteredLogs: Final result,', filteredLogs.length, 'logs');
    return filteredLogs;
  };

  const fetchComments = async (logId: number) => {
    try {
      setCommentsLoading(true);
      const response = await actionLogService.getComments(logId);
      
      // Sort comments by date, newest first
      const sortedComments = response.map(comment => ({
        id: comment.id,
        action_log: logId,
        user: {
          ...comment.user,
          email: comment.user.email || ''
        },
        comment: comment.comment,
        created_at: comment.created_at,
        updated_at: comment.updated_at
      }));
      
      setSelectedLogComments(sortedComments);
      
      // Mark comments as read only if they are not from the current user
      const newReadComments = new Set(readComments);
      sortedComments.forEach(comment => {
        if (comment.user.id !== user?.id) {
          newReadComments.add(comment.id);
        }
      });
      setReadComments(newReadComments);
    } catch (error) {
      console.error('Error fetching comments:', error);
      message.error('Failed to fetch comments');
    } finally {
      setCommentsLoading(false);
    }
  };

  const checkNewComments = useCallback((comments: ActionLogComment[]) => {
    let count = 0;
    const checkComment = (comment: ActionLogComment) => {
      if (comment.user.id !== user?.id && !comment.is_viewed) {
        count++;
      }
      if (comment.replies) {
        comment.replies.forEach(reply => checkComment(reply));
      }
    };
    comments.forEach(checkComment);
    setNotificationCount(count);
  }, [user?.id]);

  useEffect(() => {
    if (selectedLogComments.length > 0) {
      checkNewComments(selectedLogComments);
    }
  }, [selectedLogComments, checkNewComments]);

  const markCommentsAsViewed = useCallback(async () => {
    if (!selectedLog) return;
    
    try {
      const response = await axios.post(
        `http://localhost:8000/api/action-logs/${selectedLog.id}/mark_comments_viewed/`,
        {},
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`,
          },
        }
      );
      
      if (response.status === 200) {
        setNotificationCount(0);
        setSelectedLogComments(prev => 
          prev.map(comment => ({
            ...comment,
            is_viewed: true,
            replies: comment.replies?.map(reply => ({
              ...reply,
              is_viewed: true
            }))
          }))
        );
      }
    } catch (error) {
      console.error('Error marking comments as viewed:', error);
    }
  }, [selectedLog]);

  const handleViewComments = async (log: ActionLog) => {
      setSelectedLog(log);
    try {
      const comments = await actionLogService.getComments(log.id);
      // Transform the response data to match our interface
      const transformedComments: ActionLogComment[] = comments.map((comment: any) => ({
        ...comment,
        is_viewed: false, // Default to false for new comments
        is_approved: comment.is_approved || false,
        status: comment.status || 'open',
        user: {
          ...comment.user,
          email: comment.user.email || ''
        },
        replies: comment.replies?.map((reply: any) => ({
          ...reply,
          is_viewed: false, // Default to false for new replies
          is_approved: reply.is_approved || false,
          status: reply.status || 'open',
          user: {
            ...reply.user,
            email: reply.user.email || ''
          }
        }))
      }));
      setSelectedLogComments(transformedComments);
      setCommentsModalVisible(true);
      await actionLogService.markNotificationsRead(log.id);
      setUnreadCounts(prev => ({ ...prev, [log.id]: 0 }));
      markCommentsAsViewed();
    } catch (error) {
      console.error('Error fetching comments:', error);
      message.error('Failed to fetch comments');
    }
  };

  const handleAddComment = async () => {
    if (!selectedLog || !newComment.trim()) return;

      setSubmittingComment(true);
    try {
      const payload: any = { comment: newComment };
      if (replyingTo && replyingTo.id) {
        payload.parent_id = replyingTo.id;
      }
      console.log('Adding comment:', payload);
      const comment = await actionLogService.addComment(selectedLog.id, payload);
      
      console.log('Comment added successfully:', comment);
      setSelectedLogComments(prev => [comment, ...prev]);
      setNewComment('');
      setReplyingTo(null);
      message.success('Comment added successfully');
    } catch (error) {
      console.error('Error adding comment:', error);
      message.error('Failed to add comment');
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleReply = (comment: CommentResponse) => {
    setReplyingTo(comment);
    setNewComment('');
  };

  const handleCancelReply = () => {
    setReplyingTo(null);
    setNewComment('');
  };

  // Professional color palette for user comments
  const commentColors = [
    '#e3f2fd', // Blue
    '#e8f5e9', // Green
    '#fff3e0', // Orange
    '#fce4ec', // Pink
    '#ede7f6', // Purple
    '#f3e5f5', // Lavender
    '#f9fbe7', // Lime
    '#e0f2f1', // Teal
    '#f5f5f5', // Gray
  ];
  const getCommentColor = (userId: number) => {
    return commentColors[userId % commentColors.length];
  };

  const statusTagColors = {
    open: { bg: '#1677ff', color: '#fff' }, // New
    in_progress: { bg: '#faad14', color: '#fff' },
    pending_approval: { bg: '#722ed1', color: '#fff' },
    closed: { bg: '#52c41a', color: '#fff' }, // Done
    default: { bg: '#d9d9d9', color: '#333' }
  };

  const renderComment = (comment: ActionLogComment) => {
    const isCurrentUser = comment.user.id === user?.id;
    // Pick status tag color
    const tagStyle = statusTagColors[comment.status || 'default'] || statusTagColors.default;
    return (
      <div style={{ 
        marginBottom: '16px',
        padding: '12px',
        backgroundColor: getCommentColor(comment.user.id),
        borderRadius: '8px',
        border: isCurrentUser ? '2px solid #90caf9' : '1px solid #e0e0e0',
        position: 'relative'
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginBottom: '2px'
        }}>
          <div style={{ fontWeight: 500 }}>
            {comment.user.first_name} {comment.user.last_name}
        </div>
          <div style={{ color: '#666' }}>
            {format(new Date(comment.created_at), 'MMM dd, yyyy HH:mm')}
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', margin: '2px 0 4px 0' }}>
          {comment.status && (
            <Tag style={{ background: tagStyle.bg, color: tagStyle.color, border: 'none', fontWeight: 500 }}>
              {comment.status === 'open' ? 'New' :
                comment.status === 'in_progress' ? 'In Progress' :
                comment.status === 'pending_approval' ? 'Pending Approval' : 'Done'}
            </Tag>
          )}
        </div>
        <div style={{ marginBottom: '8px', whiteSpace: 'pre-wrap' }}>
          {comment.comment}
        </div>
        <div style={{ display: 'flex', flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', marginBottom: 4 }}>
          {comment.is_approved && (
            <Tag color="#e8f5e9" style={{ color: '#388e3c', border: 'none', fontWeight: 500 }} icon={<CheckOutlined />}>
              Approved
            </Tag>
          )}
        </div>
        {comment.replies && comment.replies.length > 0 && (
          <div style={{ marginLeft: '24px', marginTop: '12px' }}>
            {comment.replies.map((reply, idx) => (
              <div key={reply.id + '-' + idx}>
                {renderComment(reply)}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  const handleView = async (log: ActionLog) => {
    setSelectedLog(log);
      setViewModalVisible(true);
    setCommentsLoading(true);
    try {
      const [logDetails, commentsResponse, assignmentHistory] = await Promise.all([
        actionLogService.getById(log.id),
        actionLogService.getComments(log.id),
        actionLogService.getAssignmentHistory(log.id)
      ]);
      setSelectedLogDetails(logDetails);
      setAssignmentHistory(assignmentHistory);
      setSelectedLogComments(commentsResponse.map(comment => ({
        ...comment,
        user: {
          ...comment.user,
          email: comment.user.email || ''
        }
      })));
    } catch (error) {
      console.error('Error fetching log details:', error);
      message.error('Failed to fetch log details');
    } finally {
      setCommentsLoading(false);
    }
  };

  const renderViewModal = () => {
    if (!selectedLogDetails) return null;

    return (
      <Modal
        title={
          <div style={{ 
            fontSize: '20px', 
            fontWeight: 600, 
            color: '#1a1a1a',
            borderBottom: '1px solid #f0f0f0',
            paddingBottom: '16px',
            marginBottom: '24px'
          }}>
            Action Log Details
          </div>
        }
        open={viewModalVisible}
        onCancel={() => {
          setViewModalVisible(false);
          setSelectedLogDetails(null);
        }}
        footer={null}
        width={1200}
        styles={{
          body: {
            maxHeight: '70vh',
            overflow: 'auto'
          }
        }}
      >
        <div style={{ display: 'flex', gap: '32px' }}>
          {/* Left Column: Basic Info & Assignment History */}
          <div style={{ flex: '1.2', minWidth: 0, display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {/* Basic Info Section */}
            <div style={{ 
              padding: '24px',
              backgroundColor: '#fff',
              borderRadius: '8px',
              border: '1px solid #f0f0f0',
            }}>
              <h3 style={{ 
                marginBottom: '20px',
                fontSize: '16px',
                fontWeight: 600,
                color: '#1a1a1a',
                borderBottom: '1px solid #f0f0f0',
                paddingBottom: '8px',
              }}>Basic Info</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', rowGap: 12, columnGap: 8 }}>
                <div style={{ fontWeight: 500, color: '#444' }}>Title:</div>
                <div>{selectedLogDetails.title}</div>
                <div style={{ fontWeight: 500, color: '#444' }}>Description:</div>
                <div>{selectedLogDetails.description}</div>
                <div style={{ fontWeight: 500, color: '#444' }}>Status:</div>
                <div>
                  <Tag color={getStatusColor(selectedLogDetails.status)} style={{ padding: '4px 12px', fontSize: '13px', fontWeight: 500 }}>
                    {selectedLogDetails.status === 'open' ? 'New' :
                      selectedLogDetails.status === 'closed' ? 'Done' :
                      selectedLogDetails.status.charAt(0).toUpperCase() + selectedLogDetails.status.slice(1).replace('_', ' ')}
                  </Tag>
            </div>
                <div style={{ fontWeight: 500, color: '#444' }}>Created At:</div>
                <div>{format(new Date(selectedLogDetails.created_at), 'yyyy-MM-dd HH:mm')}</div>
                <div style={{ fontWeight: 500, color: '#444' }}>Due Date:</div>
                <div>
                  {selectedLogDetails.due_date ? (
                    <>
                      {format(new Date(selectedLogDetails.due_date), 'yyyy-MM-dd')}
                      {/* Days Remaining Tag */}
                      <span style={{ marginLeft: 12 }}>
                        {(() => {
                          const dueDate = new Date(selectedLogDetails.due_date);
                          const today = new Date();
                          const startOfDueDate = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());
                          const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
                          const daysRemaining = Math.ceil((startOfDueDate.getTime() - startOfToday.getTime()) / (1000 * 60 * 60 * 24));
                          let color = 'green';
                          if (daysRemaining <= 5) color = 'red';
                          if (daysRemaining < 0) color = 'red';
                          return (
                            <Tag color={color} style={{ marginLeft: 0 }}>
                              {daysRemaining < 0 ? (
                                'Overdue'
                              ) : daysRemaining === 0 ? (
                                '0 days remaining'
                              ) : (
                                `${daysRemaining} days remaining`
                              )}
                            </Tag>
                          );
                        })()}
                      </span>
                    </>
                  ) : 'Not set'}
                  </div>
                <div style={{ fontWeight: 500, color: '#444' }}>Created By:</div>
                <div>{selectedLogDetails.created_by?.first_name} {selectedLogDetails.created_by?.last_name}</div>
                <div style={{ fontWeight: 500, color: '#444' }}>Department:</div>
                <div>{selectedLogDetails.department?.name}</div>
                <div style={{ fontWeight: 500, color: '#444' }}>Department Unit:</div>
                <div>{selectedLogDetails.created_by?.department_unit?.name || 'Not specified'}</div>
                </div>
            </div>
            {/* Assignment History Section */}
            <div style={{ 
              padding: '24px',
              backgroundColor: '#fff',
              borderRadius: '8px',
              border: '1px solid #f0f0f0',
              flex: 1,
              minHeight: '200px',
            }}>
                <h3 style={{ 
                marginBottom: '20px',
                  fontSize: '16px',
                  fontWeight: 600,
                color: '#1a1a1a',
                borderBottom: '1px solid #f0f0f0',
                paddingBottom: '8px',
              }}>Assignment History</h3>
              <Timeline
                items={assignmentHistory.length === 0 ? [
                  { color: 'gray', children: 'No assignment history' }
                ] : assignmentHistory.map((assignment) => ({
                  key: assignment.id,
                  children: (
                    <div>
                      <div style={{ marginBottom: '8px' }}>
                        <strong>Assigned by:</strong> {getFullName(users.find(u => u.id === assignment.assigned_by.id) || assignment.assigned_by)}
              </div>
                      <div style={{ marginBottom: '8px' }}>
                        <strong>Assigned to:</strong>{' '}
                        {(() => {
                          const currentUserId = user?.id || 0;
                          const assignedUsers = assignment.assigned_to;
                          const isCurrentUserAssigned = assignedUsers.some(u => u.id === currentUserId);
                          if (isCurrentUserAssigned) {
                            const otherUsers = assignedUsers.filter(u => u.id !== currentUserId);
                  return (
                              <>
                                <Tag color="default" style={{ margin: 0 }}>Me</Tag>
                                {otherUsers.map(u => (
                                  <Tag key={u.id} color="default">{u.first_name} {u.last_name}</Tag>
                                ))}
                              </>
                            );
                          }
                          return assignedUsers.map(u => (
                            <Tag key={u.id} color="default">{u.first_name} {u.last_name}</Tag>
                          ));
                        })()}
                      </div>
                      {assignment.comment && (
                        <div style={{ marginBottom: '8px' }}>
                          <strong>Comment:</strong> {assignment.comment}
                        </div>
                      )}
                      <div style={{ color: '#666', fontSize: '12px' }}>
                        {format(new Date(assignment.assigned_at), 'yyyy-MM-dd HH:mm')}
            </div>
          </div>
                  )
                }))}
              />
            </div>
          </div>
          {/* Right Column: Comments */}
          <div style={{ flex: '1', minWidth: 0 }}>
          <div style={{ 
            padding: '24px',
            backgroundColor: '#fff',
            borderRadius: '8px',
            border: '1px solid #f0f0f0',
              minHeight: '100%',
              height: '100%',
            }}>
              <h3 style={{ 
                marginBottom: '20px',
                fontSize: '16px',
                fontWeight: 600,
                color: '#1a1a1a',
                borderBottom: '1px solid #f0f0f0',
                paddingBottom: '8px',
              }}>Comments</h3>
              {commentsLoading ? (
                <div style={{ textAlign: 'center', padding: '20px' }}>
                  <Spin />
            </div>
              ) : (
                <div>
                  {selectedLogComments.map(comment => (
                    <div key={comment.id}>
                      {renderComment(comment)}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </Modal>
    );
  };

  const columns: ColumnsType<ActionLog> = [
    {
      title: 'Title',
      dataIndex: 'title',
      key: 'title',
      width: '25%',
      render: (text: string) => (
        <div style={{ 
          fontWeight: 600,
          color: '#1a1a1a',
          fontSize: '14px',
          lineHeight: '1.4'
        }}>
          {text}
        </div>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: '10%',
      render: (status: string) => (
        <Tag color={getStatusColor(status)}>
          {status === 'pending_approval' ? 'Pending Approval' :
            status === 'open' ? 'New' :
            status === 'closed' ? 'Done' :
            status.charAt(0).toUpperCase() + status.slice(1).replace('_', ' ')}
        </Tag>
      ),
      filters: [
        { text: 'New', value: 'open' },
        { text: 'In Progress', value: 'in_progress' },
        { text: 'Done', value: 'closed' },
        { text: 'Pending Approval', value: 'pending_approval' }
      ],
      onFilter: (value: any, record: ActionLog) => record.status.toLowerCase() === String(value).toLowerCase(),
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
      render: (assigned: number[] | null, record: ActionLog) => {
        if (!assigned || assigned.length === 0) {
          return <span style={{ color: '#999' }}>Unassigned</span>;
        }
        
        const assignedUsers = users.filter(user => assigned.includes(user.id));
        if (assignedUsers.length === 0) {
          return <span style={{ color: '#999' }}>Unassigned</span>;
        }

        // If current user is assigned, show "Me" first
        const currentUserId = user?.id || 0;
        const isCurrentUserAssigned = assigned.includes(currentUserId);
        
        // Check if this is a team assignment (2+ assignees)
        const isTeamAssignment = assigned.length >= 2;
        const teamLeader = record.team_leader;
        
        if (isCurrentUserAssigned) {
          const otherUsers = assignedUsers.filter(u => u.id !== currentUserId);
          if (otherUsers.length === 0) {
            return (
              <div>
                <Tag color="default" style={{ margin: 0 }}>
                  Me
                </Tag>
                {isTeamAssignment && teamLeader && (
                  <div style={{ marginTop: '6px' }}>
                    <Tag 
                      color="blue" 
                      style={{ 
                        fontSize: '12px', 
                        padding: '4px 8px',
                        fontWeight: '500',
                        backgroundColor: '#e6f7ff',
                        border: '1px solid #91d5ff'
                      }}
                    >
                      <strong>👑 Team Leader:</strong> {users.find(u => u.id === teamLeader)?.first_name} {users.find(u => u.id === teamLeader)?.last_name}
                    </Tag>
                  </div>
                )}
              </div>
            );
          }
          return (
            <div>
              <Space size={[4, 4]} wrap>
                <Tag color="default">
                  Me
                </Tag>
                {otherUsers.map(u => (
                  <Tag key={u.id} color="default">
                    {u.first_name} {u.last_name}
                  </Tag>
                ))}
              </Space>
              {isTeamAssignment && teamLeader && (
                <div style={{ marginTop: '6px' }}>
                  <Tooltip title="This person is responsible for updating the action log status. Other team members can only add comments.">
                    <Tag 
                      color="blue" 
                      style={{ 
                        fontSize: '12px', 
                        padding: '4px 8px',
                        fontWeight: '500',
                        backgroundColor: '#e6f7ff',
                        border: '1px solid #91d5ff',
                        cursor: 'help'
                      }}
                    >
                      <strong>👑 Team Leader:</strong> {users.find(u => u.id === teamLeader)?.first_name} {users.find(u => u.id === teamLeader)?.last_name}
                    </Tag>
                  </Tooltip>
                </div>
              )}
              {isTeamAssignment && !teamLeader && (
                <div style={{ marginTop: '6px' }}>
                  <Tooltip title="No team leader selected. Please assign a team leader to enable status updates.">
                    <Tag 
                      color="orange" 
                      style={{ 
                        fontSize: '12px', 
                        padding: '4px 8px',
                        fontWeight: '500',
                        backgroundColor: '#fff7e6',
                        border: '1px solid #ffd591',
                        cursor: 'help'
                      }}
                    >
                      <strong>⚠️ No Team Leader</strong>
                    </Tag>
                  </Tooltip>
                </div>
              )}
            </div>
          );
        }
        
        return (
          <div>
            <Space size={[4, 4]} wrap>
              {assignedUsers.map(u => (
                <Tag key={u.id} color="default">
                  {u.first_name} {u.last_name}
                </Tag>
              ))}
            </Space>
            {isTeamAssignment && teamLeader && (
              <div style={{ marginTop: '6px' }}>
                <Tooltip title="This person is responsible for updating the action log status. Other team members can only add comments.">
                  <Tag 
                    color="blue" 
                    style={{ 
                      fontSize: '12px', 
                      padding: '4px 8px',
                      fontWeight: '500',
                      backgroundColor: '#e6f7ff',
                      border: '1px solid #91d5ff',
                      cursor: 'help'
                    }}
                  >
                    <strong>👑 Team Leader:</strong> {users.find(u => u.id === teamLeader)?.first_name} {users.find(u => u.id === teamLeader)?.last_name}
                  </Tag>
                </Tooltip>
              </div>
            )}
            {isTeamAssignment && !teamLeader && (
              <div style={{ marginTop: '6px' }}>
                <Tooltip title="No team leader selected. Please assign a team leader to enable status updates.">
                  <Tag 
                    color="orange" 
                    style={{ 
                      fontSize: '12px', 
                      padding: '4px 8px',
                      fontWeight: '500',
                      backgroundColor: '#fff7e6',
                      border: '1px solid #ffd591',
                      cursor: 'help'
                    }}
                  >
                    <strong>⚠️ No Team Leader</strong>
                    </Tag>
                  </Tooltip>
                </div>
              )}
            {isTeamAssignment && !teamLeader && (
              <div style={{ marginTop: '6px' }}>
                <Tooltip title="No team leader selected. Please assign a team leader to enable status updates.">
                  <Tag 
                    color="orange" 
                    style={{ 
                      fontSize: '12px', 
                      padding: '4px 8px',
                      fontWeight: '500',
                      backgroundColor: '#fff7e6',
                      border: '1px solid #ffd591',
                      cursor: 'help'
                    }}
                  >
                    <strong>⚠️ No Team Leader</strong>
                  </Tag>
                </Tooltip>
              </div>
            )}
          </div>
        );
      }
    },
    {
      title: 'Created At',
      dataIndex: 'created_at',
      key: 'created_at',
      width: '15%',
      render: (date: string) => format(new Date(date), 'yyyy-MM-dd'),
    },
    {
      title: 'Due Date',
      dataIndex: 'due_date',
      key: 'due_date',
      width: '15%',
      render: (date: string, record: ActionLog) => {
        if (!date) return '-';
        const dueDate = new Date(date);
        if (record.status === 'closed') {
          return (
            <div>
              {format(dueDate, 'yyyy-MM-dd')}
              <div style={{ marginTop: '4px' }}>
                <Tag color="#e8f5e9" style={{ color: '#388e3c', fontWeight: 500, fontStyle: 'italic' }}>
                  Completed just on time
                </Tag>
              </div>
            </div>
          );
        }
        const today = new Date();
        // Set both dates to start of day to get accurate day difference
        const startOfDueDate = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());
        const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        const daysRemaining = Math.ceil((startOfDueDate.getTime() - startOfToday.getTime()) / (1000 * 60 * 60 * 24));
        return (
          <div>
            <div>{format(dueDate, 'yyyy-MM-dd')}</div>
            <div style={{ marginTop: '4px' }}>
              <Tag color={daysRemaining <= 5 ? 'red' : 'green'}>
                {daysRemaining < 0 ? (
                  'Overdue'
                ) : daysRemaining === 0 ? (
                  '0 days remaining'
                ) : (
                  `${daysRemaining} days remaining`
                )}
              </Tag>
            </div>
          </div>
        );
      },
    },
    {
      title: 'Actions',
      key: 'actions',
      width: '10%',
      render: (text: string, record: ActionLog) => {
        const isUnitHead = user.designation?.toLowerCase().includes('head') || 
                          (user.designation?.match(/^[A-Z]{2,3}\d+/) && user.designation?.toLowerCase().includes('1'));
        const isCommissioner = user.role?.name?.toLowerCase() === 'commissioner';
        const isAssistantCommissioner = user.role?.name?.toLowerCase() === 'assistant_commissioner';
        
        // Check if user can approve/reject based on the corrected Ag. C/PAP workflow
        // CORRECTED FLOW: Ag. C/PAP users can approve/reject action logs with "pending approval" status
        // Upon approval: status automatically changes to "Done" (closed)
        // Upon rejection: status goes back to assignee (reopens the log)
        const isAgCPAP = user?.has_ag_cpap_designation || false;
        const isOnLeave = user?.is_currently_on_leave || false;
        const hasLeaveDelegationResponsibilities = user?.has_leave_delegation_responsibilities || false;
        
        // Check if user can approve based on leave delegation status
        const canApproveReject = (
          record.status === 'pending_approval' && // Status must be "pending approval"
          (
            (isAgCPAP && !isOnLeave) || // Ag. C/PAP user not on leave
            hasLeaveDelegationResponsibilities // Ag. AC/PAP user with leave delegation responsibilities
          )
        );
        
        console.log('[TABLE] canApproveReject: Corrected flow check', {
          logId: record.id,
          status: record.status,
          isPendingApproval: record.status === 'pending_approval',
          isAgCPAP,
          isOnLeave,
          hasLeaveDelegationResponsibilities,
          canApproveReject
        });
        
        const userUnitId = user.department_unit?.id;
        const isAssignedToMe = record.assigned_to?.includes(user?.id || 0);
        const isAssigned = record.assigned_to && record.assigned_to.length > 0;
        const isClosed = record.status === 'closed';
        
        // Only show assign button to the original assigner
        const isOriginalAssigner = record.original_assigner?.id === user?.id;
        const canAssign = (isCommissioner || isAssistantCommissioner || isUnitHead) && isOriginalAssigner;

        return (
          <Space>
            <Tooltip title="View">
              <Button type="primary" size="small" icon={<EyeOutlined />} onClick={() => handleView(record)} />
            </Tooltip>
            {canAssign && (
              <Tooltip title={record.status === 'closed' && record.due_date !== null ? "Cannot assign completed action log" : record.assigned_to?.length > 0 ? "Re-assign" : "Assign"}>
                <Button 
                  type="primary" 
                  size="small" 
                  icon={<UserSwitchOutlined />} 
                  onClick={() => {
                    setSelectedLog(record);
                    setAssignModalVisible(true);
                  }}
                  disabled={record.status === 'closed' && record.due_date !== null}
                />
              </Tooltip>
            )}
            {isAssignedToMe && canUserUpdateStatus(record) && (
              <Tooltip title="Update Status">
                <Button
                  type="primary"
                  size="small"
                  icon={<EditOutlined />}
                  onClick={() => {
                    setSelectedLog(record);
                    setStatusModalVisible(true);
                  }}
                  disabled={
                    record.status === 'closed' && record.closure_approval_stage === 'closed' && record.assigned_to?.includes(user?.id)
                  }
                />
              </Tooltip>
            )}
            {isAssignedToMe && !canUserUpdateStatus(record) && record.assigned_to && record.assigned_to.length >= 2 && (
              <Tooltip title="Only the team leader can update status for team assignments">
                <Button
                  type="default"
                  size="small"
                  icon={<InfoCircleOutlined />}
                  disabled={true}
                  style={{ cursor: 'not-allowed' }}
                />
              </Tooltip>
            )}
            {canApproveReject && (
              <>
                <Tooltip title={
                  isAgCPAP && !isOnLeave 
                    ? "Approve action log (Ag. C/PAP user)" 
                    : hasLeaveDelegationResponsibilities 
                      ? "Approve action log (Ag. AC/PAP user with leave delegation responsibilities)"
                      : "Approve action log"
                }>
                  <Button
                    type="primary"
                    size="small"
                    icon={<CheckOutlined />}
                    onClick={() => {
                      setSelectedLog(record);
                      setApprovalModalVisible(true);
                    }}
                  />
                </Tooltip>
                <Tooltip title={
                  isAgCPAP && !isOnLeave 
                    ? "Reject action log (Ag. C/PAP user)" 
                    : hasLeaveDelegationResponsibilities 
                      ? "Reject action log (Ag. AC/PAP user with leave delegation responsibilities)"
                      : "Reject action log"
                }>
                  <Button
                    type="primary"
                    size="small"
                    danger
                    icon={<CloseOutlined />}
                    onClick={() => {
                      setSelectedLog(record);
                      setRejectModalVisible(true);
                    }}
                  />
                </Tooltip>
              </>
            )}
            <Tooltip title="Comments">
              <Button
                type="primary"
                size="small"
                icon={<MessageOutlined />}
                onClick={() => handleViewComments(record)}
              />
            </Tooltip>
          </Space>
        );
      }
    },
  ];

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleMenuClick = (e: any) => {
    setSelectedMenuKey(e.key);
    if (e.key === 'createActionLog') {
      setCreateModalVisible(true);
    } else if (e.key === 'assignedToMe') {
      setShowAssignedOnly(true);
      setShowPendingApproval(false);
    } else if (e.key === 'pendingApproval') {
      setShowPendingApproval(true);
      setShowAssignedOnly(false);
    } else if (e.key === 'actionLogs') {
      setShowAssignedOnly(false);
      setShowPendingApproval(false);
    } else if (e.key === 'logout') {
      handleLogout();
    }
  };

  const renderUserOptions = () => {
    if (!user) return [];
    const filteredUsers = getFilteredUsers(user);
    return filteredUsers.map(user => ({
      label: `${user.first_name} ${user.last_name}`,
      value: user.id.toString(),
      key: `user-${user.id}`
    }));
  };

  const menuItems = [
    {
      key: 'actionLogs',
      icon: <FileTextOutlined />,
      label: user.role?.name?.toLowerCase().includes('commissioner') 
        ? 'All Action Logs' 
        : 'All Action Logs',
    },
    // Show "Pending Approval" for Ag. C/PAP users, "Assigned To Me" for others
    ...(isAgCPAP ? [{
      key: 'pendingApproval',
      icon: <ClockCircleOutlined />,
      label: 'Pending Approval',
    }] : [{
      key: 'assignedToMe',
      icon: <UserOutlined />,
      label: 'Assigned To Me',
    }]),
    ...(canCreateLogs ? [{
      key: 'createActionLog',
      icon: <FormOutlined />,
      label: 'Create Action Log',
    }] : []),
    {
      key: 'delegations',
      icon: <UserSwitchOutlined />,
      label: 'Delegations',
    },
    ...(canConfigure ? [{
      key: 'settings',
      icon: <SettingOutlined />,
      label: 'Settings',
    }] : []),
    {
      key: 'logout',
      icon: <UserOutlined />,
      label: 'Logout',
      style: { marginTop: 32, color: '#d32f2f' },
    },
  ];

  const handleFileUpload = async (values: any) => {
    try {
      if (!user) {
        message.error('User not found');
        return;
      }

      const file = values.file?.fileList?.[0]?.originFileObj;
      if (!file) {
        message.error('Please select a file to upload');
        return;
      }

      // Read the file
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const data = e.target?.result;
          let rows: string[][] = [];

          // Check file type and parse accordingly
          if (file.name.endsWith('.csv')) {
            // Handle CSV
            const text = data as string;
            rows = text.split('\n')
              .map(row => row.trim())
              .filter(row => row.length > 0)
              .map(row => row.split(',').map(cell => cell.trim()));
          } else {
            // Handle Excel
            const workbook = XLSX.read(data, { type: 'binary' });
            const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
            rows = XLSX.utils.sheet_to_json(firstSheet, { header: 1 }) as string[][];
          }

          if (rows.length < 2) {
            message.error('File must contain at least a header row and one data row');
            return;
          }

          // Get headers from first row and convert to lowercase for case-insensitive comparison
          const headers = rows[0].map(h => h.toString().trim().toLowerCase());
          
          // Validate required headers
          const requiredHeaders = ['title', 'description'];
          const missingHeaders = requiredHeaders.filter(h => !headers.includes(h));
          if (missingHeaders.length > 0) {
            message.error(`Missing required headers: ${missingHeaders.join(', ')}`);
            return;
          }

          // Process rows and create action logs
          const actionLogs = rows.slice(1).map(row => {
            const assignedToStr = row[headers.indexOf('assigned_to')] || '';
            const assignedTo = assignedToStr.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
            
            return {
              title: row[headers.indexOf('title')],
              description: row[headers.indexOf('description')],
              due_date: row[headers.indexOf('due_date')] || null,
              priority: (row[headers.indexOf('priority')] || 'Medium').toUpperCase(),
              department_id: user.department,
              department_unit: user.department_unit?.id,
              created_by: user.id,
              assigned_to: assignedTo,
              status: 'open' as ActionLogStatus
            } as CreateActionLogData;
          });

          // Create action logs in the backend
          const createdLogs = await Promise.all(actionLogs.map(log => actionLogService.create(log)));

          message.success('Action logs created successfully');
          setCreateModalVisible(false);
          createForm.resetFields();
          
          // Update the action logs list with the new data
          setActionLogs(prevLogs => [...createdLogs, ...prevLogs]);
        } catch (error) {
          console.error('Error processing file:', error);
          message.error('Failed to process file');
        }
      };
        reader.readAsBinaryString(file);
    } catch (error) {
      console.error('Error uploading file:', error);
      message.error('Failed to upload file');
    }
  };

  // Add these effects after the form instances
  useEffect(() => {
    if (createModalVisible) {
      createForm.resetFields();
    }
  }, [createModalVisible, createForm]);
  useEffect(() => {
    if (assignModalVisible) {
      assignForm.resetFields();
    }
  }, [assignModalVisible, assignForm]);

  useEffect(() => {
    const fetchUnreadCounts = async () => {
      const counts: { [logId: number]: number } = {};
      await Promise.all(actionLogs.map(async (log) => {
        try {
          const res = await actionLogService.getUnreadNotificationCount(log.id);
          counts[log.id] = res;
        } catch {
          counts[log.id] = 0;
        }
      }));
      setUnreadCounts(counts);
    };
    if (actionLogs.length > 0) fetchUnreadCounts();
  }, [actionLogs]);

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
      console.log('[ECONOMIST_DASHBOARD] uniqueUnits: Found unit', { id, name: unitName, assignee: assignee ? `${assignee.first_name} ${assignee.last_name}` : 'Unknown' });
      return { 
        id, 
        name: unitName
      };
    });

  console.log('[ECONOMIST_DASHBOARD] uniqueUnits: Final units', uniqueUnits);

  // Filter logs by selected unit
  const getUnitFilteredLogs = (logs: ActionLog[]): ActionLog[] => {
    console.log('[ECONOMIST_DASHBOARD] getUnitFilteredLogs: Starting with', logs.length, 'logs from getFilteredLogs');
    console.log('[ECONOMIST_DASHBOARD] getUnitFilteredLogs: unitFilter =', unitFilter);
    
    // If unitFilter is 'all' or not set, return all logs
    if (unitFilter === 'all' || !unitFilter) {
      console.log('[ECONOMIST_DASHBOARD] getUnitFilteredLogs: Returning all logs (unitFilter is "all")');
      return logs;
    }
    
    const filteredLogs = logs.filter(log => {
      // If user is assigned to this log, always show it
      const isAssignedToMe = log.assigned_to?.includes(user?.id || 0);
      if (isAssignedToMe) {
        console.log('[ECONOMIST_DASHBOARD] getUnitFilteredLogs: Log', log.id, '- User is assigned, allowing through unit filter');
        return true;
      }
      
      // If user is the creator of the log, always show it (for unassigned logs)
      const isCreator = log.created_by?.id === user?.id;
      if (isCreator) {
        console.log('[ECONOMIST_DASHBOARD] getUnitFilteredLogs: Log', log.id, '- User is creator, allowing through unit filter');
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

      console.log('[ECONOMIST_DASHBOARD] getUnitFilteredLogs: Log', log.id, 
        '- assigned_to =', log.assigned_to,
        '- unitFilter =', unitFilter,
        '- hasUserInSelectedUnit =', hasUserInSelectedUnit,
        '- isPendingUnitHeadApproval =', isPendingUnitHeadApproval,
        '- matches =', hasUserInSelectedUnit || isPendingUnitHeadApproval
      );

      return hasUserInSelectedUnit || isPendingUnitHeadApproval;
    });

    console.log('[ECONOMIST_DASHBOARD] getUnitFilteredLogs: After unit filter,', filteredLogs.length, 'logs remaining');
    return filteredLogs;
  };

  // Update export functions to use getUnitFilteredLogs
  const handleExportExcel = () => {
    const filteredLogs = getUnitFilteredLogs(actionLogs);
    console.log('Exporting logs:', filteredLogs);
    const data = filteredLogs.map(log => ({
      'ID': log.id,
      'Title': log.title,
      'Description': log.description,
      'Department': log.department?.name || '',
      'Status': log.status,
      'Priority': log.priority,
      'Due Date': log.due_date ? new Date(log.due_date).toLocaleDateString() : '',
      'Created By': log.created_by ? `${log.created_by.first_name} ${log.created_by.last_name}` : '',
      'Created At': new Date(log.created_at).toLocaleDateString(),
      'Updated At': new Date(log.updated_at).toLocaleDateString()
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Action Logs');
    XLSX.writeFile(wb, 'action_logs.xlsx');
  };

  const handleExportWord = () => {
    const filteredLogs = getUnitFilteredLogs(actionLogs);
    let content = 'Action Logs\n\n';
    filteredLogs.forEach(log => {
      content += `ID: ${log.id}\n`;
      content += `Title: ${log.title}\n`;
      content += `Description: ${log.description}\n`;
      content += `Department: ${log.department?.name || ''}\n`;
      content += `Status: ${log.status}\n`;
      content += `Priority: ${log.priority}\n`;
      content += `Due Date: ${log.due_date ? new Date(log.due_date).toLocaleDateString() : ''}\n`;
      content += `Created By: ${log.created_by ? `${log.created_by.first_name} ${log.created_by.last_name}` : ''}\n`;
      content += `Created At: ${new Date(log.created_at).toLocaleDateString()}\n`;
      content += `Updated At: ${new Date(log.updated_at).toLocaleDateString()}\n\n`;
    });
    const blob = new Blob([content], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'action_logs.doc';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const renderApprovalModal = () => {
    const isAgCPAP = user?.has_ag_cpap_designation || false;
    const isOnLeave = user?.is_currently_on_leave || false;
    const hasLeaveDelegationResponsibilities = user?.has_leave_delegation_responsibilities || false;
    
    let modalTitle = "Approve Action Log";
    if (isAgCPAP && !isOnLeave) {
      modalTitle = "Approve Action Log (Ag. C/PAP User)";
    } else if (hasLeaveDelegationResponsibilities) {
      modalTitle = "Approve Action Log";
    }
    
    return (
      <Modal
        title={modalTitle}
        open={approvalModalVisible}
        onCancel={() => {
          setApprovalModalVisible(false);
          approvalForm.resetFields();
        }}
        footer={null}
      >
        <Form
          form={approvalForm}
          onFinish={handleApprove}
          initialValues={{ approval_comment: 'Approved' }}
        >
          {/* Delegation Status Message */}
          {/* {hasLeaveDelegationResponsibilities && (
            <div style={{ 
              marginBottom: 16, 
              padding: '8px 12px', 
              backgroundColor: '#f6ffed', 
              borderRadius: '6px', 
              border: '1px solid #b7eb8f',
              color: '#389e0d'
            }}>
              <strong>📋 Acting Ag. C/PAP</strong><br />
              You are handling this approval because the Ag. C/PAP user is currently on leave.
            </div>
          )} */}
          
          {isAgCPAP && isOnLeave && (
            <div style={{ 
              marginBottom: 16, 
              padding: '8px 12px', 
              backgroundColor: '#fff2f0', 
              borderRadius: '6px', 
              border: '1px solid #ffccc7',
              color: '#cf1322'
            }}>
              <strong>🏖️ On Leave</strong><br />
              You cannot approve action logs while on leave. Approval responsibilities have been delegated to Ag. AC/PAP users.
            </div>
          )}
          
          <Form.Item
            name="approval_comment"
            label="Comment"
            rules={[{ required: true, message: 'Please enter a comment' }]}
          >
            <Input.TextArea rows={4} />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" loading={approving}>
              Approve
            </Button>
            <Button
              style={{ marginLeft: 8 }}
              onClick={() => {
                setApprovalModalVisible(false);
                approvalForm.resetFields();
              }}
            >
              Cancel
            </Button>
          </Form.Item>
        </Form>
      </Modal>
    );
  };

  const renderRejectModal = () => {
    const isAgCPAP = user?.has_ag_cpap_designation || false;
    const isOnLeave = user?.is_currently_on_leave || false;
    const hasLeaveDelegationResponsibilities = user?.has_leave_delegation_responsibilities || false;
    
    let modalTitle = "Reject Action Log";
    if (isAgCPAP && !isOnLeave) {
      modalTitle = "Reject Action Log (Ag. C/PAP User)";
    } else if (hasLeaveDelegationResponsibilities) {
      modalTitle = "Reject Action Log (Ag. AC/PAP User - Acting Due to Leave)";
    }
    
    return (
      <Modal
        title={modalTitle}
        open={rejectModalVisible}
        onCancel={() => {
          setRejectModalVisible(false);
          rejectForm.resetFields();
        }}
        footer={null}
      >
        <Form
          form={rejectForm}
          onFinish={handleReject}
          initialValues={{ rejection_comment: 'Revise submission' }}
        >
          {/* Delegation Status Message */}
          {/* {hasLeaveDelegationResponsibilities && (
            <div style={{ 
              marginBottom: 16, 
              padding: '8px 12px', 
              backgroundColor: '#f6ffed', 
              borderRadius: '6px', 
              border: '1px solid #b7eb8f',
              color: '#389e0d'
            }}>
              <strong>📋 Acting Ag. C/PAP</strong><br />
              You are handling this rejection because the Ag. C/PAP user is currently on leave.
            </div>
          )} */}
          
          {isAgCPAP && isOnLeave && (
            <div style={{ 
              marginBottom: 16, 
              padding: '8px 12px', 
              backgroundColor: '#fff2f0', 
              borderRadius: '6px', 
              border: '1px solid #ffccc7',
              color: '#cf1322'
            }}>
              <strong>🏖️ On Leave</strong><br />
              You cannot reject action logs while on leave. Approval responsibilities have been delegated to Ag. AC/PAP users.
            </div>
          )}
          
          <Form.Item
            name="rejection_comment"
            label="Reason for Rejection"
            rules={[{ required: true, message: 'Please enter a reason for rejection' }]}
          >
            <Input.TextArea rows={4} />
          </Form.Item>
          <Form.Item>
            <Button type="primary" danger htmlType="submit" loading={rejecting}>
              Reject
            </Button>
            <Button
              style={{ marginLeft: 8 }}
              onClick={() => {
                setRejectModalVisible(false);
                rejectForm.resetFields();
              }}
            >
              Cancel
            </Button>
          </Form.Item>
        </Form>
      </Modal>
    );
  };

  const renderDelegationTable = () => {
    // Define delegation columns for the table
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
        render: (date: string, record: Delegation) => {
          if (!date) return <span style={{ color: '#999' }}>No expiration</span>;
          const expiryDate = new Date(date);
          const now = new Date();
          const isExpired = expiryDate < now;
          const isExpiringSoon = expiryDate.getTime() - now.getTime() < 24 * 60 * 60 * 1000; // 24 hours
          
          let color = 'default';
          if (isExpired) color = 'red';
          else if (isExpiringSoon) color = 'orange';
          
          return (
            <div>
              <Tag color={color}>
                {format(expiryDate, 'yyyy-MM-dd HH:mm')}
                {isExpired && ' (Expired)'}
                {!isExpired && isExpiringSoon && ' (Expiring Soon)'}
              </Tag>
              {isExpired && record.is_active && (
                <div style={{ marginTop: '4px', fontSize: '12px', color: '#ff4d4f' }}>
                  ⚠️ Will be automatically revoked
                </div>
              )}
            </div>
          );
        },
      },
      {
        title: 'Status',
        key: 'status',
        render: (record: Delegation) => {
          const isExpired = record.expires_at && new Date(record.expires_at) < new Date();
          const isActive = record.is_active && !isExpired;
          
          let statusText = isActive ? 'Active' : 'Inactive';
          let color = isActive ? 'green' : 'red';
          
          // Show special status for expired but still active delegations
          if (isExpired && record.is_active) {
            statusText = 'Expired (Auto-revoke)';
            color = 'orange';
          }
          
          return (
            <Tag color={color}>
              {statusText}
            </Tag>
          );
        },
      },
      {
        title: 'Reason',
        dataIndex: 'reason',
        key: 'reason',
        render: (text: string) => text || '-',
        ellipsis: true,
      },
      {
        title: 'Actions',
        key: 'actions',
        render: (record: Delegation) => {
          const isExpired = record.expires_at && new Date(record.expires_at) < new Date();
          const canRevoke = record.is_active && canManageDelegations;
          const canReDelegate = !record.is_active && canManageDelegations;
          
          return (
            <Space>
              {canRevoke && (
                <Button
                  type="primary"
                  danger
                  size="small"
                  loading={revokingDelegations.has(record.id)}
                  onClick={() => handleRevokeDelegation(record.id)}
                  disabled={!!isExpired} // Disable revoke button for expired delegations
                >
                  {isExpired ? 'Auto-revoked' : 'Revoke'}
                </Button>
              )}
              {canReDelegate && (
                <Button
                  type="primary"
                  size="small"
                  icon={<UserSwitchOutlined />}
                  onClick={() => handleReDelegate(record)}
                >
                  Re-Delegate
                </Button>
              )}
            </Space>
          );
        }
      },
    ];

    // For users who can't manage delegations and are not Ag. C/PAP, show their delegation status
    if (!canManageDelegations && !user?.designation?.toLowerCase().includes('ag. c/pap')) {
      return (
        <Card title="My Delegation Status">
          {user?.has_active_delegation && user.has_active_delegation.is_valid ? (
            <div style={{ padding: '20px' }}>
              <div style={{ textAlign: 'center', marginBottom: '20px' }}>
                <CheckCircleOutlined style={{ fontSize: '48px', color: '#52c41a', marginBottom: '16px' }} />
                <h3 style={{ color: '#52c41a', marginBottom: '8px' }}>You have an active delegation</h3>
                <p style={{ color: '#666', marginBottom: '16px' }}>
                  You can now create action logs until {user.has_active_delegation.expires_at ?
                    format(new Date(user.has_active_delegation.expires_at), 'yyyy-MM-dd HH:mm') :
                    'the delegation expires'}
                </p>
              </div>
              
              <Table
                columns={[
                  {
                    title: 'Field',
                    dataIndex: 'field',
                    key: 'field',
                    width: '30%',
                    render: (text: string) => (
                      <strong style={{ color: '#1a1a1a' }}>{text}</strong>
                    )
                  },
                  {
                    title: 'Value',
                    dataIndex: 'value',
                    key: 'value',
                    width: '70%',
                    render: (text: string) => (
                      <span style={{ color: '#666' }}>{text}</span>
                    )
                  }
                ]}
                pagination={false}
                bordered
                size="small"
                rowKey="field"
                dataSource={[
                  {
                    key: 'delegated_by',
                    field: 'Delegated By',
                    value: user.has_active_delegation.delegated_by
                  },
                  {
                    key: 'reason',
                    field: 'Reason',
                    value: user.has_active_delegation.reason === 'leave' ? 'Leave' : 'Other'
                  },
                  {
                    key: 'delegated_at',
                    field: 'Delegated At',
                    value: format(new Date(user.has_active_delegation.delegated_at), 'yyyy-MM-dd HH:mm')
                  },
                  ...(user.has_active_delegation.expires_at ? [{
                    key: 'expires_at',
                    field: 'Expires At',
                    value: format(new Date(user.has_active_delegation.expires_at), 'yyyy-MM-dd HH:mm')
                  }] : [])
                ]}
              />
            </div>
          ) : (
            // Only show "No Active Delegation" message for non-Ag. C/PAP users
            !user?.designation?.toLowerCase().includes('ag. c/pap') && (
              <div style={{ padding: '20px', textAlign: 'center' }}>
                <ExclamationCircleOutlined style={{ fontSize: '48px', color: '#faad14', marginBottom: '16px' }} />
                <h3 style={{ color: '#faad14', marginBottom: '8px' }}>No Active Delegation</h3>
                <p style={{ color: '#666' }}>
                  {isAgACpap ? (
                    <>
                      {/* As an Ag. AC/PAP user, you need delegation from an Ag. C/PAP user to create action logs.<br />
                      Please contact your Ag. C/PAP for delegation. */}
                    </>
                  ) : (
                    <>
                      {/* You need delegation from an Ag. C/PAP user to create action logs.<br />
                      Please contact your Ag. C/PAP for delegation. */}
                    </>
                  )}
                </p>
              </div>
            )
          )}
        </Card>
      );
    }

    // For users who can manage delegations, show the full delegation management interface
    const userLevel = isAgCPAP ? 'Ag. C/PAP (Delegation Manager)' : 'Commissioner/Super Admin';
    
    return (
      <Card title="Delegation Management">
        <div style={{ marginBottom: 16 }}>
          {/* <div style={{ marginBottom: 12, padding: '8px 12px', backgroundColor: '#f0f7ff', borderRadius: '6px', border: '1px solid #91d5ff' }}>
            <strong>Your Level:</strong> {userLevel}<br />
            {isAgCPAP && <span style={{ color: '#52c41a' }}>✓ You can delegate to any user (including Ag. AC/PAP users)</span>}
          </div> */}
          
          {/* Info message for Ag. C/PAP users */}
          {/* {isAgCPAP && (
            <div style={{ 
              marginBottom: 12, 
              padding: '8px 12px', 
              backgroundColor: '#fff7e6', 
              borderRadius: '6px', 
              border: '1px solid #ffd591',
              color: '#d46b08'
            }}>
              <strong>ℹ️ Important:</strong> As an Ag. C/PAP user, you can only delegate to one person at a time. 
              Creating a new delegation will automatically revoke any existing active delegation.
            </div>
          )} */}
          
          {/* Delegation Status Indicator */}
          {isAgCPAP && (() => {
            // Check if user is on leave based on local delegations state
            const hasActiveLeaveDelegation = delegations.some(d => 
              d.delegated_by_id === user?.id && d.is_active && d.reason === 'leave'
            );
            
            return (
            <div style={{ 
              marginBottom: 12, 
              padding: '8px 12px', 
                backgroundColor: hasActiveLeaveDelegation ? '#fff2f0' : '#f6ffed', 
              borderRadius: '6px', 
                border: `1px solid ${hasActiveLeaveDelegation ? '#ffccc7' : '#b7eb8f'}`,
                color: hasActiveLeaveDelegation ? '#cf1322' : '#389e0d'
            }}>
              <strong>
                  {hasActiveLeaveDelegation ? '🏖️ On Leave' : '✅ Available'}
              </strong>
              <br />
                {hasActiveLeaveDelegation ? (
                <>
                  You are currently on leave. Approval responsibilities have been delegated to Ag. AC/PAP users.<br />
                  <Tooltip title="This return date is automatically synchronized with the 'Expires At' date in the delegation table below">
                    <span style={{ color: '#666', cursor: 'help' }}>
                      Return date: {(() => {
                        // Debug: Log delegations data
                        console.log('DEBUG: Delegations data for Return date:', {
                          delegations,
                          user_id: user?.id,
                          delegations_length: delegations.length,
                          delegations_structure: delegations.map(d => ({
                            id: d.id,
                            delegated_by_id: d.delegated_by_id,
                            delegated_to_id: d.delegated_to_id,
                            is_active: d.is_active,
                            reason: d.reason,
                            expires_at: d.expires_at
                          }))
                        });
                        
                        // Get the active leave delegation from the local delegations state
                        // This date matches the "Expires At" column in the delegation table below
                        const activeLeaveDelegation = delegations.find(d => 
                          d.delegated_by_id === user?.id && d.is_active && d.reason === 'leave' && d.expires_at
                        );
                        
                        console.log('DEBUG: Active leave delegation found:', activeLeaveDelegation);
                        
                        if (activeLeaveDelegation?.expires_at) {
                          const returnDate = new Date(activeLeaveDelegation.expires_at);
                          const now = new Date();
                          const timeUntilReturn = returnDate.getTime() - now.getTime();
                          const daysUntilReturn = Math.ceil(timeUntilReturn / (1000 * 60 * 60 * 24));
                          
                          let timeInfo = '';
                          if (daysUntilReturn > 1) {
                            timeInfo = ` (in ${daysUntilReturn} days)`;
                          } else if (daysUntilReturn === 1) {
                            timeInfo = ' (tomorrow)';
                          } else if (daysUntilReturn === 0) {
                            timeInfo = ' (today)';
                          } else {
                            timeInfo = ' (overdue)';
                          }
                          
                          return format(returnDate, 'yyyy-MM-dd HH:mm') + timeInfo;
                        }
                        
                        // Fallback to first active delegation if no specific leave delegation found
                        const firstActiveDelegation = delegations.find(d => 
                          d.delegated_by_id === user?.id && d.is_active && d.expires_at
                        );
                        
                        console.log('DEBUG: First active delegation found:', firstActiveDelegation);
                        
                        if (firstActiveDelegation?.expires_at) {
                          return format(new Date(firstActiveDelegation.expires_at), 'yyyy-MM-dd HH:mm');
                        }
                        
                        return 'Not set';
                      })()}
                  </span>
                  </Tooltip>
                  {user?.leave_delegation_status?.status === 'expiring_soon' && (
                    <div style={{ marginTop: '8px', padding: '4px 8px', backgroundColor: '#fff7e6', borderRadius: '4px', border: '1px solid #ffd591' }}>
                      <strong>⚠️ Expiring Soon:</strong> Your leave delegation will expire in {user.leave_delegation_status.time_until_expiry}
                    </div>
                  )}
                </>
              ) : (
                'You are available to handle action log approvals and rejections.'
              )}
            </div>
          )}
          )}
          
          {/* Delegation Status for Ag. AC/PAP users */}
          {user?.has_ag_acpap_designation && (
            <div style={{ 
              marginBottom: 12, 
              padding: '8px 12px', 
              backgroundColor: user?.has_leave_delegation_responsibilities ? '#f6ffed' : '#fff7e6', 
              borderRadius: '6px', 
              border: `1px solid ${user?.has_leave_delegation_responsibilities ? '#b7eb8f' : '#ffd591'}`,
              color: user?.has_leave_delegation_responsibilities ? '#389e0d' : '#d46b08'
            }}>
              <strong>
                {user?.has_leave_delegation_responsibilities ? '📋 Acting Ag. C/PAP' : '⏳ No Delegation'}
              </strong>
              <br />
              {user?.has_leave_delegation_responsibilities ? (
                <>
                  You have taken over approval responsibilities due to Ag. C/PAP user being on leave.<br />
                  <span style={{ color: '#666' }}>
                    You can now approve/reject action logs until the delegation expires.
                  </span>
                  {user?.delegation_transition_info?.expires_at && (
                    <div style={{ marginTop: '8px', padding: '4px 8px', backgroundColor: '#f0f7ff', borderRadius: '4px', border: '1px solid #91d5ff' }}>
                      <strong>⏰ Expires:</strong> {format(new Date(user.delegation_transition_info.expires_at), 'yyyy-MM-dd HH:mm')}
                      {user?.delegation_transition_info?.time_until_expiry && (
                        <span style={{ marginLeft: '8px', color: '#666' }}>
                          (in {user.delegation_transition_info.time_until_expiry})
                        </span>
                      )}
                    </div>
                  )}
                </>
              ) : (
                'You do not currently have leave delegation responsibilities. Only Ag. C/PAP users can approve action logs.'
              )}
            </div>
          )}
          
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => {
              setIsReDelegating(false);
              delegationForm.resetFields();
              setDelegationModalVisible(true);
            }}
          >
            Delegate
          </Button>
        </div>
        <Table
          columns={delegationColumns}
          dataSource={delegations}
          rowKey="id"
          pagination={false}
        />
      </Card>
    );
  };

  const handleReDelegate = (delegation: Delegation) => {
    if (!canManageDelegations) {
      message.error('Only Ag. C/PAP users can re-delegate');
      return;
    }
    
    console.log('DEBUG: Re-delegating delegation:', delegation);
    console.log('DEBUG: Delegation delegated_to_id:', delegation.delegated_to_id);
    console.log('DEBUG: Full delegation object:', JSON.stringify(delegation, null, 2));
    console.log('DEBUG: Delegation keys:', Object.keys(delegation));
    console.log('DEBUG: Delegation delegated_to field:', delegation.delegated_to);
    console.log('DEBUG: Delegation delegated_to type:', typeof delegation.delegated_to);
    
    // Try to get the user ID from different possible fields
    let targetUserId = delegation.delegated_to_id;
    if (!targetUserId && delegation.delegated_to) {
      // If delegated_to_id is not available, try to extract from delegated_to
      if (typeof delegation.delegated_to === 'string') {
        // delegated_to might be a string representation, try to find the user
        const targetUser = users.find(u => 
          `${u.first_name} ${u.last_name}` === delegation.delegated_to ||
          u.username === delegation.delegated_to
        );
        if (targetUser) {
          targetUserId = targetUser.id;
          console.log('DEBUG: Found target user from delegated_to string:', targetUser);
        }
      }
    }
    
    console.log('DEBUG: Final target user ID to use:', targetUserId);
    
    // Verify that the target user actually exists
    const targetUser = users.find(u => u.id === targetUserId);
    if (!targetUser) {
      console.error('ERROR: Target user ID', targetUserId, 'not found in users list');
      console.log('DEBUG: Available user IDs:', users.map(u => u.id));
      message.error(`Cannot re-delegate: target user (ID: ${targetUserId}) not found`);
      return;
    }
    
    console.log('DEBUG: Target user found:', targetUser);
    
    // Check if we have a valid target user ID
    if (!targetUserId) {
      console.error('ERROR: Could not determine target user ID for re-delegation');
      message.error('Cannot re-delegate: could not determine target user');
      return;
    }
    
    // Set re-delegating state
    setIsReDelegating(true);
    
    // Pre-fill the delegation form with the previous delegation's details
    const formValues = {
      delegated_to_id: targetUserId,
      reason: delegation.reason || 'other', // Use the previous reason or default to 'other'
      expires_at: null // Reset expiration date for new delegation
    };
    
    console.log('DEBUG: Setting form values:', formValues);
    delegationForm.setFieldsValue(formValues);
    
    // Open the delegation modal
    setDelegationModalVisible(true);
  };

  // Function to handle assignee count changes
  const handleAssigneeCountChange = (assigneeIds: (string | number)[]) => {
    console.log('[TEAM_LEADER] handleAssigneeCountChange called with:', assigneeIds);
    const count = assigneeIds.length;
    setShowTeamLeaderField(count >= 2);
    
    // Reset team leader if assignee count drops below 2
    if (count < 2) {
      setSelectedTeamLeader(null);
      setTeamLeaderOptions([]);
      createForm.setFieldsValue({ team_leader: undefined });
      console.log('[TEAM_LEADER] Reset team leader - count < 2');
    }
    
    // Update team leader options if 2+ assignees
    if (count >= 2) {
      const options: Array<{label: string, value: number}> = [];
      assigneeIds.forEach((assigneeId: string | number) => {
        const user = users.find(u => u.id === (typeof assigneeId === 'string' ? parseInt(assigneeId) : assigneeId));
        if (user) {
          options.push({
            label: `${user.first_name} ${user.last_name}`,
            value: user.id
          });
        }
      });
      
      setTeamLeaderOptions(options);
      console.log('[TEAM_LEADER] Updated team leader options:', options);
      
      // Clear the team leader field when assignees change
      setSelectedTeamLeader(null);
      createForm.setFieldsValue({ team_leader: undefined });
      console.log('[TEAM_LEADER] Cleared team leader field for new selection');
    }
  };

  // Add delegation status refresh mechanism
  const [delegationStatusRefresh, setDelegationStatusRefresh] = useState(0);
  
  // Refresh delegation status every minute to catch expirations
  useEffect(() => {
    const interval = setInterval(() => {
      setDelegationStatusRefresh(prev => prev + 1);
    }, 60000); // Check every minute
    
    return () => clearInterval(interval);
  }, []);
  
  // Refresh user data when delegation status changes
  useEffect(() => {
    if (delegationStatusRefresh > 0) {
      // Refresh user data to get updated delegation status
      const refreshUserData = async () => {
        try {
          // This will trigger a re-render with updated delegation status
          // The backend will automatically return the correct status
          console.log('🔄 Refreshing delegation status...');
        } catch (error) {
          console.error('Error refreshing delegation status:', error);
        }
      };
      
      refreshUserData();
    }
  }, [delegationStatusRefresh]);

  // Add delegation expiration notifications
  useEffect(() => {
    if (user?.leave_delegation_status) {
      const status = user.leave_delegation_status;
      
      if (status.status === 'expiring_soon') {
        message.warning(
          `⚠️ Your leave delegation expires in ${status.time_until_expiry}. ` +
          'Approval responsibilities will automatically return to you when it expires.'
        );
      } else if (status.status === 'expired') {
        message.success(
          '✅ Your leave delegation has expired. Approval responsibilities have been returned to you.'
        );
      }
    }
    
    if (user?.delegation_transition_info) {
      const info = user.delegation_transition_info;
      
      if (info.type === 'ag_acpap_acting' && info.time_until_expiry) {
        // Check if delegation expires within 1 hour
        const timeUntilExpiry = new Date(info.expires_at).getTime() - new Date().getTime();
        const hoursUntilExpiry = timeUntilExpiry / (1000 * 60 * 60);
        
        if (hoursUntilExpiry <= 1 && hoursUntilExpiry > 0 && !isNaN(hoursUntilExpiry)) {
          message.warning(
            `⚠️ Your acting Ag. C/PAP responsibilities expire in ${Math.round(hoursUntilExpiry * 60)} minutes. ` +
            'Approval responsibilities will automatically return to the Ag. C/PAP user.'
          );
        }
      }
    }
  }, [user?.leave_delegation_status, user?.delegation_transition_info]);

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider width={200} style={{ background: '#fff', borderRight: '1px solid #e0e0e0', position: 'fixed', height: '100vh', left: 0, top: 0, zIndex: 10 }}>
        {/* User Profile Section */}
        <div
          style={{
            height: 140,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px 0',
            borderBottom: '1px solid #f0f0f0',
            background: '#fff',
            marginBottom: 16,
          }}
        >
          <Avatar
            size={80}
            icon={<UserOutlined />}
            style={{
              fontSize: 32,
              marginBottom: 8,
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: '#ffffff',
              border: '3px solid rgba(255, 255, 255, 0.2)',
              boxShadow: '0 8px 32px rgba(102, 126, 234, 0.3), 0 2px 8px rgba(0, 0, 0, 0.1)',
              backdropFilter: 'blur(10px)',
              borderRadius: '50%',
              transition: 'all 0.3s ease',
              cursor: 'pointer',
              flexShrink: 0
            }}
          />
          <div style={{ fontWeight: 600, fontSize: 16, color: '#222', textAlign: 'center', lineHeight: 1, marginBottom: 6 }}>{user ? `${user.first_name} ${user.last_name}` : ''}</div>
          <div style={{ fontSize: 13, color: '#888', textAlign: 'center', lineHeight: 1 }}>{user?.designation || ''}</div>
        </div>
        <Menu
          mode="inline"
          selectedKeys={[selectedMenuKey]}
          style={{ height: '100%', borderRight: 0 }}
          items={menuItems}
          onClick={handleMenuClick}
        />
      </Sider>
      <Layout style={{ marginLeft: 200, minHeight: '100vh' }}>
        <Content style={{ padding: 24, minHeight: 280, background: '#fff' }}>
          {selectedMenuKey === 'delegations' ? (
            renderDelegationTable()
          ) : (
            <Card
              className="dashboard-table-card"
              style={{ marginBottom: 24, borderRadius: 8, boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}
              styles={{ body: { padding: 0 } }}
            >
              <div className="dashboard-table-header-sticky">
                <h1 style={{ fontSize: '24px', fontWeight: 700, margin: 0 }}>
                  {showAssignedOnly ? 'Assigned To Me' : 
                   showPendingApproval ? (isAgCPAP ? 'Pending Approval' : 'Pending Approval') : 
                   'All Action Logs'}
                </h1>
                <div style={{ display: 'flex', gap: 16 }}>
                  <Input.Search
                    placeholder="Search action logs..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    style={{ width: 240 }}
                    allowClear
                  />
                  <Select
                    placeholder="Filter by status"
                    value={statusFilter || undefined}
                    onChange={value => setStatusFilter(value)}
                    allowClear
                    style={{ width: 180 }}
                    options={statusFilterOptions}
                  />
                  {canCreateLogs && (
                    <Button
                      type="primary"
                      icon={<PlusOutlined />}
                      onClick={() => setCreateModalVisible(true)}
                      disabled={!canCreateLogs}
                    >
                      Create Action Log
                    </Button>
                  )}

                  {user && (
                    <DelegationStatus 
                      hasActiveDelegation={user.has_active_delegation}
                      canCreateActionLogs={user.can_create_action_logs}
                      userDesignation={user.designation}
                    />
                  )}
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
                  <Dropdown
                    menu={{
                      items: [
                        {
                          key: 'excel',
                          label: 'Export to Excel',
                          onClick: handleExportExcel
                        },
                        {
                          key: 'word',
                          label: 'Export to Word',
                          onClick: handleExportWord
                        }
                      ]
                    }}
                    placement="bottomLeft"
                  >
                    <Button icon={<DownloadOutlined />} style={{ marginRight: 8 }}>
                      Export
                    </Button>
                  </Dropdown>
                </div>
              </div>
              <Table
                columns={columns}
                dataSource={getUnitFilteredLogs(getFilteredLogs())}
                loading={loading}
                rowKey="id"
                pagination={{ pageSize: 10 }}
                bordered
                className="dashboard-table"
                style={{ borderRadius: 8, fontSize: 14 }}
              />
            </Card>
          )}
          <div style={{ width: '100%', textAlign: 'center', padding: '16px 0', background: '#f5f6fa', color: '#888', fontSize: 14, borderTop: '1px solid #e0e0e0', marginBottom: 24 }}>
            Copyright &copy; 2025 Project Analysis & Public Investment Department (PAP) || Ministry of Finance, Planning & Economic Development (MoFPED)
          </div>
          {/* Modals and dialogs */}
          {renderViewModal()}
          <Modal
            title="Create Action Log"
            open={createModalVisible}
            onCancel={() => {
              setCreateModalVisible(false);
              setShowTeamLeaderField(false);
              setSelectedTeamLeader(null);
              setTeamLeaderOptions([]);
            }}
            footer={null}
            destroyOnHidden
          >
            <Form
              form={createForm}
              layout="vertical"
              onFinish={handleCreate}
              initialValues={{ priority: 'High' }}
            >
              <Form.Item name="title" label="Title" rules={[{ required: true, message: 'Please enter a title' }]}><Input /></Form.Item>
              <Form.Item name="description" label="Description (Optional)"><Input.TextArea rows={3} /></Form.Item>
              <Form.Item name="due_date" label="Due Date"><DatePicker style={{ width: '100%' }} /></Form.Item>
              <Form.Item name="priority" label="Priority" rules={[{ required: true, message: 'Please select a priority' }]}><Select options={[{ value: 'High' }, { value: 'Medium' }, { value: 'Low' }]} /></Form.Item>
              <Form.Item name="assigned_to" label="Assign To" rules={[{ required: true, message: 'Please select at least one user' }, { type: 'array', min: 1, message: 'Please select at least one user' }]}>
                <Select 
                  mode="multiple" 
                  showSearch 
                  filterOption={(input, option) => (option?.label ?? '').toLowerCase().includes(input.toLowerCase())} 
                  options={renderUserOptions()}
                  onChange={handleAssigneeCountChange}
                />
              </Form.Item>
              
              {/* Team Leader field - only shows when 2+ assignees */}
              {showTeamLeaderField && (
                <>
                  {/* <div style={{ 
                    marginBottom: '16px', 
                    padding: '12px', 
                    backgroundColor: '#f6ffed', 
                    border: '1px solid #b7eb8f', 
                    borderRadius: '6px',
                    fontSize: '14px'
                  }}>
                    <InfoCircleOutlined style={{ marginRight: '8px', color: '#52c41a' }} />
                    <strong>Team Assignment:</strong> When assigning to 2 or more users, a team leader must be selected. 
                    Only the team leader can update the action log status. Other team members can add comments.
                    <br />
                    <em>Note: The team leader field will be cleared when you change the assignees.</em>
                  </div> */}
                  <Form.Item 
                    name="team_leader" 
                    label="Team Leader (Required)" 
                    rules={[{ required: true, message: 'Please select a team leader' }]}
                  >
                    <Select
                      placeholder="Choose one..."
                      options={teamLeaderOptions}
                    />
                  </Form.Item>
                </>
              )}
              <Form.Item>
                <Button type="primary" htmlType="submit" loading={creating} disabled={creating}>Create</Button>
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
                  options={renderUserOptions()}
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
            destroyOnHidden
          >
            {/* {selectedLog && selectedLog.assigned_to && selectedLog.assigned_to.length >= 2 && selectedLog.team_leader && (
              <div style={{ 
                marginBottom: '16px', 
                padding: '12px', 
                backgroundColor: '#e6f7ff', 
                border: '1px solid #91d5ff', 
                borderRadius: '6px',
                fontSize: '14px'
              }}>
                <InfoCircleOutlined style={{ marginRight: '8px', color: '#1890ff' }} />
                <strong>Team Assignment:</strong> This action log is assigned to {selectedLog.assigned_to.length} users. 
                Only the team leader can update the status. Other team members can add comments.
              </div>
            )} */}
            <Form
              form={statusForm}
              onFinish={handleStatusUpdate}
              layout="vertical"
            >
              <Form.Item
                name="status"
                label="Status"
                rules={[{ required: true, message: 'Please select a status' }]}
              >
                <Select>
                  <Select.Option value="open">New</Select.Option>
                  <Select.Option value="in_progress">In Progress</Select.Option>
                  <Select.Option value="closed">Done</Select.Option>
                </Select>
              </Form.Item>

              <Form.Item
                name="status_comment"
                label="Comment"
                rules={[{ required: true, message: 'Please enter a comment' }]}
              >
                <Input.TextArea rows={4} />
              </Form.Item>

              <Form.Item>
                <Button type="primary" htmlType="submit">
                  Update Status
                </Button>
              </Form.Item>
            </Form>
          </Modal>
          {renderApprovalModal()}
          {renderRejectModal()}
          <Modal
            title="Comments"
            open={commentsModalVisible}
            onCancel={() => setCommentsModalVisible(false)}
            footer={null}
            width={700}
            destroyOnHidden
          >
            <Spin spinning={commentsLoading}>
              <div style={{ maxHeight: 400, overflowY: 'auto', marginBottom: 16 }}>
                {selectedLogComments.map(comment => (
                  <div key={comment.id}>
                    {renderComment(comment)}
                  </div>
                ))}
              </div>
              {/* Reply input (only when replyingTo is set) */}
              {replyingTo ? (
                <>
                  <div style={{ marginBottom: 8, background: '#f0f7ff', padding: 8, borderRadius: 4 }}>
                    Replying to: <strong>{replyingTo.user.first_name} {replyingTo.user.last_name}</strong>
                    <Button type="link" size="small" onClick={handleCancelReply} style={{ marginLeft: 8 }}>Cancel</Button>
                  </div>
                  <Input.TextArea
                    value={newComment}
                    onChange={e => setNewComment(e.target.value)}
                    rows={2}
                    placeholder="Add a reply..."
                    style={{ marginBottom: 8 }}
                  />
                  <Button
                    type="primary"
                    onClick={handleAddComment}
                    loading={submittingComment}
                    disabled={!newComment.trim()}
                  >
                    Reply
                  </Button>
                </>
              ) : (
                <>
                <Input.TextArea
                  value={newComment}
                  onChange={e => setNewComment(e.target.value)}
                  rows={2}
                  placeholder="Add a comment..."
                  style={{ marginBottom: 8 }}
                />
                <Button
                  type="primary"
                  onClick={handleAddComment}
                  loading={submittingComment}
                  disabled={!newComment.trim()}
                >
                  Add Comment
                </Button>
              </>
            )}
            </Spin>
          </Modal>
          
          {/* Delegation Creation Modal */}
          {canManageDelegations && (
            <Modal
              title={isReDelegating ? "Re-Delegate" : "Create Delegation"}
              open={delegationModalVisible}
              onCancel={() => {
                setDelegationModalVisible(false);
                setIsReDelegating(false);
                delegationForm.resetFields();
              }}
              footer={[
                <Button key="cancel" onClick={() => {
                  setDelegationModalVisible(false);
                  setIsReDelegating(false);
                  delegationForm.resetFields();
                }}>
                  Cancel
                </Button>,
                <Button key="submit" type="primary" onClick={() => delegationForm.submit()}>
                  {isReDelegating ? "Re-Delegate" : "Create Delegation"}
                </Button>
              ]}
              width={600}
            >
              <Form
                form={delegationForm}
                layout="vertical"
                onFinish={handleCreateDelegation}
              >
                {/* Warning for Ag. C/PAP users creating new delegations */}
                {/* {isAgCPAP && !isReDelegating && (
                  <div style={{ 
                    marginBottom: 16, 
                    padding: '8px 12px', 
                    backgroundColor: '#fff2f0', 
                    borderRadius: '6px', 
                    border: '1px solid #ffccc7',
                    color: '#cf1322'
                  }}>
                    <strong>⚠️ Warning:</strong> Creating this delegation will automatically revoke any existing active delegation you may have.
                  </div>
                )} */}
                
                <Form.Item
                  name="delegated_to_id"
                  label="Delegate To"
                  rules={[{ required: true, message: 'Please select a user to delegate to' }]}
                >
                  <Select
                    placeholder="Select a user to delegate to"
                    showSearch
                    optionFilterProp="label"
                    filterOption={(input, option) => {
                      if (!option?.label || typeof option.label !== 'string') return false;
                      return option.label.toLowerCase().includes(input.toLowerCase());
                    }}
                    style={{ width: '100%' }}
                  >
                    {users
                      .filter(u => {
                        // Filter out the current user and inactive users
                        if (u.id === user?.id || !u.is_active) return false;
                        
                        // Only Ag. C/PAP users can manage delegations now
                        // They can delegate to anyone (including Ag. AC/PAP users)
                        return true;
                      })
                      .map(u => (
                        <Select.Option 
                          key={u.id} 
                          value={u.id}
                          label={`${u.first_name} ${u.last_name}`}
                        >
                          {u.first_name} {u.last_name}
                        </Select.Option>
                      ))}
                  </Select>
                </Form.Item>
                
                <Form.Item
                  name="expires_at"
                  label="Expires At (Optional)"
                >
                  <DatePicker
                    showTime={{ format: 'HH:mm' }}
                    format="YYYY-MM-DD HH:mm"
                    placeholder="Select expiration date and time"
                    style={{ width: '100%' }}
                    inputReadOnly={false}
                  />
                </Form.Item>
                
                <Form.Item
                  name="reason"
                  label="Reason (Optional)"
                  initialValue="other"
                >
                  <Select
                    placeholder="Select reason for delegation"
                    allowClear
                    defaultValue="other"
                    options={[
                      { label: 'Leave', value: 'leave' },
                      { label: 'Other', value: 'other' }
                    ]}
                  />
                </Form.Item>
              </Form>
            </Modal>
          )}
        </Content>
      </Layout>
    </Layout>
  );
};

export default EconomistDashboard; 