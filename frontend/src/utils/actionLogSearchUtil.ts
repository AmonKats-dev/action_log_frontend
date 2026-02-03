import { ActionLog } from '../types/actionLog';
import { User } from '../types/user';
import { format, parseISO, isValid } from 'date-fns';

/**
 * Returns true if the action log matches the search text in any searchable column.
 * Searches: title, description, status, priority, department name, created_by name/email,
 * due_date, entry_date, rejection_reason, current_update, and (if users provided) assigned user names.
 */
export function actionLogMatchesSearch(
  log: ActionLog,
  searchLower: string,
  options?: { users?: User[] }
): boolean {
  if (!searchLower.trim()) return true;

  const safe = (v: unknown): string =>
    v != null && typeof v === 'string' ? v.toLowerCase() : '';

  const dateStr = (v: string | null | undefined): string => {
    if (!v) return '';
    try {
      const d = typeof v === 'string' ? parseISO(v) : v;
      return isValid(d) ? format(d, 'yyyy-MM-dd') : '';
    } catch {
      return String(v).toLowerCase();
    }
  };

  const title = safe(log.title);
  const description = safe(log.description);
  const status = safe(log.status);
  const priority = safe(log.priority);
  const deptName = safe(log.department?.name ?? (log as any).department_name);
  const createdBy = log.created_by
    ? [log.created_by.first_name, log.created_by.last_name, log.created_by.email].map(safe).join(' ')
    : '';
  const dueDate = dateStr(log.due_date ?? null);
  const entryDate = dateStr(log.entry_date ?? null);
  const rejectionReason = safe(log.rejection_reason);
  const currentUpdate = safe(log.current_update);

  const assignedNames =
    options?.users && Array.isArray(log.assigned_to)
      ? log.assigned_to
          .map(id => {
            const u = options.users!.find(us => us.id === id || String(us.id) === String(id));
            return u ? `${safe(u.first_name)} ${safe(u.last_name)} ${safe(u.email)}` : '';
          })
          .join(' ')
      : '';

  const searchable = [
    title,
    description,
    status,
    priority,
    deptName,
    createdBy,
    dueDate,
    entryDate,
    rejectionReason,
    currentUpdate,
    assignedNames,
  ].join(' ');

  return searchable.includes(searchLower);
}
