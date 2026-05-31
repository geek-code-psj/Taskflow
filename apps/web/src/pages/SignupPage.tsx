import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { SignupSchema, SignupInput } from '@taskflow/validators';
import { useAuth } from '../contexts/AuthContext';
import { getErrorMessage } from '../lib/utils';
import { toast } from 'sonner';
import { Loader2, Zap } from 'lucide-react';

export default function SignupPage() {
  const { signup } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<SignupInput>({
    resolver: zodResolver(SignupSchema),
  });

  const onSubmit = async (data: SignupInput) => {
    setLoading(true);
    try {
      await signup(data.username, data.email, data.password);
      navigate('/dashboard');
      toast.success('Welcome to TaskFlow!');
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface-0 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-[linear-gradient(rgba(97,114,243,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(97,114,243,0.03)_1px,transparent_1px)] bg-[size:64px_64px]" />
      <div className="absolute top-0 right-1/3 w-96 h-96 bg-brand-500/5 rounded-full blur-3xl" />

      <div className="relative w-full max-w-sm animate-fade-in">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-brand-500/10 border border-brand-500/20 mb-4">
            <Zap className="w-6 h-6 text-brand-400" />
          </div>
          <h1 className="font-display text-2xl font-bold text-text-primary">Create Account</h1>
          <p className="text-text-secondary text-sm mt-1">Start managing tasks with your team</p>
        </div>

        <div className="card p-6">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="label">Username</label>
              <input {...register('username')} className="input" placeholder="your_username" />
              {errors.username && <p className="text-red-400 text-xs mt-1">{errors.username.message}</p>}
            </div>
            <div>
              <label className="label">Email</label>
              <input {...register('email')} type="email" className="input" placeholder="you@company.com" />
              {errors.email && <p className="text-red-400 text-xs mt-1">{errors.email.message}</p>}
            </div>
            <div>
              <label className="label">Password</label>
              <input {...register('password')} type="password" className="input" placeholder="Min 8 chars, 1 uppercase, 1 number" />
              {errors.password && <p className="text-red-400 text-xs mt-1">{errors.password.message}</p>}
            </div>
            <button type="submit" className="btn-primary w-full flex items-center justify-center gap-2 mt-2">
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {loading ? 'Creating account...' : 'Create Account'}
            </button>
          </form>
          <div className="mt-4 pt-4 border-t border-white/[0.06] text-center">
            <p className="text-text-muted text-sm">
              Already have an account?{' '}
              <Link to="/login" className="text-brand-400 hover:text-brand-300 transition-colors">Sign in</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
