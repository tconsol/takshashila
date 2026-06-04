import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Eye, EyeOff, Mail, Lock, User, Phone, ArrowLeft, GraduationCap, X } from 'lucide-react';
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
  subjects: z.array(z.string()).min(1, 'Add at least one subject'),
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

const POPULAR_SUBJECTS = ['Mathematics', 'Physics', 'Chemistry', 'Biology', 'English', 'History', 'Geography', 'Computer Science', 'Economics', 'Accountancy'];

export function RegisterTutorPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [subjectInput, setSubjectInput] = useState('');
  const navigate = useNavigate();

  const { register, handleSubmit, control, formState: { errors }, watch, setValue } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { subjects: [] },
  });

  const subjects = watch('subjects');

  const addSubject = (s: string) => {
    const trimmed = s.trim();
    if (trimmed && !subjects.includes(trimmed)) setValue('subjects', [...subjects, trimmed]);
    setSubjectInput('');
  };

  const removeSubject = (s: string) => setValue('subjects', subjects.filter((x) => x !== s));

  const mutation = useMutation({
    mutationFn: ({ confirmPassword: _, subjects: __, ...data }: FormData) =>
      authService.register({
        ...data,
        role: 'TUTOR',
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      }),
    onSuccess: () => navigate('/login?registered=true'),
  });

  const serverError =
    mutation.isError && mutation.error instanceof Error
      ? (mutation.error as { response?: { data?: { message?: string } } }).response?.data?.message || 'Registration failed'
      : null;

  return (
    <div className="space-y-7">
      <div>
        <Link to="/register" className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-indigo-600 transition-colors mb-4">
          <ArrowLeft className="h-4 w-4" /> Back to role selection
        </Link>
        <div className="flex items-center gap-3 mb-2">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-violet-50 text-violet-600">
            <GraduationCap className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Join as Tutor</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">Share your expertise and grow your teaching career</p>
          </div>
        </div>
      </div>

      {serverError && (
        <div className="rounded-xl bg-rose-50 border border-rose-200 px-4 py-3 text-sm font-medium text-rose-700">
          {serverError}
        </div>
      )}

      <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Input label="First name" placeholder="Rahul" leftIcon={<User className="h-4 w-4" />} error={errors.firstName?.message} {...register('firstName')} />
          <Input label="Last name" placeholder="Mehta" error={errors.lastName?.message} {...register('lastName')} />
        </div>

        <Input label="Email address" type="email" placeholder="you@example.com" leftIcon={<Mail className="h-4 w-4" />} error={errors.email?.message} {...register('email')} />

        <Input label="Phone (optional)" placeholder="+91 98765 43210" leftIcon={<Phone className="h-4 w-4" />} error={errors.phone?.message} {...register('phone')} />

        {/* Subjects field */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
            Subjects you teach <span className="text-red-500">*</span>
          </label>
          <div className="flex gap-2 mb-2">
            <input
              type="text"
              value={subjectInput}
              onChange={(e) => setSubjectInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addSubject(subjectInput); } }}
              placeholder="Type a subject and press Enter"
              className="flex-1 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2.5 text-sm text-gray-900 dark:text-white focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
            <Button type="button" size="sm" variant="outline" onClick={() => addSubject(subjectInput)}>Add</Button>
          </div>
          {/* Popular subjects quick-add */}
          <div className="flex flex-wrap gap-1.5 mb-2">
            {POPULAR_SUBJECTS.filter((s) => !subjects.includes(s)).slice(0, 6).map((s) => (
              <button
                type="button"
                key={s}
                onClick={() => addSubject(s)}
                className="text-xs px-2.5 py-1 rounded-full border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:border-brand-400 hover:text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-900/20 transition-colors"
              >
                + {s}
              </button>
            ))}
          </div>
          {subjects.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {subjects.map((s) => (
                <span key={s} className="inline-flex items-center gap-1 rounded-full bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-700 px-3 py-1 text-xs font-medium text-violet-700 dark:text-violet-300">
                  {s}
                  <button type="button" onClick={() => removeSubject(s)}><X className="h-3 w-3" /></button>
                </span>
              ))}
            </div>
          )}
          {errors.subjects && <p className="text-xs text-red-500 mt-1">{errors.subjects.message}</p>}
          <Controller name="subjects" control={control} render={() => <></>} />
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
          Create Tutor Account
        </Button>
      </form>

      <p className="text-center text-sm text-gray-500 dark:text-gray-400">
        Already have an account?{' '}
        <Link to="/login" className="font-semibold text-indigo-600 hover:text-indigo-700">Sign in</Link>
      </p>
    </div>
  );
}
