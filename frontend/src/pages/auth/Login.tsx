import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Eye, EyeOff, Mail, Lock, CheckCircle2, GraduationCap, BookOpen, Building2, Heart, ArrowLeft } from 'lucide-react';
import { loginSchema, type LoginFormData } from '../../validators/auth.validators';
import { useLogin } from '../../hooks/use-auth';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';

const ROLE_TINTS: Record<string, string> = {
  Student:   'bg-clay-sky',
  Tutor:     'bg-clay-purple',
  Principal: 'bg-clay-mint',
  Parent:    'bg-clay-pink',
};

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
    <div className="space-y-7">
      {/* Back to home */}
      <Link
        to="/"
        className="inline-flex items-center gap-1.5 rounded-full border-2 border-clay-ink bg-white px-3 py-1.5 text-xs font-extrabold text-clay-ink hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-clay-pressed shadow-clay-sm transition-all"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to home
      </Link>

      {/* Header */}
      <div>
        <h1 className="text-4xl font-extrabold tracking-tight text-clay-ink dark:text-white">Welcome back</h1>
        <p className="mt-2 text-sm font-semibold text-clay-ink/60 dark:text-gray-400">Sign in to your Takshashila account</p>
      </div>

      {justRegistered && (
        <div className="flex items-start gap-3 rounded-2xl border-2.5 border-clay-ink bg-clay-mint px-4 py-3 shadow-clay-sm">
          <CheckCircle2 className="h-5 w-5 text-clay-green-dark flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-extrabold text-clay-ink">Account created!</p>
            <p className="text-xs font-semibold text-clay-ink/70 mt-0.5">Please check your email to verify your account, then sign in below.</p>
          </div>
        </div>
      )}

      {serverError && (
        <div className="rounded-2xl border-2.5 border-clay-ink bg-clay-coral px-4 py-3 text-sm font-extrabold text-clay-ink shadow-clay-sm">
          {serverError}
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Input
          label="Email address"
          type="email"
          placeholder="you@example.com"
          leftIcon={<Mail className="h-4 w-4" />}
          error={errors.email?.message}
          {...register('email')}
        />

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-extrabold text-clay-ink dark:text-gray-300">Password</label>
            <Link to="/forgot-password" className="text-xs font-extrabold text-clay-green-dark hover:text-clay-green">
              Forgot password?
            </Link>
          </div>
          <Input
            type={showPassword ? 'text' : 'password'}
            placeholder="Enter your password"
            leftIcon={<Lock className="h-4 w-4" />}
            rightIcon={
              <button type="button" onClick={() => setShowPassword((p) => !p)} className="text-clay-ink hover:text-clay-green-dark">
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

      {/* Divider */}
      <div className="relative">
        <div className="absolute inset-0 flex items-center"><div className="w-full border-t-2 border-dashed border-clay-ink/30" /></div>
        <div className="relative flex justify-center text-xs">
          <span className="bg-clay-bg dark:bg-gray-950 px-3 font-extrabold text-clay-ink/60">Don&apos;t have an account?</span>
        </div>
      </div>

      {/* Role links */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          { label: 'Student',   path: '/register/student',   Icon: GraduationCap },
          { label: 'Tutor',     path: '/register/tutor',     Icon: BookOpen },
          { label: 'Principal', path: '/register/principal', Icon: Building2 },
          { label: 'Parent',    path: '/register/parent',    Icon: Heart },
        ].map(({ label, path, Icon }) => (
          <Link
            key={label}
            to={path}
            className="flex flex-col items-center gap-1.5 rounded-2xl border-2.5 border-clay-ink bg-white px-3 py-3 text-center shadow-clay-sm transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-clay-pressed"
          >
            <div className={`flex h-9 w-9 items-center justify-center rounded-xl border-2 border-clay-ink ${ROLE_TINTS[label]}`}>
              <Icon className="h-4 w-4 text-clay-ink" />
            </div>
            <span className="text-[11px] font-extrabold text-clay-ink">Join as {label}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
