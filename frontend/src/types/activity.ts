export type Frequency = 'one_off' | 'weekly' | 'monthly' | 'quarterly';
export type Lifecycle = 'done' | 'recurring' | 'carry_over' | 'in_progress' | 'ongoing' | 'planned' | 'projected';
export type ScheduleHealth = 'completed' | 'on_track' | 'overdue';

export interface FinancialYear {
  id: number;
  code: string;
  start_date: string;
  end_date: string;
  is_current: boolean;
}

export interface Subcategory {
  id: number;
  name: string;
  description?: string;
  category: number | null;
  category_name?: string;
}

export interface Category {
  id: number;
  name: string;
  code: string;
  description?: string;
  subcategories: Subcategory[];
}

export interface ActivitySchedule {
  id: number;
  title: string;
  description?: string;
  department: number;
  financial_year: number;
  financial_year_code?: string;
  category: number | null;
  category_name?: string;
  subcategory: number | null;
  subcategory_name?: string;
  lead: number | null;
  default_assignees: number[];
  frequency: Frequency;
  window_start: string;
  window_end: string;
  weekday?: number | null;
  day_of_month?: number | null;
  lifecycle: Lifecycle;
  is_active: boolean;
  notes?: string;
  fy_sequence?: number | null;
  reference_code?: string;
  occurrence_count?: number;
  created_at?: string;
  updated_at?: string;
}

export interface CreateActivitySchedule {
  title: string;
  description?: string;
  department: number;
  financial_year: number;
  category?: number | null;
  subcategory?: number | null;
  lead?: number | null;
  default_assignees?: number[];
  frequency: Frequency;
  window_start: string;
  window_end: string;
  weekday?: number | null;
  day_of_month?: number | null;
  lifecycle?: Lifecycle;
  notes?: string;
}

export interface GenerateSummary {
  created: number;
  updated: number;
  skipped: number;
  deleted: number;
}

export const FREQUENCY_LABELS: Record<Frequency, string> = {
  one_off: 'One-off',
  weekly: 'Weekly',
  monthly: 'Monthly',
  quarterly: 'Quarterly',
};

export const LIFECYCLE_LABELS: Record<Lifecycle, string> = {
  done: 'Done',
  recurring: 'Recurring',
  carry_over: 'Carry-over',
  in_progress: 'In progress',
  ongoing: 'Ongoing',
  planned: 'Planned',
  projected: 'Projected',
};

export const HEALTH_META: Record<ScheduleHealth, { label: string; color: string }> = {
  completed: { label: 'Completed', color: 'blue' },
  on_track: { label: 'On track', color: 'green' },
  overdue: { label: 'Overdue', color: 'red' },
};
