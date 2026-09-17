import { useState } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { Lock, ArrowLeft, CheckCircle2, Eye, EyeOff, AlertCircle } from 'lucide-react';
import { resetPasswordSchema, type ResetPasswordFormData } from '../../validators/auth.validators';
import { authService } from '../../services/auth.service';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';

export function ResetPasswordPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get('token') ?? '';
  const [showPw, setShowPw] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<ResetPasswordFormData>({
    resolver: zodResolver(resetPasswordSchema),
  });

  const mutation = useMutation({
    mutationFn: (data: ResetPasswordFormData) => authService.resetPassword({ token, password: data.password }),
    onSuccess: () => setTimeout(() => navigate('/login?reset=success'), 1500),
  });

  const serverError =
    mutation.isError && mutation.error instanceof Error
      ? (mutation.error as { response?: { data?: { message?: string } }; message?: string }).response?.data?.message
        ?? mutation.error.message
      : null;

  // No / missing token → link is invalid
  if (!token) {
    return (
      <div className="space-y-6">
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-100">
            <AlertCircle className="h-7 w-7 text-rose-600" />
          </div>
          <p className="font-semibold text-rose-800">Invalid reset link</p>
          <p className="mt-1 text-sm text-rose-600">This link is missing its token or has expired. Request a new one.</p>
          <Link to="/forgot-password" className="mt-4 inline-block text-sm font-semibold text-indigo-600 hover:text-indigo-700">
            Request a new link
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-7">
      <div>
        <Link to="/login" className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 transition-colors hover:text-indigo-600">
          <ArrowLeft className="h-4 w-4" /> Back to sign in
        </Link>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">Set a new password</h1>
        <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">Choose a strong password for your account.</p>
      </div>

      {mutation.isSuccess ? (
        <div className="space-y-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-center">
          <div className="flex justify-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100">
              <CheckCircle2 className="h-7 w-7 text-emerald-600" />
            </div>
          </div>
          <div>
            <p className="font-semibold text-emerald-800">Password updated!</p>
            <p className="mt-1 text-sm text-emerald-600">Redirecting you to sign in…</p>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-5">
          <Input
            label="New password"
            type={showPw ? 'text' : 'password'}
            placeholder="Min 8 chars, 1 uppercase, 1 number, 1 symbol"
            leftIcon={<Lock className="h-4 w-4" />}
            rightIcon={
              <button type="button" onClick={() => setShowPw((p) => !p)} className="text-slate-400 hover:text-slate-600">
                {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            }
            error={errors.password?.message}
            {...register('password')}
          />
          <Input
            label="Confirm new password"
            type={showPw ? 'text' : 'password'}
            placeholder="Re-enter password"
            leftIcon={<Lock className="h-4 w-4" />}
            error={errors.confirmPassword?.message}
            {...register('confirmPassword')}
          />
          {serverError && (
            <p className="flex items-center gap-1.5 text-sm text-rose-600">
              <AlertCircle className="h-4 w-4" /> {serverError}
            </p>
          )}
          <Button type="submit" fullWidth loading={mutation.isPending} size="lg">
            Reset password
          </Button>
        </form>
      )}
    </div>
  );
}
