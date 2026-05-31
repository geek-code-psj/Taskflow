import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { CreateProjectSchema, CreateProjectInput } from '@taskflow/validators';
import api from '../lib/api';
import { Project } from '@taskflow/types';
import { formatRelative, getErrorMessage } from '../lib/utils';
import { toast } from 'sonner';
import { Plus, FolderOpen, Users, CheckSquare, Loader2, X, ArrowRight } from 'lucide-react';

function CreateProjectModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const { register, handleSubmit, formState: { errors } } = useForm<CreateProjectInput>({
    resolver: zodResolver(CreateProjectSchema),
  });

  const { mutate, isPending } = useMutation({
    mutationFn: (data: CreateProjectInput) => api.post('/projects', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success('Project created');
      onClose();
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
      <div className="card w-full max-w-md p-6 animate-slide-up">
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-display font-bold text-lg">New Project</h2>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit((d) => mutate(d))} className="space-y-4">
          <div>
            <label className="label">Project Name *</label>
            <input {...register('name')} className="input" placeholder="e.g. Marketing Campaign Q3" autoFocus />
            {errors.name && <p className="text-red-400 text-xs mt-1">{errors.name.message}</p>}
          </div>
          <div>
            <label className="label">Description</label>
            <textarea {...register('description')} className="input min-h-[80px] resize-none"
              placeholder="What's this project about?" />
            {errors.description && <p className="text-red-400 text-xs mt-1">{errors.description.message}</p>}
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" className="btn-primary flex-1 flex items-center justify-center gap-2">
              {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              Create Project
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function ProjectsPage() {
  const navigate = useNavigate();
  const [showModal, setShowModal] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: () => api.get('/projects').then((r) => r.data),
  });

  const projects: Project[] = data?.data ?? [];

  return (
    <div className="flex-1 p-6 overflow-y-auto animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-2xl font-bold text-text-primary">Projects</h1>
          <p className="text-text-secondary text-sm mt-0.5">
            {data?.total ?? 0} project{(data?.total ?? 0) !== 1 ? 's' : ''}
          </p>
        </div>
        <button onClick={() => setShowModal(true)} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" />
          New Project
        </button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="card p-5 h-40 animate-pulse bg-surface-3" />
          ))}
        </div>
      ) : projects.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-14 h-14 rounded-2xl bg-surface-2 border border-white/[0.06] flex items-center justify-center mb-4">
            <FolderOpen className="w-6 h-6 text-text-muted" />
          </div>
          <p className="text-text-primary font-medium">No projects yet</p>
          <p className="text-text-muted text-sm mt-1">Create your first project to get started</p>
          <button onClick={() => setShowModal(true)} className="btn-primary mt-4 flex items-center gap-2">
            <Plus className="w-4 h-4" /> Create Project
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((project: any) => (
            <button
              key={project.id}
              onClick={() => navigate(`/projects/${project.id}`)}
              className="card p-5 text-left hover:border-brand-500/30 hover:bg-surface-3 transition-all duration-200 group"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="w-9 h-9 rounded-lg bg-brand-500/10 border border-brand-500/20 flex items-center justify-center">
                  <FolderOpen className="w-4.5 h-4.5 text-brand-400" />
                </div>
                <ArrowRight className="w-4 h-4 text-text-muted group-hover:text-brand-400 transition-colors" />
              </div>
              <h3 className="font-semibold text-text-primary mb-1 truncate">{project.name}</h3>
              {project.description && (
                <p className="text-text-muted text-xs line-clamp-2 mb-3">{project.description}</p>
              )}
              <div className="flex items-center gap-4 mt-auto pt-3 border-t border-white/[0.05]">
                <div className="flex items-center gap-1.5 text-xs text-text-muted">
                  <Users className="w-3.5 h-3.5" />
                  <span>{project.member_count ?? 0}</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-text-muted">
                  <CheckSquare className="w-3.5 h-3.5" />
                  <span>{project.task_count ?? 0} tasks</span>
                </div>
                <span className="ml-auto text-xs text-text-muted">{formatRelative(project.created_at)}</span>
              </div>
            </button>
          ))}
        </div>
      )}

      {showModal && <CreateProjectModal onClose={() => setShowModal(false)} />}
    </div>
  );
}
