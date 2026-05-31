import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { LoginSchema, LoginInput } from '@taskflow/validators';
import { useAuth } from '../contexts/AuthContext';
import { getErrorMessage } from '../lib/utils';
import { toast } from 'sonner';
import { Loader2, Zap } from 'lucide-react';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<LoginInput>({
    resolver: zodResolver(LoginSchema),
  });

  const onSubmit = async (data: LoginInput) => {
    setLoading(true);
    try {
      await login(data.email, data.password);
      navigate('/dashboard');
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface-0 flex items-center justify-center p-4">
      {/* Background grid */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(97,114,243,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(97,114,243,0.03)_1px,transparent_1px)] bg-[size:64px_64px]" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-96 bg-brand-500/5 rounded-full blur-3xl" />

      <div className="relative w-full max-w-sm animate-fade-in">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-brand-500/10 border border-brand-500/20 mb-4">
            <Zap className="w-6 h-6 text-brand-400" />
          </div>
          <h1 className="font-display text-2xl font-bold text-text-primary">TaskFlow</h1>
          <p className="text-text-secondary text-sm mt-1">Sign in to your workspace</p>
        </div>

        <div className="card p-6">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="label">Email</label>
              <input
                {...register('email')}
                type="email"
                className="input"
                placeholder="you@company.com"
                autoComplete="email"
              />
              {errors.email && <p className="text-red-400 text-xs mt-1">{errors.email.message}</p>}
            </div>

            <div>
              <label className="label">Password</label>
              <input
                {...register('password')}
                type="password"
                className="input"
                placeholder="••••••••"
                autoComplete="current-password"
              />
              {errors.password && <p className="text-red-400 text-xs mt-1">{errors.password.message}</p>}
            </div>

            <button type="submit" className="btn-primary w-full flex items-center justify-center gap-2 mt-2">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <div className="mt-4 pt-4 border-t border-white/[0.06] text-center">
            <p className="text-text-muted text-sm">
              No account?{' '}
              <Link to="/signup" className="text-brand-400 hover:text-brand-300 transition-colors">
                Create one free
              </Link>
            </p>
          </div>
        </div>

        {/* Demo hint */}
        <div className="mt-4 card p-3 text-center">
          <p className="text-text-muted text-xs">
            Demo: <span className="text-text-secondary font-mono">admin@taskflow.dev</span> /
            <span className="text-text-secondary font-mono"> Admin@1234</span>
          </p>
        </div>
      </div>
    </div>
  );
}
