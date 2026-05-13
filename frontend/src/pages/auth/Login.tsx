import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Eye, EyeOff, Mail, Lock, CheckCircle2, GraduationCap, BookOpen, Building2, Heart } from 'lucide-react';
import { loginSchema, type LoginFormData } from '../../validators/auth.validators';
import { useLogin } from '../../hooks/use-auth';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';

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
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Welcome back</h1>
        <p className="mt-2 text-gray-500 dark:text-gray-400">Sign in to your Takshashila account</p>
      </div>

      {justRegistered && (
        <div className="flex items-start gap-3 rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 px-4 py-3">
          <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-green-800 dark:text-green-300">Account created!</p>
            <p className="text-xs text-green-600 dark:text-green-400 mt-0.5">Please check your email to verify your account, then sign in below.</p>
          </div>
        </div>
      )}

      {serverError && (
        <div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 px-4 py-3 text-sm text-red-700 dark:text-red-400">
          {serverError}
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        <Input
          label="Email address"
          type="email"
          placeholder="you@example.com"
          leftIcon={<Mail className="h-4 w-4" />}
          error={errors.email?.message}
          {...register('email')}
        />

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Password</label>
            <Link to="/forgot-password" className="text-xs font-medium text-brand-600 hover:text-brand-700 dark:text-brand-400">
              Forgot password?
            </Link>
          </div>
          <Input
            type={showPassword ? 'text' : 'password'}
            placeholder="Enter your password"
            leftIcon={<Lock className="h-4 w-4" />}
            rightIcon={
              <button type="button" onClick={() => setShowPassword((p) => !p)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
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
        <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-100 dark:border-gray-800" /></div>
        <div className="relative flex justify-center text-xs text-gray-400">
          <span className="bg-white dark:bg-gray-950 px-3">Don&apos;t have an account?</span>
        </div>
      </div>

      {/* Role links */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          { label: 'Student', path: '/register/student', Icon: GraduationCap },
          { label: 'Tutor', path: '/register/tutor', Icon: BookOpen },
          { label: 'Principal', path: '/register/principal', Icon: Building2 },
          { label: 'Parent', path: '/register/parent', Icon: Heart },
        ].map(({ label, path, Icon }) => (
          <Link
            key={label}
            to={path}
            className="flex flex-col items-center gap-1 rounded-xl border border-gray-200 dark:border-gray-700 px-3 py-3 text-center hover:border-brand-300 hover:bg-brand-50 dark:hover:bg-brand-900/20 transition-all"
          >
            <Icon className="h-5 w-5 text-brand-600 dark:text-brand-400" />
            <span className="text-xs font-medium text-gray-600 dark:text-gray-400">Join as {label}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
