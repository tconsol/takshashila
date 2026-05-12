import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Eye, EyeOff, Mail, Lock, User, Phone, ArrowLeft, BookOpen } from 'lucide-react';
import { z } from 'zod';
import { useMutation } from '@tanstack/react-query';
import { authService } from '../../services/auth.service';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';

const schema = z.object({
  firstName: z.string().min(1, 'First name is required').max(50),
  lastName: z.string().min(1, 'Last name is required').max(50),
  email: z.string().email('Enter a valid email'),
  phone: z.string().optional(),
  grade: z.string().optional(),
  password: z
    .string()
    .min(8, 'Min 8 characters')
    .regex(/[A-Z]/, 'Needs an uppercase letter')
    .regex(/[a-z]/, 'Needs a lowercase letter')
    .regex(/\d/, 'Needs a number')
    .regex(/[!@#$%^&*]/, 'Needs a special character'),
  confirmPassword: z.string(),
}).refine((d) => d.password === d.confirmPassword, { message: 'Passwords do not match', path: ['confirmPassword'] });

type FormData = z.infer<typeof schema>;

const GRADES = ['Grade 6', 'Grade 7', 'Grade 8', 'Grade 9', 'Grade 10', 'Grade 11', 'Grade 12', 'Undergraduate', 'Postgraduate', 'Other'];

export function RegisterStudentPage() {
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({ resolver: zodResolver(schema) });

  const mutation = useMutation({
    mutationFn: ({ confirmPassword: _, grade: __, ...data }: FormData) =>
      authService.register({ ...data, role: 'STUDENT' }),
    onSuccess: () => navigate('/login?registered=true'),
  });

  const serverError =
    mutation.isError && mutation.error instanceof Error
      ? (mutation.error as { response?: { data?: { message?: string } } }).response?.data?.message || 'Registration failed'
      : null;

  return (
    <div className="space-y-7">
      {/* Header */}
      <div>
        <Link to="/register" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-brand-600 dark:text-gray-400 mb-4 transition-colors">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to role selection
        </Link>
        <div className="flex items-center gap-3 mb-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 shadow-md">
            <BookOpen className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Join as Student</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">Start your learning journey today</p>
          </div>
        </div>
      </div>

      {serverError && (
        <div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 px-4 py-3 text-sm text-red-700 dark:text-red-400">
          {serverError}
        </div>
      )}

      <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Input label="First name" placeholder="Aanya" leftIcon={<User className="h-4 w-4" />} error={errors.firstName?.message} {...register('firstName')} />
          <Input label="Last name" placeholder="Sharma" error={errors.lastName?.message} {...register('lastName')} />
        </div>

        <Input label="Email address" type="email" placeholder="you@example.com" leftIcon={<Mail className="h-4 w-4" />} error={errors.email?.message} {...register('email')} />

        <div className="grid grid-cols-2 gap-3">
          <Input label="Phone (optional)" placeholder="+91 98765 43210" leftIcon={<Phone className="h-4 w-4" />} error={errors.phone?.message} {...register('phone')} />

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Grade / Level</label>
            <select
              {...register('grade')}
              className="w-full rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2.5 text-sm text-gray-900 dark:text-white focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            >
              <option value="">Select grade</option>
              {GRADES.map((g) => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>
        </div>

        <Input
          label="Password"
          type={showPassword ? 'text' : 'password'}
          placeholder="Min 8 chars, upper, number, symbol"
          leftIcon={<Lock className="h-4 w-4" />}
          rightIcon={
            <button type="button" onClick={() => setShowPassword((p) => !p)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          }
          error={errors.password?.message}
          {...register('password')}
        />

        <Input
          label="Confirm password"
          type={showPassword ? 'text' : 'password'}
          placeholder="Repeat your password"
          leftIcon={<Lock className="h-4 w-4" />}
          error={errors.confirmPassword?.message}
          {...register('confirmPassword')}
        />

        <Button type="submit" fullWidth loading={mutation.isPending} size="lg">
          Create Student Account
        </Button>
      </form>

      <p className="text-center text-sm text-gray-500 dark:text-gray-400">
        Already have an account?{' '}
        <Link to="/login" className="font-medium text-brand-600 hover:text-brand-700 dark:text-brand-400">Sign in</Link>
      </p>
    </div>
  );
}
