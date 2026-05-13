import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { Mail, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { forgotPasswordSchema, type ForgotPasswordFormData } from '../../validators/auth.validators';
import { authService } from '../../services/auth.service';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';

export function ForgotPasswordPage() {
  const { register, handleSubmit, formState: { errors } } = useForm<ForgotPasswordFormData>({
    resolver: zodResolver(forgotPasswordSchema),
  });

  const mutation = useMutation({
    mutationFn: (data: ForgotPasswordFormData) => authService.forgotPassword(data),
  });

  return (
    <div className="space-y-8">
      <div>
        <Link to="/login" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-brand-600 dark:text-gray-400 mb-5 transition-colors">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to sign in
        </Link>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Reset your password</h1>
        <p className="mt-2 text-gray-500 dark:text-gray-400">
          Enter your email and we&apos;ll send you a reset link
        </p>
      </div>

      {mutation.isSuccess ? (
        <div className="rounded-2xl bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 p-6 text-center space-y-3">
          <div className="flex justify-center">
            <div className="h-12 w-12 rounded-full bg-green-100 dark:bg-green-900/40 flex items-center justify-center">
              <CheckCircle2 className="h-6 w-6 text-green-600 dark:text-green-400" />
            </div>
          </div>
          <p className="font-semibold text-green-800 dark:text-green-300">Check your inbox</p>
          <p className="text-sm text-green-600 dark:text-green-400">
            If an account exists with that email, a password reset link has been sent. It expires in 24 hours.
          </p>
          <Link to="/login" className="inline-block mt-2 text-sm font-medium text-brand-600 hover:text-brand-700 dark:text-brand-400">
            Return to sign in
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-5">
          <Input
            label="Email address"
            type="email"
            placeholder="you@example.com"
            leftIcon={<Mail className="h-4 w-4" />}
            error={errors.email?.message}
            {...register('email')}
          />
          <Button type="submit" fullWidth loading={mutation.isPending} size="lg">
            Send reset link
          </Button>
        </form>
      )}
    </div>
  );
}
