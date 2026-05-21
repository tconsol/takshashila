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
    <div className="space-y-7">
      <div>
        <Link to="/login" className="inline-flex items-center gap-1.5 rounded-full border-2 border-clay-ink bg-white px-3 py-1.5 text-xs font-extrabold text-clay-ink hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-clay-pressed shadow-clay-sm transition-all mb-5">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to sign in
        </Link>
        <h1 className="text-4xl font-extrabold tracking-tight text-clay-ink dark:text-white">Reset your password</h1>
        <p className="mt-2 text-sm font-semibold text-clay-ink/60 dark:text-gray-400">
          Enter your email and we&apos;ll send you a reset link
        </p>
      </div>

      {mutation.isSuccess ? (
        <div className="rounded-[28px] border-2.5 border-clay-ink bg-clay-mint p-6 text-center space-y-3 shadow-clay">
          <div className="flex justify-center">
            <div className="h-14 w-14 rounded-2xl border-2.5 border-clay-ink bg-white flex items-center justify-center shadow-clay-sm">
              <CheckCircle2 className="h-7 w-7 text-clay-green-dark" />
            </div>
          </div>
          <p className="font-extrabold text-clay-ink">Check your inbox</p>
          <p className="text-sm font-semibold text-clay-ink/70">
            If an account exists with that email, a password reset link has been sent. It expires in 24 hours.
          </p>
          <Link to="/login" className="inline-block mt-2 text-sm font-extrabold text-clay-green-dark hover:text-clay-green">
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
