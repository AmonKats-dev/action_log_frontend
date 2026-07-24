import { api } from './api';
import {
  ActivitySchedule,
  Category,
  CreateActivitySchedule,
  FinancialYear,
  GenerateSummary,
  Subcategory,
} from '../types/activity';
import { ActionLog } from '../types/actionLog';

const unwrap = <T,>(data: any): T[] => {
  if (data && 'results' in data) return data.results;
  if (Array.isArray(data)) return data;
  return [];
};

export interface OccurrenceQuery {
  financial_year?: number;
  quarter?: number;
  category?: number;
  subcategory?: number;
  schedule_health?: string;
  activity_schedule?: number;
}

export const activityService = {
  getFinancialYears: async (): Promise<FinancialYear[]> => {
    const res = await api.get('/activities/financial-years/', { params: { page_size: 100 } });
    return unwrap<FinancialYear>(res.data);
  },

  getCategories: async (): Promise<Category[]> => {
    const res = await api.get('/activities/categories/', { params: { page_size: 200 } });
    return unwrap<Category>(res.data);
  },

  // All subcategories as a flat list (global ones have category === null).
  getSubcategories: async (): Promise<Subcategory[]> => {
    const res = await api.get('/activities/subcategories/', { params: { page_size: 500 } });
    return unwrap<Subcategory>(res.data);
  },

  getSchedules: async (params?: { financial_year?: number }): Promise<ActivitySchedule[]> => {
    const res = await api.get('/activities/schedules/', { params: { page_size: 500, ...params } });
    return unwrap<ActivitySchedule>(res.data);
  },

  createSchedule: async (data: CreateActivitySchedule): Promise<ActivitySchedule> => {
    const res = await api.post('/activities/schedules/', data);
    return res.data;
  },

  updateSchedule: async (id: number, data: Partial<CreateActivitySchedule>): Promise<ActivitySchedule> => {
    const res = await api.patch(`/activities/schedules/${id}/`, data);
    return res.data;
  },

  regenerate: async (id: number, deleteOrphans = true): Promise<GenerateSummary> => {
    const res = await api.post(`/activities/schedules/${id}/regenerate/`, { delete_orphans: deleteOrphans });
    return res.data;
  },

  preview: async (id: number): Promise<any[]> => {
    const res = await api.get(`/activities/schedules/${id}/preview/`);
    return res.data;
  },

  // Occurrences are ActionLog rows linked to a schedule; fetched from the action-logs endpoint.
  getOccurrences: async (params: OccurrenceQuery): Promise<ActionLog[]> => {
    const res = await api.get('/action-logs/', { params: { page_size: 500, ...params } });
    return unwrap<ActionLog>(res.data);
  },
};
