import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Eye, EyeOff, Mail, Lock, CheckCircle2, GraduationCap, BookOpen, Building2, Heart, ArrowLeft } from 'lucide-react';
import { loginSchema, type LoginFormData } from '../../validators/auth.validators';
import { useLogin } from '../../hooks/use-auth';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';

const ROLE_TILES = [
  { label: 'Student',   path: '/register/student',   Icon: GraduationCap, color: 'bg-indigo-50 text-indigo-600' },
  { label: 'Tutor',     path: '/register/tutor',     Icon: BookOpen,      color: 'bg-violet-50 text-violet-600' },
  { label: 'Principal', path: '/register/principal', Icon: Building2,     color: 'bg-teal-50 text-teal-600' },
  { label: 'Parent',    path: '/register/parent',    Icon: Heart,         color: 'bg-pink-50 text-pink-600' },
];

export function LoginPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [searchParams] = useSearchParams();
  const justRegistered = searchParams.get('registered') === 'true';
  const loginMutation = useLogin();

  const { register, handleSubmit, formState: { errors } } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = (data: LoginFormData) => loginMutation.mutate(data);

  const serverError =
    loginMutation.isError && loginMutation.error instanceof Error
      ? (loginMutation.error as { response?: { data?: { message?: string } } }).response?.data?.message || 'Invalid email or password'
      : null;

  return (
    <div className="space-y-6">
      <Link
        to="/"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-indigo-600 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to home
      </Link>

      <div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">Welcome back</h1>
        <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">Sign in to your Takshashila account</p>
      </div>

      {justRegistered && (
        <div className="flex items-start gap-3 rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3">
          <CheckCircle2 className="h-5 w-5 text-emerald-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-emerald-800">Account created!</p>
            <p className="text-xs text-emerald-600 mt-0.5">Please verify your email, then sign in below.</p>
          </div>
        </div>
      )}

      {serverError && (
        <div className="rounded-xl bg-rose-50 border border-rose-200 px-4 py-3 text-sm font-medium text-rose-700">
          {serverError}
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Input
          label="Email or Student ID"
          type="text"
          placeholder="you@example.com or stujs1234"
          leftIcon={<Mail className="h-4 w-4" />}
          error={errors.identifier?.message}
          {...register('identifier')}
        />

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300">Password</label>
            <Link to="/forgot-password" className="text-xs font-medium text-indigo-600 hover:text-indigo-700">
              Forgot password?
            </Link>
          </div>
          <Input
            type={showPassword ? 'text' : 'password'}
            placeholder="Enter your password"
            leftIcon={<Lock className="h-4 w-4" />}
            rightIcon={
              <button type="button" onClick={() => setShowPassword((p) => !p)} className="text-slate-400 hover:text-slate-600">
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            }
            error={errors.password?.message}
            {...register('password')}
          />
        </div>

        <Button type="submit" fullWidth loading={loginMutation.isPending} size="lg" className="mt-2">
          Sign in
        </Button>
      </form>

      <div className="relative">
        <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-200" /></div>
        <div className="relative flex justify-center">
          <span className="bg-white dark:bg-slate-900 px-3 text-xs text-slate-400">Don&apos;t have an account?</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {ROLE_TILES.map(({ label, path, Icon, color }) => (
          <Link
            key={label}
            to={path}
            className="group flex flex-col items-center gap-2 rounded-xl border border-slate-200 bg-white px-2 py-3 text-center transition-all hover:border-indigo-300 hover:shadow-sm"
          >
            <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${color}`}>
              <Icon className="h-4 w-4" />
            </div>
            <span className="text-[11px] font-semibold text-slate-600">Join as {label}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
