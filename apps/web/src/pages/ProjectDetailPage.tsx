import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { CreateTaskSchema, CreateTaskInput, AddMemberSchema, AddMemberInput } from '@taskflow/validators';
import api from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { Task, ProjectMember } from '@taskflow/types';
import { statusConfig, priorityConfig, formatDate, isOverdue, cn, getErrorMessage } from '../lib/utils';
import { toast } from 'sonner';
import {
  Plus, X, Loader2, AlertTriangle, Trash2, ArrowLeft,
  Users, ListTodo, CheckSquare, ChevronDown, UserPlus,
} from 'lucide-react';

// ── Task Card ─────────────────────────────────────────────────
function TaskCard({ task, projectId, userRole }: { task: Task; projectId: string; userRole: string }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const overdue = isOverdue(task.due_date, task.status);

  const updateStatus = useMutation({
    mutationFn: (status: string) =>
      api.patch(`/projects/${projectId}/tasks/${task.id}`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks', projectId] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const deleteTask = useMutation({
    mutationFn: () => api.delete(`/projects/${projectId}/tasks/${task.id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks', projectId] });
      toast.success('Task deleted');
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const isAdmin = userRole === 'admin' || user?.global_role === 'admin';
  const canChangeStatus = isAdmin || task.assigned_to === user?.id;

  return (
    <div className={cn(
      'card p-4 hover:border-white/[0.12] transition-all duration-200',
      overdue && 'border-red-500/20'
    )}>
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={cn('badge border', priorityConfig[task.priority]?.color)}>
              {priorityConfig[task.priority]?.label}
            </span>
            {overdue && (
              <span className="badge bg-red-500/10 text-red-400 border border-red-500/20">
                <AlertTriangle className="w-3 h-3" /> Overdue
              </span>
            )}
          </div>
          <h4 className="text-sm font-medium text-text-primary">{task.title}</h4>
          {task.description && (
            <p className="text-xs text-text-muted mt-0.5 line-clamp-2">{task.description}</p>
          )}
          <div className="flex items-center gap-3 mt-2">
            {task.assignee && (
              <span className="text-xs text-text-muted">
                → {(task.assignee as any).username}
              </span>
            )}
            {task.due_date && (
              <span className={cn('text-xs', overdue ? 'text-red-400' : 'text-text-muted')}>
                Due {formatDate(task.due_date)}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {canChangeStatus && (
            <select
              value={task.status}
              onChange={(e) => updateStatus.mutate(e.target.value)}
              className="text-xs bg-surface-3 border border-white/[0.08] rounded-md px-2 py-1 text-text-secondary
                         focus:outline-none focus:border-brand-500/40 cursor-pointer"
            >
              <option value="todo">To Do</option>
              <option value="in_progress">In Progress</option>
              <option value="done">Done</option>
            </select>
          )}
          {!canChangeStatus && (
            <span className={cn('badge border', statusConfig[task.status]?.color)}>
              {statusConfig[task.status]?.label}
            </span>
          )}
          {isAdmin && (
            <button
              onClick={() => deleteTask.mutate()}
              className="text-text-muted hover:text-red-400 transition-colors p-1"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Create Task Modal ─────────────────────────────────────────
function CreateTaskModal({ projectId, members, onClose }: {
  projectId: string; members: ProjectMember[]; onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const { register, handleSubmit, formState: { errors } } = useForm<CreateTaskInput>({
    resolver: zodResolver(CreateTaskSchema),
  });

  const { mutate, isPending } = useMutation({
    mutationFn: (data: CreateTaskInput) => api.post(`/projects/${projectId}/tasks`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks', projectId] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success('Task created');
      onClose();
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
      <div className="card w-full max-w-lg p-6 animate-slide-up">
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-display font-bold text-lg">New Task</h2>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit((d) => mutate(d))} className="space-y-4">
          <div>
            <label className="label">Title *</label>
            <input {...register('title')} className="input" placeholder="What needs to be done?" autoFocus />
            {errors.title && <p className="text-red-400 text-xs mt-1">{errors.title.message}</p>}
          </div>
          <div>
            <label className="label">Description</label>
            <textarea {...register('description')} className="input min-h-[72px] resize-none" placeholder="Optional details..." />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Priority</label>
              <select {...register('priority')} className="input">
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
            <div>
              <label className="label">Status</label>
              <select {...register('status')} className="input">
                <option value="todo">To Do</option>
                <option value="in_progress">In Progress</option>
                <option value="done">Done</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Assign To</label>
              <select {...register('assigned_to')} className="input">
                <option value="">Unassigned</option>
                {members.map((m) => (
                  <option key={m.user_id} value={m.user_id}>
                    {m.user?.username || 'Unknown User'}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Due Date</label>
              <input {...register('due_date')} type="datetime-local" className="input" />
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" className="btn-primary flex-1 flex items-center justify-center gap-2">
              {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              Create Task
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Add Member Modal ──────────────────────────────────────────
function AddMemberModal({ projectId, onClose }: { projectId: string; onClose: () => void }) {
  const queryClient = useQueryClient();
  const { register, handleSubmit, formState: { errors } } = useForm<AddMemberInput>({
    resolver: zodResolver(AddMemberSchema),
  });

  const { mutate, isPending } = useMutation({
    mutationFn: (data: AddMemberInput) => api.post(`/projects/${projectId}/members`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['members', projectId] });
      toast.success('Member added');
      onClose();
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
      <div className="card w-full max-w-sm p-6 animate-slide-up">
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-display font-bold text-lg">Add Member</h2>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit((d) => mutate(d))} className="space-y-4">
          <div>
            <label className="label">Email Address *</label>
            <input {...register('email')} type="email" className="input" placeholder="colleague@company.com" autoFocus />
            {errors.email && <p className="text-red-400 text-xs mt-1">{errors.email.message}</p>}
          </div>
          <div>
            <label className="label">Role</label>
            <select {...register('role')} className="input">
              <option value="member">Member</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" className="btn-primary flex-1 flex items-center justify-center gap-2">
              {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              Add Member
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────
export default function ProjectDetailPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [tab, setTab] = useState<'tasks' | 'members'>('tasks');
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [showMemberModal, setShowMemberModal] = useState(false);
  const [filter, setFilter] = useState<string>('');

  const { data: project, isLoading: projectLoading } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => api.get(`/projects/${projectId!}`).then((r) => r.data.data),
    enabled: !!projectId,
  });

  const { data: tasksData, isLoading: tasksLoading } = useQuery({
    queryKey: ['tasks', projectId, filter],
    queryFn: () =>
      api.get(`/projects/${projectId!}/tasks`, { params: filter ? { status: filter } : {} })
        .then((r) => r.data),
    enabled: !!projectId,
  });

  const { data: membersData } = useQuery({
    queryKey: ['members', projectId],
    queryFn: () => api.get(`/projects/${projectId!}/members`).then((r) => r.data.data),
    enabled: !!projectId,
  });

  const queryClient = useQueryClient();

  const removeMember = useMutation({
    mutationFn: (userId: string) => api.delete(`/projects/${projectId}/members/${userId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['members', projectId] });
      toast.success('Member removed');
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const deleteProject = useMutation({
    mutationFn: () => api.delete(`/projects/${projectId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      navigate('/projects');
      toast.success('Project deleted');
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  if (projectLoading) return (
    <div className="flex-1 p-6">
      <div className="card h-40 animate-pulse bg-surface-3 mb-4" />
    </div>
  );

  const tasks: Task[] = tasksData?.data ?? [];
  const members: ProjectMember[] = membersData ?? [];
  const userMembership = members.find((m) => m.user_id === user?.id);
  const userRole = user?.global_role === 'admin' ? 'admin' : (userMembership?.role ?? 'member');
  const isAdmin = userRole === 'admin';

  return (
    <div className="flex-1 p-6 overflow-y-auto animate-fade-in">
      {/* Header */}
      <div className="flex items-start gap-4 mb-6">
        <button onClick={() => navigate('/projects')}
          className="mt-1 p-1.5 rounded-lg hover:bg-surface-3 text-text-muted hover:text-text-primary transition-all">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="flex-1">
          <h1 className="font-display text-2xl font-bold text-text-primary">{project?.name}</h1>
          {project?.description && (
            <p className="text-text-secondary text-sm mt-0.5">{project.description}</p>
          )}
        </div>
        {isAdmin && (
          <button onClick={() => deleteProject.mutate()}
            className="btn-danger flex items-center gap-2 text-sm">
            <Trash2 className="w-3.5 h-3.5" /> Delete
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 mb-6 p-1 bg-surface-2 rounded-lg w-fit">
        {[
          { id: 'tasks', label: 'Tasks', icon: ListTodo, count: tasksData?.total },
          { id: 'members', label: 'Members', icon: Users, count: members.length },
        ].map(({ id, label, icon: Icon, count }) => (
          <button
            key={id}
            onClick={() => setTab(id as any)}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all',
              tab === id
                ? 'bg-surface-4 text-text-primary shadow-sm'
                : 'text-text-secondary hover:text-text-primary'
            )}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
            {count !== undefined && (
              <span className="text-xs bg-surface-0 text-text-muted px-1.5 py-0.5 rounded-full">{count}</span>
            )}
          </button>
        ))}
      </div>

      {/* Tasks tab */}
      {tab === 'tasks' && (
        <div>
          <div className="flex items-center gap-3 mb-4">
            <div className="flex items-center gap-1 p-1 bg-surface-2 rounded-lg">
              {['', 'todo', 'in_progress', 'done'].map((s) => (
                <button
                  key={s}
                  onClick={() => setFilter(s)}
                  className={cn(
                    'px-3 py-1.5 rounded-md text-xs font-medium transition-all',
                    filter === s ? 'bg-surface-4 text-text-primary' : 'text-text-secondary hover:text-text-primary'
                  )}
                >
                  {s === '' ? 'All' : statusConfig[s as keyof typeof statusConfig]?.label}
                </button>
              ))}
            </div>
            {isAdmin && (
              <button onClick={() => setShowTaskModal(true)} className="btn-primary ml-auto flex items-center gap-2 text-sm">
                <Plus className="w-4 h-4" /> New Task
              </button>
            )}
          </div>

          {tasksLoading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => <div key={i} className="card h-20 animate-pulse bg-surface-3" />)}
            </div>
          ) : tasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <CheckSquare className="w-8 h-8 text-text-muted mb-3" />
              <p className="text-text-primary font-medium">No tasks {filter ? `with status "${filter}"` : 'yet'}</p>
              {isAdmin && (
                <button onClick={() => setShowTaskModal(true)} className="btn-primary mt-3 flex items-center gap-2 text-sm">
                  <Plus className="w-4 h-4" /> Create Task
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {tasks.map((task) => (
                <TaskCard key={task.id} task={task} projectId={projectId!} userRole={userRole} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Members tab */}
      {tab === 'members' && (
        <div>
          {isAdmin && (
            <div className="flex justify-end mb-4">
              <button onClick={() => setShowMemberModal(true)} className="btn-primary flex items-center gap-2 text-sm">
                <UserPlus className="w-4 h-4" /> Add Member
              </button>
            </div>
          )}
          <div className="space-y-2">
            {members.map((member: any) => (
              <div key={member.user_id} className="card p-4 flex items-center gap-4">
                <div className="w-9 h-9 rounded-full bg-brand-500/10 border border-brand-500/20 flex items-center justify-center">
                  <span className="text-sm font-bold text-brand-400">{member.username?.[0]?.toUpperCase()}</span>
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-text-primary">{member.username}</p>
                  <p className="text-xs text-text-muted">{member.email}</p>
                </div>
                <span className={cn(
                  'badge border',
                  member.role === 'admin'
                    ? 'bg-brand-500/10 text-brand-400 border-brand-500/20'
                    : 'bg-surface-3 text-text-secondary border-white/[0.08]'
                )}>
                  {member.role}
                </span>
                {isAdmin && member.user_id !== user?.id && (
                  <button
                    onClick={() => removeMember.mutate(member.user_id)}
                    className="text-text-muted hover:text-red-400 transition-colors p-1"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {showTaskModal && (
        <CreateTaskModal projectId={projectId!} members={members} onClose={() => setShowTaskModal(false)} />
      )}
      {showMemberModal && (
        <AddMemberModal projectId={projectId!} onClose={() => setShowMemberModal(false)} />
      )}
    </div>
  );
}
