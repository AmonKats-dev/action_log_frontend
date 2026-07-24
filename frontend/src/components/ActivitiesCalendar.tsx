import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Button, Card, DatePicker, Descriptions, Divider, Form, Input, InputNumber, Modal,
  Radio, Select, Space, Spin, Table, Tag, Timeline, Tooltip, message,
} from 'antd';
import { CalendarOutlined, CrownOutlined, EditOutlined, EyeOutlined, FilterOutlined, PlusOutlined, ReloadOutlined, SearchOutlined, SwapRightOutlined, TeamOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';

import { activityService } from '../services/activityService';
import {
  ActivitySchedule, Category, FinancialYear, Frequency, Subcategory,
  FREQUENCY_LABELS, HEALTH_META, LIFECYCLE_LABELS, ScheduleHealth,
} from '../types/activity';
import { ActionLog } from '../types/actionLog';
import { User } from '../types/user';
import { Department } from '../types/department';

const { TextArea } = Input;

interface ActivitiesCalendarProps {
  users: User[];
  departments: Department[];
  canManage: boolean;
  defaultDepartmentId?: number;
}

const WEEKDAYS = [
  { value: 0, label: 'Monday' },
  { value: 1, label: 'Tuesday' },
  { value: 2, label: 'Wednesday' },
  { value: 3, label: 'Thursday' },
  { value: 4, label: 'Friday' },
  { value: 5, label: 'Saturday' },
  { value: 6, label: 'Sunday' },
];

// Render a date as "22<sup>nd</sup> Mar" — the ordinal suffix raised as a
// superscript, with the year omitted (the financial year is shown separately).
const dateSup = (ds?: string | null): React.ReactNode => {
  if (!ds) return '—';
  const d = dayjs(ds);
  if (!d.isValid()) return '—';
  const day = d.date();
  const v = day % 100;
  const suffixes = ['th', 'st', 'nd', 'rd'];
  const suffix = suffixes[(v - 20) % 10] || suffixes[v] || suffixes[0];
  return <>{day}<sup>{suffix}</sup> {d.format('MMM')}</>;
};

// The window is flexible: a single day (weekly/monthly/one-off) shows as one date,
// while a multi-day span (e.g. a quarter's month period) shows as a range.
const windowNode = (r: ActionLog): React.ReactNode => {
  const start = r.start_date ? dayjs(r.start_date) : null;
  const due = r.due_date ? dayjs(r.due_date) : null;
  if (start && due && !start.isSame(due, 'day')) {
    return <>{dateSup(r.start_date)} → {dateSup(r.due_date)}</>;
  }
  const single = r.start_date || r.due_date;
  return single ? dateSup(single) : '—';
};

// Human-friendly relative period for a window that sits inside a single month,
// e.g. "Early Nov", "Mid Oct", "Late Jan" (or just "November" when it spans the
// whole month). Returns null for multi-month windows so callers fall back to
// exact dates. This is display-only: the active-period dates remain the single
// source of truth, so the picker keeps working unchanged.
const fuzzyPeriod = (startStr?: string | null, endStr?: string | null): string | null => {
  if (!startStr || !endStr) return null;
  const s = dayjs(startStr);
  const e = dayjs(endStr);
  if (!s.isValid() || !e.isValid()) return null;
  if (!s.isSame(e, 'month') || !s.isSame(e, 'year')) return null;
  const lastDay = s.daysInMonth();
  // Covers essentially the whole month → just the month name.
  if (s.date() <= 2 && e.date() >= lastDay - 1) return s.format('MMMM');
  // Otherwise classify by the window's midpoint into thirds of the month.
  const mid = (s.date() + e.date()) / 2;
  const part = mid <= 10 ? 'Early' : mid <= 20 ? 'Mid' : 'Late';
  return `${part} ${s.format('MMM')}`;
};

// Human-readable recurrence pattern derived from the schedule.
const patternLabel = (sch?: ActivitySchedule): string => {
  if (!sch) return '—';
  switch (sch.frequency) {
    case 'weekly':
      return sch.weekday != null && sch.weekday !== undefined
        ? `Every ${WEEKDAYS.find(w => w.value === sch.weekday)?.label || 'week'}`
        : 'Weekly';
    case 'monthly':
      return sch.day_of_month ? `Day ${sch.day_of_month} of each month` : 'Monthly';
    case 'quarterly':
      return 'Each financial-year quarter';
    case 'one_off':
      return 'One-off';
    default:
      return FREQUENCY_LABELS[sch.frequency] || '—';
  }
};

const ActivitiesCalendar: React.FC<ActivitiesCalendarProps> = ({
  users, departments, canManage, defaultDepartmentId,
}) => {
  const [financialYears, setFinancialYears] = useState<FinancialYear[]>([]);
  const [selectedFY, setSelectedFY] = useState<number | undefined>(undefined);
  const [quarter, setQuarter] = useState<number>(0); // 0 = all quarters
  // Search + filters for narrowing the table.
  const [searchText, setSearchText] = useState('');
  const [filterCategory, setFilterCategory] = useState<number | undefined>(undefined);
  const [filterFrequency, setFilterFrequency] = useState<Frequency | undefined>(undefined);
  const [filterLifecycle, setFilterLifecycle] = useState<string | undefined>(undefined);
  const [filterHealth, setFilterHealth] = useState<ScheduleHealth | undefined>(undefined);
  const [filterLead, setFilterLead] = useState<number | undefined>(undefined);
  const [categories, setCategories] = useState<Category[]>([]);
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
  const [schedules, setSchedules] = useState<ActivitySchedule[]>([]);
  const [occurrences, setOccurrences] = useState<ActionLog[]>([]);
  const [loading, setLoading] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<ActivitySchedule | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [selectedSchedule, setSelectedSchedule] = useState<ActivitySchedule | null>(null);
  const [form] = Form.useForm();
  const watchedFrequency = Form.useWatch('frequency', form) as Frequency | undefined;
  const watchedMonthlyMode = Form.useWatch('monthly_mode', form) as 'day_of_month' | 'active_period' | undefined;
  const watchedFY = Form.useWatch('financial_year', form) as number | undefined;
  // Quick-pick helpers for the active period (Early/Mid/Late + month).
  const [quickPart, setQuickPart] = useState<'Early' | 'Mid' | 'Late' | undefined>(undefined);
  const [quickMonth, setQuickMonth] = useState<number | undefined>(undefined);

  const userName = useMemo(() => {
    const map = new Map<number, string>();
    users.forEach(u => map.set(u.id, `${u.first_name} ${u.last_name}`.trim()));
    return map;
  }, [users]);

  // Group occurrences under their parent schedule so each activity rolls up
  // into a single row (the calendar is activity-centric, not occurrence-centric).
  const occBySchedule = useMemo(() => {
    const map = new Map<number, ActionLog[]>();
    occurrences.forEach(o => {
      if (o.activity_schedule == null) return;
      const arr = map.get(o.activity_schedule) || [];
      arr.push(o);
      map.set(o.activity_schedule, arr);
    });
    return map;
  }, [occurrences]);

  // Aggregate schedule health across a schedule's occurrences in the current view.
  const aggHealth = useCallback((scheduleId: number): ScheduleHealth | null => {
    const occ = occBySchedule.get(scheduleId);
    if (!occ || !occ.length) return null;
    if (occ.some(o => o.schedule_health === 'overdue')) return 'overdue';
    if (occ.some(o => (o.schedule_health || 'on_track') === 'on_track')) return 'on_track';
    return 'completed';
  }, [occBySchedule]);

  // Schedule health shown in the table: an activity marked "Done" reads as
  // Completed regardless of occurrence dates; otherwise use the aggregate.
  const scheduleHealthOf = useCallback((sch: ActivitySchedule): ScheduleHealth | null => {
    if (sch.lifecycle === 'done') return 'completed';
    return aggHealth(sch.id);
  }, [aggHealth]);

  // When a quarter is selected, only show activities that have occurrences in it.
  const displayedSchedules = useMemo(() => {
    if (!quarter) return schedules;
    return schedules.filter(s => occBySchedule.has(s.id));
  }, [schedules, occBySchedule, quarter]);

  // Apply the search box and filter dropdowns on top of the quarter selection.
  const visibleSchedules = useMemo(() => {
    const q = searchText.trim().toLowerCase();
    return displayedSchedules.filter((s) => {
      if (filterCategory != null && s.category !== filterCategory) return false;
      if (filterFrequency && s.frequency !== filterFrequency) return false;
      if (filterLifecycle && s.lifecycle !== filterLifecycle) return false;
      if (filterLead != null && s.lead !== filterLead) return false;
      if (filterHealth && scheduleHealthOf(s) !== filterHealth) return false;
      if (q) {
        const leadName = s.lead ? (userName.get(s.lead) || '') : '';
        const haystack = [s.title, s.reference_code, s.category_name, s.subcategory_name, leadName]
          .filter(Boolean).join(' ').toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [displayedSchedules, searchText, filterCategory, filterFrequency, filterLifecycle, filterLead, filterHealth, scheduleHealthOf, userName]);

  const activeFilterCount = [filterCategory, filterFrequency, filterLifecycle, filterLead, filterHealth]
    .filter((v) => v !== undefined && v !== null).length + (searchText.trim() ? 1 : 0);

  const clearFilters = () => {
    setSearchText('');
    setFilterCategory(undefined);
    setFilterFrequency(undefined);
    setFilterLifecycle(undefined);
    setFilterLead(undefined);
    setFilterHealth(undefined);
  };

  // Initial lookups.
  useEffect(() => {
    (async () => {
      const [fys, cats, subs] = await Promise.all([
        activityService.getFinancialYears(),
        activityService.getCategories(),
        activityService.getSubcategories(),
      ]);
      setFinancialYears(fys);
      setCategories(cats);
      setSubcategories(subs);
      const current = fys.find(f => f.is_current) || fys[0];
      if (current) setSelectedFY(current.id);
    })().catch(() => message.error('Failed to load activity lookups'));
  }, []);

  const loadData = useCallback(async () => {
    if (!selectedFY) return;
    setLoading(true);
    try {
      const [sch, occ] = await Promise.all([
        activityService.getSchedules({ financial_year: selectedFY }),
        activityService.getOccurrences({
          financial_year: selectedFY,
          ...(quarter ? { quarter } : {}),
        }),
      ]);
      setSchedules(sch);
      setOccurrences(occ);
    } catch {
      message.error('Failed to load activities');
    } finally {
      setLoading(false);
    }
  }, [selectedFY, quarter]);

  useEffect(() => { loadData(); }, [loadData]);

  // Subcategories are a flat, cross-cutting list shown regardless of the chosen
  // category. Deduplicate by name (a name may exist both globally and under a
  // category) and sort alphabetically.
  const subcategoryOptions = useMemo(() => {
    const seen = new Map<string, number>();
    subcategories.forEach((s) => {
      if (!seen.has(s.name)) seen.set(s.name, s.id);
    });
    return Array.from(seen.entries())
      .map(([label, value]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [subcategories]);

  // Months listed in financial-year order (e.g. Jul … Jun) for the quick-pick.
  const monthOptions = useMemo(() => {
    const fy = financialYears.find(f => f.id === watchedFY);
    const startMonth = fy ? dayjs(fy.start_date).month() : 0;
    return Array.from({ length: 12 }, (_, i) => {
      const m = (startMonth + i) % 12;
      return { value: m, label: dayjs().month(m).format('MMMM') };
    });
  }, [financialYears, watchedFY]);

  // Resolve an "Early/Mid/Late + month" choice into concrete dates within the
  // selected financial year and write them to the active-period range. The range
  // remains the source of truth, so generation keeps working unchanged.
  const applyQuickPeriod = (part?: 'Early' | 'Mid' | 'Late', monthIndex?: number) => {
    // No effect until both a part and a month are chosen.
    if (!part || monthIndex == null) return;
    const fy = financialYears.find(f => f.id === form.getFieldValue('financial_year'));
    if (!fy) { message.warning('Pick a financial year first.'); return; }
    const fyStart = dayjs(fy.start_date);
    // FY months at/after the start month belong to the start year; the rest roll over.
    const year = monthIndex >= fyStart.month() ? fyStart.year() : fyStart.year() + 1;
    const monthStart = dayjs(new Date(year, monthIndex, 1));
    let s: dayjs.Dayjs;
    let e: dayjs.Dayjs;
    if (part === 'Early') { s = monthStart.date(1); e = monthStart.date(10); }
    else if (part === 'Mid') { s = monthStart.date(11); e = monthStart.date(20); }
    else { s = monthStart.date(21); e = monthStart.endOf('month'); }
    form.setFieldValue('window_range', [s, e]);
  };

  const openDetails = (record: ActivitySchedule) => {
    setSelectedSchedule(record);
    setDetailsOpen(true);
  };

  const fyRange = (fyId?: number): [dayjs.Dayjs, dayjs.Dayjs] | undefined => {
    const fy = financialYears.find(f => f.id === fyId);
    return fy ? [dayjs(fy.start_date), dayjs(fy.end_date)] : undefined;
  };

  // Which financial-year quarters (1-4) an activity's window covers. Computed from
  // the window dates against the FY start, so it is independent of the quarter
  // filter. Returns null when it can't be resolved.
  const quarterSpan = useCallback((sch: ActivitySchedule): { from: number; to: number } | null => {
    const fy = financialYears.find(f => f.id === sch.financial_year);
    if (!fy || !sch.window_start || !sch.window_end) return null;
    const fyStart = dayjs(fy.start_date);
    const quarterOf = (ds: string) => {
      const d = dayjs(ds);
      const months = (d.year() * 12 + d.month()) - (fyStart.year() * 12 + fyStart.month());
      if (months < 0 || months > 11) return null;
      return Math.floor(months / 3) + 1;
    };
    const from = quarterOf(sch.window_start);
    const to = quarterOf(sch.window_end);
    if (from == null || to == null) return null;
    return { from: Math.min(from, to), to: Math.max(from, to) };
  }, [financialYears]);

  // Values applied each time the activity form mounts (it uses destroyOnClose, so
  // initialValues are re-read on every open). When editing, prefill from the
  // schedule; otherwise default a new activity to the whole financial year.
  const formInitialValues = useMemo(() => {
    if (editingSchedule) {
      const s = editingSchedule;
      const base: any = {
        title: s.title,
        department: s.department,
        financial_year: s.financial_year,
        category: s.category ?? undefined,
        subcategory: s.subcategory ?? undefined,
        lead: s.lead ?? undefined,
        default_assignees: s.default_assignees || [],
        frequency: s.frequency,
        weekday: s.weekday ?? undefined,
        day_of_month: s.day_of_month ?? undefined,
        lifecycle: s.lifecycle,
        description: s.description,
        notes: s.notes,
        monthly_mode: s.frequency === 'monthly' && !s.day_of_month ? 'active_period' : 'day_of_month',
      };
      if (s.frequency === 'one_off') {
        base.single_date = s.window_start ? dayjs(s.window_start) : undefined;
      } else {
        base.window_range = (s.window_start && s.window_end) ? [dayjs(s.window_start), dayjs(s.window_end)] : undefined;
      }
      return base;
    }
    return {
      financial_year: selectedFY,
      department: defaultDepartmentId,
      frequency: 'weekly' as Frequency,
      lifecycle: 'recurring',
      monthly_mode: 'day_of_month',
      window_range: fyRange(selectedFY),
    };
  }, [editingSchedule, selectedFY, defaultDepartmentId, financialYears]); // eslint-disable-line react-hooks/exhaustive-deps

  const openCreate = () => {
    setEditingSchedule(null);
    setQuickPart(undefined);
    setQuickMonth(undefined);
    setModalOpen(true);
  };

  const openEdit = (schedule: ActivitySchedule) => {
    setEditingSchedule(schedule);
    setQuickPart(undefined);
    setQuickMonth(undefined);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingSchedule(null);
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);
      // Derive the generation window from the frequency-aware inputs.
      let windowStart: string | undefined;
      let windowEnd: string | undefined;
      if (values.frequency === 'one_off') {
        windowStart = windowEnd = values.single_date ? dayjs(values.single_date).format('YYYY-MM-DD') : undefined;
      } else {
        // Day-level period (e.g. 3rd Jun → 7th Aug): use the exact dates chosen.
        const range = values.window_range || [];
        windowStart = range[0] ? dayjs(range[0]).format('YYYY-MM-DD') : undefined;
        windowEnd = range[1] ? dayjs(range[1]).format('YYYY-MM-DD') : undefined;
      }
      const payload: any = { ...values, window_start: windowStart, window_end: windowEnd };
      // Monthly recurrence can be driven either by an explicit day-of-month or by
      // the active period's start day. In the latter case clear day_of_month so the
      // backend falls back to the window-start day.
      if (values.frequency === 'monthly' && values.monthly_mode === 'active_period') {
        payload.day_of_month = null;
      }
      delete payload.single_date;
      delete payload.window_range;
      delete payload.monthly_mode;

      let saved: ActivitySchedule;
      if (editingSchedule) {
        saved = await activityService.updateSchedule(editingSchedule.id, payload);
        const count = saved.occurrence_count ?? 0;
        message.success(`Activity updated — ${count} occurrence${count === 1 ? '' : 's'} in schedule.`);
      } else {
        saved = await activityService.createSchedule(payload);
        const count = saved.occurrence_count ?? 0;
        message.success(`Activity created — ${count} occurrence${count === 1 ? '' : 's'} generated.`);
      }
      closeModal();
      if (saved.financial_year && saved.financial_year !== selectedFY) {
        setSelectedFY(saved.financial_year);
      } else {
        loadData();
      }
    } catch (err: any) {
      if (err?.errorFields) return; // form validation error; inline messages shown
      const detail = err?.response?.data ? JSON.stringify(err.response.data) : 'Failed to save activity';
      message.error(detail);
    } finally {
      setSubmitting(false);
    }
  };

  const columns: ColumnsType<ActivitySchedule> = [
    {
      title: 'Activity',
      dataIndex: 'title',
      key: 'title',
      width: 240,
      render: (title: string) => (
        <span style={{ fontWeight: 600, whiteSpace: 'normal', wordBreak: 'break-word', display: 'inline-block', maxWidth: 240 }}>
          {title}
        </span>
      ),
      sorter: (a, b) => (a.title || '').localeCompare(b.title || ''),
    },
    {
      title: 'Category',
      key: 'category',
      width: 140,
      render: (_: any, r) => r.category_name || '—',
      sorter: (a, b) => (a.category_name || '').localeCompare(b.category_name || ''),
    },
    {
      title: 'Subcategory',
      key: 'subcategory',
      width: 150,
      render: (_: any, r) => r.subcategory_name || '—',
    },
    {
      title: 'Lead',
      key: 'lead',
      width: 160,
      render: (_: any, r) => {
        // Only the lead person; assignees stay hidden. Highlighted as a gold tag.
        // Use inline-flex so wrapped lines (e.g. the surname) align under the first
        // name instead of falling back beneath the icon.
        if (!r.lead) return '—';
        const name = userName.get(r.lead) || `User #${r.lead}`;
        return (
          <Tag color="gold" style={{ fontWeight: 600, display: 'inline-flex', alignItems: 'flex-start', whiteSpace: 'normal' }}>
            <CrownOutlined style={{ marginRight: 4, marginTop: 4, flexShrink: 0 }} />
            <span style={{ wordBreak: 'break-word' }}>{name}</span>
          </Tag>
        );
      },
    },
    {
      title: 'Window',
      key: 'window',
      width: 220,
      render: (_: any, r) => {
        const fuzzy = fuzzyPeriod(r.window_start, r.window_end);
        const span = quarterSpan(r);
        return (
          <div>
            <div style={{ fontWeight: 500 }}>{patternLabel(r)}</div>
            {fuzzy && <div style={{ fontSize: 13 }}>{fuzzy}</div>}
            {r.window_start && r.window_end && (
              <div style={{ fontSize: 12, color: '#888' }}>
                {dateSup(r.window_start)} → {dateSup(r.window_end)}
              </div>
            )}
            {span && span.from !== span.to && (
              <Tag color="purple" icon={<SwapRightOutlined />} style={{ marginTop: 4, fontWeight: 600 }}>
                Spans Q{span.from}–Q{span.to}
              </Tag>
            )}
          </div>
        );
      },
      sorter: (a, b) => (a.window_start || '').localeCompare(b.window_start || ''),
    },
    {
      title: 'Frequency',
      key: 'frequency',
      width: 110,
      render: (_: any, r) => FREQUENCY_LABELS[r.frequency] || '—',
    },
    {
      title: 'Status',
      key: 'lifecycle',
      width: 110,
      render: (_: any, r) => <Tag>{LIFECYCLE_LABELS[r.lifecycle]}</Tag>,
    },
    {
      title: 'Schedule',
      key: 'schedule_health',
      width: 150,
      render: (_: any, r) => {
        const health = scheduleHealthOf(r);
        const count = occBySchedule.get(r.id)?.length ?? 0;
        return (
          <Space size={4}>
            {health
              ? <Tag color={HEALTH_META[health].color} style={{ fontWeight: 600 }}>{HEALTH_META[health].label}</Tag>
              : <Tag>—</Tag>}
            <Tooltip title="Occurrences generated in this period">
              <Tag>{count}×</Tag>
            </Tooltip>
          </Space>
        );
      },
      filters: [
        { text: 'Completed', value: 'completed' },
        { text: 'On track', value: 'on_track' },
        { text: 'Overdue', value: 'overdue' },
      ],
      onFilter: (value, r) => scheduleHealthOf(r) === value,
    },
    {
      title: 'Notes',
      key: 'notes',
      width: 260,
      render: (_: any, r) => {
        const note = (r.notes || '').trim();
        if (!note) return '—';
        // Preserve line breaks and wrap long notes so they read reasonably.
        return (
          <div style={{ whiteSpace: 'pre-line', maxWidth: 260, wordBreak: 'break-word' }}>
            {note}
          </div>
        );
      },
    },
    {
      title: '',
      key: 'actions',
      width: canManage ? 90 : 60,
      fixed: 'right',
      render: (_: any, r) => (
        <Space size={0}>
          <Tooltip title="View details">
            <Button
              type="text"
              icon={<EyeOutlined />}
              onClick={(e) => { e.stopPropagation(); openDetails(r); }}
            />
          </Tooltip>
          {canManage && (
            <Tooltip title="Edit activity">
              <Button
                type="text"
                icon={<EditOutlined />}
                onClick={(e) => { e.stopPropagation(); openEdit(r); }}
              />
            </Tooltip>
          )}
        </Space>
      ),
    },
  ];

  const quarterTabs = [
    { key: '0', label: 'All' },
    { key: '1', label: 'Q1' },
    { key: '2', label: 'Q2' },
    { key: '3', label: 'Q3' },
    { key: '4', label: 'Q4' },
  ];

  return (
    <Card
      style={{ marginBottom: 24, borderRadius: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.06)' }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16, marginBottom: 16 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>
          <CalendarOutlined style={{ marginRight: 8 }} />
          Activities Calendar
        </h1>
        <Space wrap>
          <Select
            placeholder="Financial Year"
            style={{ width: 160 }}
            value={selectedFY}
            onChange={setSelectedFY}
            options={financialYears.map(f => ({ value: f.id, label: f.code + (f.is_current ? ' (current)' : '') }))}
          />
          <Button icon={<ReloadOutlined />} onClick={loadData}>Refresh</Button>
          {canManage && (
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>New Activity</Button>
          )}
        </Space>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {quarterTabs.map(t => (
          <Button
            key={t.key}
            type={String(quarter) === t.key ? 'primary' : 'default'}
            onClick={() => setQuarter(Number(t.key))}
          >
            {t.label}
          </Button>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <Input
          allowClear
          prefix={<SearchOutlined style={{ color: '#bbb' }} />}
          placeholder="Search activity, ref, category, lead…"
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          style={{ width: 280 }}
        />
        <Select
          allowClear
          placeholder="Category"
          value={filterCategory}
          onChange={setFilterCategory}
          style={{ width: 160 }}
          options={categories.map(c => ({ value: c.id, label: c.name }))}
        />
        <Select
          allowClear
          placeholder="Frequency"
          value={filterFrequency}
          onChange={setFilterFrequency}
          style={{ width: 140 }}
          options={(Object.keys(FREQUENCY_LABELS) as Frequency[]).map(k => ({ value: k, label: FREQUENCY_LABELS[k] }))}
        />
        <Select
          allowClear
          placeholder="Status"
          value={filterLifecycle}
          onChange={setFilterLifecycle}
          style={{ width: 140 }}
          options={(Object.keys(LIFECYCLE_LABELS) as Array<keyof typeof LIFECYCLE_LABELS>).map(k => ({ value: k, label: LIFECYCLE_LABELS[k] }))}
        />
        <Select
          allowClear
          placeholder="Schedule"
          value={filterHealth}
          onChange={setFilterHealth}
          style={{ width: 140 }}
          options={(Object.keys(HEALTH_META) as ScheduleHealth[]).map(k => ({ value: k, label: HEALTH_META[k].label }))}
        />
        <Select
          allowClear
          showSearch
          optionFilterProp="label"
          placeholder="Lead"
          value={filterLead}
          onChange={setFilterLead}
          style={{ width: 180 }}
          options={users.map(u => ({ value: u.id, label: `${u.first_name} ${u.last_name}`.trim() }))}
        />
        {activeFilterCount > 0 && (
          <Button icon={<FilterOutlined />} onClick={clearFilters}>
            Clear ({activeFilterCount})
          </Button>
        )}
      </div>

      <Spin spinning={loading}>
        <Table<ActivitySchedule>
          rowKey="id"
          columns={columns}
          dataSource={visibleSchedules}
          size="small"
          scroll={{ x: 'max-content', y: 480 }}
          pagination={{ pageSize: 25, showSizeChanger: true }}
          locale={{ emptyText: 'No activities for this period. Use "New Activity" to add one.' }}
          onRow={(record) => ({
            onClick: () => openDetails(record),
            style: { cursor: 'pointer' },
          })}
        />
      </Spin>

      <Modal
        title={editingSchedule ? 'Edit Activity' : 'New Activity'}
        open={modalOpen}
        onOk={handleSubmit}
        onCancel={closeModal}
        confirmLoading={submitting}
        okText={editingSchedule ? 'Save & regenerate' : 'Create & generate'}
        width={640}
        destroyOnClose
      >
        <Form form={form} layout="vertical" initialValues={formInitialValues}>
          <Form.Item name="title" label="Activity" rules={[{ required: true, message: 'Title is required' }]}>
            <Input placeholder="e.g. Weekly Budget Directorate Meetings" />
          </Form.Item>

          <Space style={{ display: 'flex' }} align="start">
            <Form.Item name="department" label="Department" rules={[{ required: true }]} style={{ flex: 1, minWidth: 200 }}>
              <Select
                placeholder="Department"
                options={departments.map(d => ({ value: d.id, label: d.name }))}
                showSearch
                optionFilterProp="label"
              />
            </Form.Item>
            <Form.Item name="financial_year" label="Financial Year" rules={[{ required: true }]} style={{ flex: 1, minWidth: 160 }}>
              <Select
                options={financialYears.map(f => ({ value: f.id, label: f.code }))}
                onChange={(val) => form.setFieldValue('window_range', fyRange(val))}
              />
            </Form.Item>
          </Space>

          <Space style={{ display: 'flex' }} align="start">
            <Form.Item name="category" label="Category" style={{ flex: 1, minWidth: 200 }}>
              <Select
                allowClear
                placeholder="Category"
                options={categories.map(c => ({
                  value: c.id,
                  label: c.name,
                  // "Action Log" is reserved for the standalone action-logs module;
                  // disable it here to avoid confusion with activity categories.
                  disabled: c.name.trim().toLowerCase() === 'action log',
                }))}
              />
            </Form.Item>
            <Form.Item name="subcategory" label="Subcategory" style={{ flex: 1, minWidth: 200 }}>
              <Select
                allowClear
                showSearch
                optionFilterProp="label"
                placeholder="Subcategory"
                options={subcategoryOptions}
              />
            </Form.Item>
          </Space>

          <Space style={{ display: 'flex' }} align="start">
            <Form.Item name="lead" label="Lead" style={{ flex: 1, minWidth: 200 }}>
              <Select
                allowClear
                showSearch
                optionFilterProp="label"
                placeholder="Responsible person"
                options={users.map(u => ({ value: u.id, label: `${u.first_name} ${u.last_name}` }))}
              />
            </Form.Item>
            <Form.Item name="default_assignees" label="Assignees" style={{ flex: 1, minWidth: 200 }}>
              <Select
                mode="multiple"
                allowClear
                showSearch
                optionFilterProp="label"
                placeholder="Default assignees"
                options={users.map(u => ({ value: u.id, label: `${u.first_name} ${u.last_name}` }))}
              />
            </Form.Item>
          </Space>

          <Space style={{ display: 'flex' }} align="start">
            <Form.Item name="frequency" label="Frequency" rules={[{ required: true }]} style={{ flex: 1, minWidth: 160 }}>
              <Select
                options={(Object.keys(FREQUENCY_LABELS) as Frequency[]).map(k => ({ value: k, label: FREQUENCY_LABELS[k] }))}
                onChange={(val) => {
                  // Quarterly activities always cover the whole financial year so
                  // each of Q1–Q4 is generated.
                  if (val === 'quarterly') {
                    form.setFieldValue('window_range', fyRange(form.getFieldValue('financial_year')));
                  }
                }}
              />
            </Form.Item>
            {watchedFrequency === 'weekly' && (
              <Form.Item name="weekday" label="Day of week" style={{ flex: 1, minWidth: 160 }}>
                <Select allowClear placeholder="Defaults to start day" options={WEEKDAYS} />
              </Form.Item>
            )}
            <Form.Item name="lifecycle" label="Status" style={{ flex: 1, minWidth: 160 }}>
              <Select options={(Object.keys(LIFECYCLE_LABELS) as Array<keyof typeof LIFECYCLE_LABELS>).map(k => ({ value: k, label: LIFECYCLE_LABELS[k] }))} />
            </Form.Item>
          </Space>

          {watchedFrequency === 'one_off' ? (
            <Form.Item name="single_date" label="Date" rules={[{ required: true, message: 'Pick the date' }]}>
              <DatePicker style={{ width: '100%' }} format="Do MMM" />
            </Form.Item>
          ) : watchedFrequency === 'quarterly' ? (
            <Form.Item
              name="window_range"
              label="Active period"
              tooltip="Quarterly activities always span the whole financial year, generating one occurrence per quarter (Q1–Q4)."
              rules={[{ required: true, message: 'Select the active period' }]}
              extra={
                <div style={{ fontSize: 12, color: '#888', marginTop: 6 }}>
                  Spans the full financial year — Q1 Jul–Sep, Q2 Oct–Dec, Q3 Jan–Mar, Q4 Apr–Jun.
                </div>
              }
            >
              <DatePicker.RangePicker style={{ width: '100%' }} format="Do MMM" disabled />
            </Form.Item>
          ) : (
            <Form.Item
              name="window_range"
              label="Active period"
              tooltip="The span over which occurrences are generated, e.g. 3rd Jun → 7th Aug. Defaults to the whole financial year; narrow it to a specific range if needed."
              rules={[{ required: true, message: 'Select the active period' }]}
              extra={
                <Space size={6} style={{ marginTop: 6 }} wrap>
                  <span style={{ fontSize: 12, color: '#888' }}>Quick set:</span>
                  <Select
                    size="small"
                    allowClear
                    placeholder="Part"
                    value={quickPart}
                    style={{ width: 100 }}
                    onChange={(p) => { setQuickPart(p); applyQuickPeriod(p, quickMonth); }}
                    options={['Early', 'Mid', 'Late'].map(p => ({ value: p, label: p }))}
                  />
                  <Select
                    size="small"
                    allowClear
                    placeholder="Month"
                    value={quickMonth}
                    style={{ width: 130 }}
                    onChange={(m) => { setQuickMonth(m); applyQuickPeriod(quickPart, m); }}
                    options={monthOptions}
                  />
                </Space>
              }
            >
              <DatePicker.RangePicker style={{ width: '100%' }} format="Do MMM" />
            </Form.Item>
          )}

          {watchedFrequency === 'monthly' && (
            <Form.Item
              label="Monthly recurrence"
              tooltip="Choose which day each month an occurrence lands on."
              style={{ marginBottom: 8 }}
            >
              <Form.Item name="monthly_mode" noStyle>
                <Radio.Group>
                  <Radio value="day_of_month">Specific day of month</Radio>
                  <Radio value="active_period">Use the active period's start day</Radio>
                </Radio.Group>
              </Form.Item>
              {watchedMonthlyMode !== 'active_period' && (
                <Form.Item name="day_of_month" style={{ marginTop: 8, marginBottom: 0, maxWidth: 200 }}>
                  <InputNumber min={1} max={28} style={{ width: '100%' }} placeholder="Day 1–28" />
                </Form.Item>
              )}
            </Form.Item>
          )}

          <Form.Item name="description" label="Description">
            <TextArea rows={2} placeholder="Optional description applied to each occurrence" />
          </Form.Item>
          <Form.Item name="notes" label="Notes">
            <TextArea rows={2} placeholder="Internal notes about this activity" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={selectedSchedule?.title || 'Activity details'}
        open={detailsOpen}
        onCancel={() => setDetailsOpen(false)}
        footer={[
          canManage && selectedSchedule && (
            <Button
              key="edit"
              icon={<EditOutlined />}
              onClick={() => { const s = selectedSchedule; setDetailsOpen(false); openEdit(s); }}
            >
              Edit
            </Button>
          ),
          <Button key="close" onClick={() => setDetailsOpen(false)}>Close</Button>,
        ]}
        width={720}
        destroyOnClose
      >
        {selectedSchedule && (() => {
          const sch = selectedSchedule;
          const health = scheduleHealthOf(sch);
          const meta = health ? HEALTH_META[health] : null;
          const assigneeTags = Array.isArray(sch.default_assignees)
            ? sch.default_assignees
                .filter((id: number) => id !== sch.lead)
                .map((id: number) => ({ id, name: userName.get(id) || `User #${id}` }))
            : [];
          const occ = (occBySchedule.get(sch.id) || [])
            .slice()
            .sort((a, b) => (a.occurrence_index || 0) - (b.occurrence_index || 0));
          return (
            <>
              <Descriptions column={2} size="small" bordered>
                <Descriptions.Item label="Reference">
                  <span style={{ fontFamily: 'monospace' }}>{sch.reference_code || '—'}</span>
                </Descriptions.Item>
                <Descriptions.Item label="Schedule">
                  {meta
                    ? <Tag color={meta.color} style={{ fontWeight: 600 }}>{meta.label}</Tag>
                    : '—'}
                </Descriptions.Item>
                <Descriptions.Item label="Category">{sch.category_name || '—'}</Descriptions.Item>
                <Descriptions.Item label="Subcategory">{sch.subcategory_name || '—'}</Descriptions.Item>
                <Descriptions.Item label="Frequency">{FREQUENCY_LABELS[sch.frequency] || '—'}</Descriptions.Item>
                <Descriptions.Item label="Pattern">{patternLabel(sch)}</Descriptions.Item>
                <Descriptions.Item label="Status">{LIFECYCLE_LABELS[sch.lifecycle]}</Descriptions.Item>
                <Descriptions.Item label="Financial Year">{sch.financial_year_code || '—'}</Descriptions.Item>
                <Descriptions.Item label="Lead">
                  {sch.lead
                    ? <Tag color="gold" style={{ fontWeight: 600, display: 'inline-flex', alignItems: 'flex-start', whiteSpace: 'normal' }}>
                        <CrownOutlined style={{ marginRight: 4, marginTop: 4, flexShrink: 0 }} />
                        <span style={{ wordBreak: 'break-word' }}>{userName.get(sch.lead) || `User #${sch.lead}`}</span>
                      </Tag>
                    : '—'}
                </Descriptions.Item>
                <Descriptions.Item label="Occurrences">{occ.length}</Descriptions.Item>
                <Descriptions.Item label="Quarters" span={2}>
                  {(() => {
                    const span = quarterSpan(sch);
                    if (!span) return '—';
                    return span.from === span.to
                      ? <Tag>Q{span.from}</Tag>
                      : <Tag color="purple" icon={<SwapRightOutlined />} style={{ fontWeight: 600 }}>
                          Spans Q{span.from}–Q{span.to}
                        </Tag>;
                  })()}
                </Descriptions.Item>
                <Descriptions.Item label="Active period" span={2}>
                  {sch.window_start && sch.window_end ? (
                    <Space size={8} wrap>
                      {fuzzyPeriod(sch.window_start, sch.window_end) && (
                        <span style={{ fontWeight: 500 }}>{fuzzyPeriod(sch.window_start, sch.window_end)}</span>
                      )}
                      <span style={{ color: '#888' }}>
                        {dateSup(sch.window_start)} → {dateSup(sch.window_end)}
                      </span>
                    </Space>
                  ) : '—'}
                </Descriptions.Item>
                <Descriptions.Item label="Assignees" span={2}>
                  {assigneeTags.length
                    ? <Space size={[4, 4]} wrap>
                        {assigneeTags.map((a) => (
                          <Tag key={a.id} color="blue" icon={<TeamOutlined />}>{a.name}</Tag>
                        ))}
                      </Space>
                    : '—'}
                </Descriptions.Item>
              </Descriptions>

              <Divider orientation="left" style={{ marginTop: 16 }}>Description</Divider>
              <div style={{ whiteSpace: 'pre-wrap' }}>{sch.description?.trim() || 'No description.'}</div>

              <Divider orientation="left">Notes</Divider>
              <div style={{ whiteSpace: 'pre-wrap' }}>{sch.notes?.trim() || 'No notes.'}</div>

              <Divider orientation="left">Timeline</Divider>
              {occ.length ? (
                <Timeline
                  items={occ.map((o) => {
                    const h = (o.schedule_health || 'on_track') as ScheduleHealth;
                    const dotColor = h === 'overdue' ? 'red' : h === 'completed' ? 'blue' : 'green';
                    return {
                      key: o.id,
                      color: dotColor,
                      children: (
                        <div>
                          <Space size={8} wrap>
                            <span style={{ fontWeight: 600 }}>{windowNode(o)}</span>
                            <Tag color={HEALTH_META[h].color}>{HEALTH_META[h].label}</Tag>
                            {o.quarter ? <Tag>{`Q${o.quarter}`}</Tag> : null}
                          </Space>
                          <div style={{ fontFamily: 'monospace', fontSize: 12, color: '#888' }}>
                            {o.reference_code || '—'}
                          </div>
                        </div>
                      ),
                    };
                  })}
                />
              ) : (
                <div style={{ color: '#888' }}>No occurrences to chart on a timeline.</div>
              )}

              <Divider orientation="left">Occurrences ({occ.length})</Divider>
              {occ.length ? (
                <Table<ActionLog>
                  rowKey="id"
                  size="small"
                  pagination={false}
                  dataSource={occ}
                  columns={[
                    {
                      title: '#',
                      key: 'idx',
                      width: 50,
                      render: (_: any, o) => o.occurrence_index ?? '—',
                    },
                    {
                      title: 'Reference',
                      dataIndex: 'reference_code',
                      key: 'reference_code',
                      render: (code: string) => <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{code || '—'}</span>,
                    },
                    {
                      title: 'Window',
                      key: 'window',
                      render: (_: any, o) => windowNode(o),
                    },
                    {
                      title: 'Quarter',
                      key: 'quarter',
                      width: 80,
                      render: (_: any, o) => (o.quarter ? `Q${o.quarter}` : '—'),
                    },
                    {
                      title: 'Schedule',
                      key: 'health',
                      width: 110,
                      render: (_: any, o) => {
                        const h = (o.schedule_health || 'on_track') as ScheduleHealth;
                        return <Tag color={HEALTH_META[h].color}>{HEALTH_META[h].label}</Tag>;
                      },
                    },
                  ]}
                />
              ) : (
                <div style={{ color: '#888' }}>No occurrences generated for this period.</div>
              )}
            </>
          );
        })()}
      </Modal>
    </Card>
  );
};

export default ActivitiesCalendar;
