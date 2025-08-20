import { api } from './api';

export interface Delegation {
  id: number;
  delegated_by: number;
  delegated_by_id: number;
  delegated_to: number;
  delegated_to_id: number;
  delegated_at: string;
  expires_at: string;
  is_active: boolean;
  reason: 'leave' | 'other';
  created_at: string;
  updated_at: string;
}

export interface CreateDelegationRequest {
  delegated_to_id: number;
  expires_at?: string;
  reason?: 'leave' | 'other';
}

export interface DelegationResponse {
  results?: Delegation[];
  data?: Delegation[];
}

class DelegationService {
  async getAll(): Promise<Delegation[]> {
    try {
      const response = await api.get('/delegations/');
      return response.data;
    } catch (error) {
      console.error('Error fetching delegations:', error);
      throw error;
    }
  }

  async create(delegationData: CreateDelegationRequest): Promise<Delegation> {
    try {
      const response = await api.post('/delegations/', delegationData);
      return response.data;
    } catch (error) {
      console.error('Error creating delegation:', error);
      throw error;
    }
  }

  async revoke(delegationId: number): Promise<void> {
    try {
      await api.delete(`/delegations/${delegationId}/`);
    } catch (error) {
      console.error('Error revoking delegation:', error);
      throw error;
    }
  }

  async getById(delegationId: number): Promise<Delegation> {
    try {
      const response = await api.get(`/delegations/${delegationId}/`);
      return response.data;
    } catch (error) {
      console.error('Error fetching delegation:', error);
      throw error;
    }
  }

  async update(delegationId: number, delegationData: Partial<CreateDelegationRequest>): Promise<Delegation> {
    try {
      const response = await api.put(`/delegations/${delegationId}/`, delegationData);
      return response.data;
    } catch (error) {
      console.error('Error updating delegation:', error);
      throw error;
    }
  }
}

export const delegationService = new DelegationService();
