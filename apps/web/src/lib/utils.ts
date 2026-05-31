import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { formatDistanceToNow, format, isPast } from 'date-fns';
import { TaskStatus, TaskPriority } from '@taskflow/types';

export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs));

export const formatDate = (date: string | null) =>
  date ? format(new Date(date), 'MMM d, yyyy') : '—';

export const formatRelative = (date: string) =>
  formatDistanceToNow(new Date(date), { addSuffix: true });

export const isOverdue = (date: string | null, status: TaskStatus) =>
  !!date && isPast(new Date(date)) && status !== 'done';

export const statusConfig: Record<TaskStatus, { label: string; color: string; dot: string }> = {
  todo: { label: 'To Do', color: 'bg-slate-500/15 text-slate-400 border-slate-500/20', dot: 'bg-slate-400' },
  in_progress: { label: 'In Progress', color: 'bg-blue-500/15 text-blue-400 border-blue-500/20', dot: 'bg-blue-400' },
  done: { label: 'Done', color: 'bg-green-500/15 text-green-400 border-green-500/20', dot: 'bg-green-400' },
};

export const priorityConfig: Record<TaskPriority, { label: string; color: string; dot: string }> = {
  low: { label: 'Low', color: 'bg-slate-500/15 text-slate-400 border-slate-500/20', dot: 'bg-slate-400' },
  medium: { label: 'Medium', color: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/20', dot: 'bg-yellow-400' },
  high: { label: 'High', color: 'bg-red-500/15 text-red-400 border-red-500/20', dot: 'bg-red-400' },
};

export const getErrorMessage = (error: any): string => {
  if (error?.response?.data?.error) return error.response.data.error;
  if (error?.message) return error.message;
  return 'An unexpected error occurred';
};
