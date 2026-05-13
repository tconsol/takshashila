import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Eye, EyeOff, Mail, Lock, User, Phone, ArrowLeft, Heart, Users } from 'lucide-react';
import { z } from 'zod';
import { useMutation } from '@tanstack/react-query';
import { authService } from '../../services/auth.service';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';

const schema = z.object({
  firstName: z.string().min(1, 'First name is required').max(50),
  lastName: z.string().min(1, 'Last name is required').max(50),
  email: z.string().email('Enter a valid email'),
  phone: z.string().optional(),
  relationship: z.string().optional(),
  password: z
    .string()
    .min(8, 'Min 8 characters')
    .regex(/[A-Z]/, 'Needs an uppercase letter')
    .regex(/[a-z]/, 'Needs a lowercase letter')
    .regex(/\d/, 'Needs a number')
    .regex(/[!@#$%^&*]/, 'Needs a special character'),
  confirmPassword: z.string(),
}).refine((d) => d.password === d.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

type FormData = z.infer<typeof schema>;

const RELATIONSHIP_OPTIONS = [
  { value: 'Father', label: 'Father' },
  { value: 'Mother', label: 'Mother' },
  { value: 'Guardian', label: 'Guardian' },
  { value: 'Grandparent', label: 'Grandparent' },
  { value: 'Uncle/Aunt', label: 'Uncle / Aunt' },
  { value: 'Elder Sibling', label: 'Elder Sibling' },
  { value: 'Other', label: 'Other' },
];

const PARENT_BENEFITS = [
  { icon: '📊', text: 'Live attendance tracking' },
  { icon: '📝', text: 'Assignment updates & grades' },
  { icon: '🎓', text: 'Class schedules & recordings' },
  { icon: '📄', text: 'Worksheet access & downloads' },
];

export function RegisterParentPage() {
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const mutation = useMutation({
    mutationFn: ({ confirmPassword: _, relationship: __, ...data }: FormData) =>
      authService.register({ ...data, role: 'PARENT' }),
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
        <Link
          to="/register"
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-brand-600 dark:text-gray-400 mb-4 transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to role selection
        </Link>
        <div className="flex items-center gap-3 mb-2">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-rose-500 to-pink-500 shadow-md">
            <Heart className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Join as Parent</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">Monitor your child's learning journey</p>
          </div>
        </div>
      </div>

      {/* What you get */}
      <div className="grid grid-cols-2 gap-2">
        {PARENT_BENEFITS.map((b) => (
          <div
            key={b.text}
            className="flex items-center gap-2 rounded-xl bg-rose-50 dark:bg-rose-900/10 border border-rose-100 dark:border-rose-900/30 px-3 py-2"
          >
            <span className="text-base">{b.icon}</span>
            <span className="text-xs font-medium text-rose-800 dark:text-rose-300">{b.text}</span>
          </div>
        ))}
      </div>

      {serverError && (
        <div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 px-4 py-3 text-sm text-red-700 dark:text-red-400">
          {serverError}
        </div>
      )}

      <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="First name"
            placeholder="Sunita"
            leftIcon={<User className="h-4 w-4" />}
            error={errors.firstName?.message}
            {...register('firstName')}
          />
          <Input
            label="Last name"
            placeholder="Sharma"
            error={errors.lastName?.message}
            {...register('lastName')}
          />
        </div>

        <Input
          label="Email address"
          type="email"
          placeholder="parent@example.com"
          leftIcon={<Mail className="h-4 w-4" />}
          error={errors.email?.message}
          {...register('email')}
        />

        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Phone (optional)"
            placeholder="+91 98765 43210"
            leftIcon={<Phone className="h-4 w-4" />}
            error={errors.phone?.message}
            {...register('phone')}
          />
          <Select
            label="Relationship to child"
            options={RELATIONSHIP_OPTIONS}
            placeholder="Select…"
            leftIcon={<Users className="h-4 w-4" />}
            {...register('relationship')}
          />
        </div>

        <Input
          label="Password"
          type={showPassword ? 'text' : 'password'}
          placeholder="Min 8 chars, upper, number, symbol"
          leftIcon={<Lock className="h-4 w-4" />}
          rightIcon={
            <button
              type="button"
              onClick={() => setShowPassword((p) => !p)}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
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

        {/* Info note */}
        <div className="flex gap-3 rounded-xl bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 p-4">
          <Heart className="h-4 w-4 text-rose-500 shrink-0 mt-0.5" />
          <p className="text-sm text-rose-700 dark:text-rose-400">
            After registering, go to <strong>My Children</strong> in your dashboard and enter your child's
            Student ID to link their account and start monitoring their progress.
          </p>
        </div>

        <Button type="submit" fullWidth loading={mutation.isPending} size="lg">
          Create Parent Account
        </Button>
      </form>

      <p className="text-center text-sm text-gray-500 dark:text-gray-400">
        Already have an account?{' '}
        <Link to="/login" className="font-medium text-brand-600 hover:text-brand-700 dark:text-brand-400">
          Sign in
        </Link>
      </p>
    </div>
  );
}
