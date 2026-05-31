import { useQuery } from '@tanstack/react-query';
import api from '../lib/api';
import { DashboardStats, Task } from '@taskflow/types';
import { statusConfig, priorityConfig, formatDate, cn } from '../lib/utils';
import {
  BarChart, Bar, PieChart, Pie, Cell, ResponsiveContainer,
  XAxis, YAxis, Tooltip, Legend,
} from 'recharts';
import { AlertTriangle, CheckCircle2, Clock, FolderOpen, ListTodo, TrendingUp } from 'lucide-react';

const STATUS_COLORS = { todo: '#64748b', in_progress: '#3b82f6', done: '#22c55e' };
const PRIORITY_COLORS = { low: '#64748b', medium: '#f59e0b', high: '#ef4444' };

const StatCard = ({ label, value, icon: Icon, color }: {
  label: string; value: number | string; icon: any; color: string;
}) => (
  <div className="card p-5">
    <div className="flex items-start justify-between mb-3">
      <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center', color)}>
        <Icon className="w-4.5 h-4.5" />
      </div>
    </div>
    <div className="text-2xl font-display font-bold text-text-primary">{value}</div>
    <div className="text-xs text-text-secondary mt-0.5">{label}</div>
  </div>
);

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-surface-3 border border-white/10 rounded-lg p-3 text-xs shadow-xl">
      {label && <div className="text-text-secondary mb-2">{label}</div>}
      {payload.map((p: any) => (
        <div key={p.name} className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span className="text-text-secondary capitalize">{p.name}:</span>
          <span className="text-text-primary font-medium">{p.value}</span>
        </div>
      ))}
    </div>
  );
};

export default function DashboardPage() {
  const { data, isLoading } = useQuery<DashboardStats>({
    queryKey: ['dashboard'],
    queryFn: () => api.get('/dashboard').then((r) => r.data.data),
    refetchInterval: 30_000,
  });

  if (isLoading) {
    return (
      <div className="flex-1 p-8">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="card p-5 h-28 animate-pulse bg-surface-3" />
          ))}
        </div>
      </div>
    );
  }

  if (!data) return null;

  const pieStatusData = data.tasks_by_status.map((t) => ({
    name: t.status.replace('_', ' '),
    value: t.count,
    color: STATUS_COLORS[t.status] ?? '#64748b',
  }));

  return (
    <div className="flex-1 p-6 overflow-y-auto animate-fade-in">
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold text-text-primary">Dashboard</h1>
        <p className="text-text-secondary text-sm mt-0.5">Overview of your team's progress</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="Total Projects" value={data.total_projects} icon={FolderOpen}
          color="bg-brand-500/10 text-brand-400" />
        <StatCard label="Total Tasks" value={data.total_tasks} icon={ListTodo}
          color="bg-blue-500/10 text-blue-400" />
        <StatCard label="Overdue Tasks" value={data.overdue_tasks} icon={AlertTriangle}
          color={data.overdue_tasks > 0 ? 'bg-red-500/10 text-red-400' : 'bg-green-500/10 text-green-400'} />
        <StatCard label="Completion Rate" value={`${data.completion_rate}%`} icon={TrendingUp}
          color="bg-green-500/10 text-green-400" />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        {/* Status donut */}
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-text-primary mb-4">Task Status</h3>
          <div className="flex items-center gap-4">
            <ResponsiveContainer width={120} height={120}>
              <PieChart>
                <Pie data={pieStatusData} cx={55} cy={55} innerRadius={35} outerRadius={55}
                  dataKey="value" paddingAngle={3}>
                  {pieStatusData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
            <div className="space-y-2 flex-1">
              {pieStatusData.map((d) => (
                <div key={d.name} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full" style={{ background: d.color }} />
                    <span className="text-text-secondary capitalize">{d.name}</span>
                  </div>
                  <span className="font-medium text-text-primary">{d.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Priority distribution */}
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-text-primary mb-4">Priority Split</h3>
          <ResponsiveContainer width="100%" height={130}>
            <BarChart data={data.tasks_by_priority.map((t) => ({
              name: t.priority,
              value: t.count,
              fill: PRIORITY_COLORS[t.priority] ?? '#64748b',
            }))}>
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#8b93a5' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#8b93a5' }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                {data.tasks_by_priority.map((t, i) => (
                  <Cell key={i} fill={PRIORITY_COLORS[t.priority] ?? '#64748b'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Weekly velocity */}
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-text-primary mb-4">Weekly Velocity</h3>
          <ResponsiveContainer width="100%" height={130}>
            <BarChart data={data.weekly_velocity}>
              <XAxis dataKey="week" tick={{ fontSize: 10, fill: '#8b93a5' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: '#8b93a5' }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="assigned" fill="#3d41d0" radius={[2, 2, 0, 0]} name="assigned" />
              <Bar dataKey="completed" fill="#22c55e" radius={[2, 2, 0, 0]} name="completed" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Bottom tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Recent tasks */}
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-text-primary mb-4 flex items-center gap-2">
            <Clock className="w-4 h-4 text-text-muted" /> Recent Tasks
          </h3>
          <div className="space-y-2">
            {data.recent_tasks.length === 0 && (
              <p className="text-text-muted text-sm">No tasks yet</p>
            )}
            {data.recent_tasks.map((task: any) => (
              <div key={task.id} className="flex items-center justify-between py-2 border-b border-white/[0.04] last:border-0">
                <div className="flex-1 min-w-0 mr-3">
                  <p className="text-sm text-text-primary truncate">{task.title}</p>
                  <p className="text-xs text-text-muted">{task.project_name}</p>
                </div>
                <span className={cn('badge border', statusConfig[task.status as keyof typeof statusConfig]?.color)}>
                  {statusConfig[task.status as keyof typeof statusConfig]?.label}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Overdue tasks */}
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-text-primary mb-4 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-400" />
            <span>Overdue Tasks</span>
            {data.overdue_tasks > 0 && (
              <span className="ml-auto badge bg-red-500/10 text-red-400 border border-red-500/20">
                {data.overdue_tasks}
              </span>
            )}
          </h3>
          {data.overdue_task_list.length === 0 ? (
            <div className="flex items-center gap-2 text-green-400 text-sm">
              <CheckCircle2 className="w-4 h-4" />
              <span>No overdue tasks!</span>
            </div>
          ) : (
            <div className="space-y-2">
              {data.overdue_task_list.map((task: any) => (
                <div key={task.id} className="flex items-center justify-between py-2 border-b border-white/[0.04] last:border-0">
                  <div className="flex-1 min-w-0 mr-3">
                    <p className="text-sm text-text-primary truncate">{task.title}</p>
                    <p className="text-xs text-red-400">{formatDate(task.due_date)} · {task.project_name}</p>
                  </div>
                  <span className={cn('badge border', priorityConfig[task.priority as keyof typeof priorityConfig]?.color)}>
                    {task.priority}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
